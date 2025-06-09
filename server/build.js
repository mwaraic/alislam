import esbuild from 'esbuild';

async function build() {
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    outdir: 'dist',
    external: [
      // Keep external dependencies that are available in Workers
      'hono',
      '@langchain/core',
      '@langchain/google-genai',
      '@langchain/pinecone',
      '@pinecone-database/pinecone'
    ],
    minify: true,
    sourcemap: true,
    target: 'es2022',
    define: {
      'process.env.NODE_ENV': '"production"'
    },
    // Workers-specific configuration
    conditions: ['worker', 'browser']
  });
}

build().catch(() => process.exit(1)); 