import esbuild from 'esbuild';

async function build() {
  // Build the main Hono app for Workers
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outdir: 'dist',
    external: [
      // Keep external dependencies
      'hono',
      '@langchain/core',
      '@langchain/google-genai',
      '@langchain/pinecone',
      '@pinecone-database/pinecone',
      '@langchain/langgraph',
      '@langchain/cohere',
      'langchain'
    ],
    minify: true,
    sourcemap: true,
    target: 'es2022',
    define: {
      'process.env.NODE_ENV': '"production"'
    }
  });

  // Build the dev server for containers
  await esbuild.build({
    entryPoints: ['src/dev.ts'],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outdir: 'dist',
    external: [
      // Keep external dependencies
      'hono',
      '@hono/node-server',
      '@langchain/core',
      '@langchain/google-genai',
      '@langchain/pinecone',
      '@pinecone-database/pinecone',
      '@langchain/langgraph',
      '@langchain/cohere',
      'langchain'
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