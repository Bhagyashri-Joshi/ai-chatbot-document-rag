-- Run this in the Supabase SQL editor AFTER `prisma db push` / `prisma migrate`
-- has created the tables (the Chunk.embedding column is created by Prisma as
-- `Unsupported("vector(768)")`, but the `vector` extension itself, and the
-- similarity index, must be created manually since Prisma cannot manage them).

-- 1. Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Verify it is enabled (should return a row where extname = 'vector')
SELECT * FROM pg_extension WHERE extname = 'vector';

-- 3. Make sure the embedding column exists and is the right type.
--    (Prisma's `Unsupported("vector(768)")` should already have created
--    this, but this is a safe no-op if it already exists correctly.)
ALTER TABLE "Chunk"
  ALTER COLUMN "embedding" TYPE vector(768);

-- 4. Create an IVFFlat index for cosine similarity search.
--    `lists = 100` is a reasonable starting point for small/medium datasets.
--    Rule of thumb: lists ≈ rows / 1000 (min 10). Adjust as your data grows.
CREATE INDEX IF NOT EXISTS chunks_embedding_idx
ON "Chunk"
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- 5. (Optional but recommended) index to speed up user-filtered scans
CREATE INDEX IF NOT EXISTS chunks_user_id_idx ON "Chunk" ("userId");
CREATE INDEX IF NOT EXISTS chunks_document_id_idx ON "Chunk" ("documentId");

-- 6. Sanity check: list indexes on the Chunk table
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'Chunk';
