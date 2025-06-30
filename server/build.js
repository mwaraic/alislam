import esbuild from 'esbuild';

async function build() {
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outdir: 'dist',
    external: [
      // Keep external dependencies
      'hono',
      '@langchain/core',
      '@langchain/google-genai',
      '@langchain/pinecone',
      '@pinecone-database/pinecone',
      '@langchain/langgraph',
      '@langchain/cohere'
    ],
    minify: true,
    sourcemap: true,
    target: 'es2022',
    define: {
      'process.env.NODE_ENV': '"production"'
    }
  });
}

build().catch(() => process.exit(1)); 