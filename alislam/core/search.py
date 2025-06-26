from langchain_pinecone import PineconeVectorStore
from pinecone import Pinecone as pc
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from pinecone import Pinecone as pc
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_cohere import CohereRerank
from core.alibaba import GTEEmbeddidng
import os

GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY')
COHERE_API_KEY = os.environ.get('COHERE_API_KEY')
PINECONE_API_KEY = os.environ.get('PINECONE_API_KEY')

gemini_embeddings = GoogleGenerativeAIEmbeddings(model="models/gemini-embedding-exp-03-07")

PINECONE_HOST="https://jamaat-literature-fa1xyix.svc.aped-4627-b74a.pinecone.io"
PINECONE_INDEX="jamaat-literature"

# Initialize Pinecone client
pine_client = pc(api_key=PINECONE_API_KEY)
index_name = PINECONE_INDEX
index = pine_client.Index(index_name, PINECONE_HOST)

vectorstore = PineconeVectorStore(
    namespace="quran-english-five-volume-1",
    index=index,
    embedding=gemini_embeddings
)

PINECONE_SPARSE_HOST="https://jamaat-literature-v3-fa1xyix.svc.aped-4627-b74a.pinecone.io"
PINECONE_SPARSE_INDEX="jamaat-literature-v3"

# Initialize Pinecone client
pine_sparse_client = pc(api_key=PINECONE_API_KEY)
sparse_index_name = PINECONE_SPARSE_INDEX
sparse_index = pine_sparse_client.Index(sparse_index_name, PINECONE_SPARSE_HOST)

reranker = CohereRerank(
    cohere_api_key=COHERE_API_KEY,
    model="rerank-multilingual-v3.0"  # latest model
)

model_name_or_path = 'Alibaba-NLP/gte-multilingual-base'
model = GTEEmbeddidng(model_name_or_path)

llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash-preview-05-20")

def search_commentary(query):
    """
    Search the commentary for the given query.

    Args:
        query (str): The query to search the commentary for.

    Returns:
        list: A list of matches from the commentary.
    """
    dense_results = index.query(
        namespace="quran-english-five-volume-1",
        vector=gemini_embeddings.embed_query(query), 
        top_k=40,
        include_metadata=True,
        include_values=False
    )

    # Encode the query and extract sparse token weights
    q_tw = model.encode([query], return_sparse=True)["token_weights"][0]

    # Merge duplicate token indices by summing their weights
    merged = {}
    for token, weight in q_tw.items():
        token_id = model.tokenizer.convert_tokens_to_ids(token)
        if token_id in merged:
            merged[token_id] += float(weight)
        else:
            merged[token_id] = float(weight)

    q_indices = list(merged.keys())
    q_values = list(merged.values())

    # Perform sparse query
    sparse_results = sparse_index.query(
        top_k=40,
        sparse_vector={
            "indices": q_indices,
            "values": q_values
        },
        namespace="quran-english-five-volume-1",
        include_metadata=True,
    )

    def merge_chunks(dense_results, sparse_results):
        def normalize_hit(hit, source='dense'):
            if source == 'dense':
                return {
                    'chunk_text': hit['metadata'].get('text', '').strip(),
                    '_score': hit.get('score', 0),
                    'link': hit['metadata'].get('link'),
                    'page': hit['metadata'].get('page'),
                    'title': hit['metadata'].get('title'),
                    'source': 'dense'
                }
            elif source == 'sparse':
                return {
                    'chunk_text': hit['metadata'].get('text', '').strip(),
                    '_score': hit.get('score', 0),
                    'link': hit['metadata'].get('link'),
                    'page': hit['metadata'].get('page'),
                    'title': hit['metadata'].get('title'),
                    'source': 'sparse'
                }

        # Normalize both result sets
        dense_hits = [normalize_hit(hit, source='dense') for hit in dense_results.get('matches', [])]
        sparse_hits = [normalize_hit(hit, source='sparse') for hit in sparse_results.get('matches', [])]
        # Deduplicate based on `chunk_text`
        unique_hits = {}
        for hit in dense_hits + sparse_hits:
            text_key = hit['chunk_text']
            if text_key and text_key not in unique_hits:
                unique_hits[text_key] = hit
            elif text_key and text_key in unique_hits:
                # Keep the one with higher score
                if hit['_score'] > unique_hits[text_key]['_score']:
                    unique_hits[text_key] = hit

        # Sort by score
        sorted_hits = sorted(unique_hits.values(), key=lambda x: x['_score'], reverse=True)

        return sorted_hits

    merged_results = merge_chunks(dense_results, sparse_results)

    reranked_results = reranker.rerank(merged_results, query, top_n=5)

    final_results = []

    for result in reranked_results:
        final_results.append(merged_results[result['index']])

    enhanced_results = []

    for result in final_results:
        pages = [str(int(result['page']) - 1), str(int(result['page'])), str(int(result['page']) + 1)]

        dummy_vector = [0.0] * 3072  # Adjust to your index's dimensionality

        result = index.query(
            vector=dummy_vector,
            namespace="quran-english-five-volume-1",
            top_k=3,
            filter={
                "page": { "$in": pages }
            },
            include_metadata=True
        )

        enhanced_results.extend(result['matches'])

    # Format the enhanced results in the desired format
    formatted_results = []
    for doc in enhanced_results:
        content = doc['metadata'].get('text', '')
        link = doc['metadata'].get('link', '')
        if link:
            # Replace 'page=' with 'code=' in the link
            link = link.replace('page=', 'code=')
        
        formatted_content = f"Content:{content} \n\nLink:{link}"
        formatted_results.append(formatted_content)
    
    return formatted_results