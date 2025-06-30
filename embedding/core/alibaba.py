# coding=utf-8
# Lightweight version for sparse embeddings only

from collections import defaultdict
from typing import Dict, List
import numpy as np
import torch
from transformers import AutoModelForTokenClassification, AutoTokenizer


class GTEEmbeddidng(torch.nn.Module):
    def __init__(self, model_name: str = None):
        super().__init__()
        # Force CPU-only and no fp16 for smaller size
        self.device = torch.device("cpu")
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        
        # Load model with CPU and float32 to reduce memory
        self.model = AutoModelForTokenClassification.from_pretrained(
            model_name, 
            trust_remote_code=True, 
            torch_dtype=torch.float32
        )
        self.vocab_size = self.model.config.vocab_size
        self.model.to(self.device)
        
        # Put model in eval mode to disable dropout and batch norm
        self.model.eval()

    def _process_token_weights(self, token_weights: np.ndarray, input_ids: list):
        # Convert to dict - simplified version
        result = defaultdict(int)
        unused_tokens = {self.tokenizer.cls_token_id, self.tokenizer.eos_token_id, 
                        self.tokenizer.pad_token_id, self.tokenizer.unk_token_id}
        
        for w, idx in zip(token_weights, input_ids):
            if idx not in unused_tokens and w > 0:
                token = self.tokenizer.decode([int(idx)])
                if w > result[token]:
                    result[token] = w
        return result

    @torch.no_grad()
    def encode(self, texts: List[str], return_sparse: bool = True):
        """Simplified encode that only returns sparse embeddings"""
        if isinstance(texts, str):
            texts = [texts]
            
        # Process in smaller batches to reduce memory usage
        batch_size = 4  # Smaller batch size
        all_token_weights = []
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i: i + batch_size]
            result = self._encode_batch(batch)
            if return_sparse:
                all_token_weights.extend(result['token_weights'])
        
        return {"token_weights": all_token_weights}

    @torch.no_grad()
    def _encode_batch(self, texts: List[str]):
        """Encode a single batch"""
        text_input = self.tokenizer(
            texts, 
            padding=True, 
            truncation=True, 
            return_tensors='pt', 
            max_length=512  # Reduced max length
        )
        text_input = {k: v.to(self.device) for k, v in text_input.items()}
        
        # Forward pass
        model_out = self.model(**text_input, return_dict=True)
        
        # Extract sparse weights
        token_weights = torch.relu(model_out.logits).squeeze(-1)
        token_weights = list(map(
            self._process_token_weights, 
            token_weights.detach().cpu().numpy().tolist(),
            text_input['input_ids'].cpu().numpy().tolist()
        ))
        
        return {'token_weights': token_weights}
