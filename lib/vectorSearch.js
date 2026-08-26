// lib/vectorSearch.js
// Responsible for: question embedding + database similarity search
// (TRD section 20-24, 51).
//
// CRITICAL SECURITY REQUIREMENT (TRD section 22):
// Every query here filters by the authenticated user's id. Never remove the
// `user_id` predicate - without it, users could retrieve another user's
// private document content via the shared `Chunk` table.

import { prisma } from "./db";
import { generateEmbedding, toVectorLiteral } from "./embedder";

const DEFAULT_TOP_K = parseInt(process.env.TOP_K || "5", 10);

/**
 * Embeds `question`, then runs a pgvector cosine-similarity search scoped to
 * `userId` (and optionally a single `documentId`), returning the top-K most
 * relevant chunks.
 *
 * @param {Object} params
 * @param {string} params.userId - authenticated user id (server session only)
 * @param {string} params.question
 * @param {string} [params.documentId] - restrict search to one document
 * @param {number} [params.limit]
 * @param {number} [params.minimumSimilarity] - optional similarity threshold (0-1)
 * @returns {Promise<Array<{chunkId: string, content: string, documentId: string, documentName: string, pageNumber: number, chunkIndex: number, similarity: number}>>}
 */
export async function searchRelevantChunks({
  userId,
  question,
  documentId,
  limit = DEFAULT_TOP_K,
  minimumSimilarity,
}) {
  if (!userId) {
    throw new Error("searchRelevantChunks: userId is required for user isolation");
  }

  const queryEmbedding = await generateEmbedding(question);
  const vectorLiteral = toVectorLiteral(queryEmbedding);

  // Parameterized raw SQL. `user_id` filter is mandatory. We optionally
  // filter by documentId too. All values are passed as bound parameters,
  // never string-interpolated, to avoid SQL injection (TRD section 51).
  const rows = documentId
    ? await prisma.$queryRawUnsafe(
        `
        SELECT
          c.id                                   AS "chunkId",
          c.content                              AS "content",
          c."documentId"                         AS "documentId",
          d.name                                 AS "documentName",
          c."pageNumber"                         AS "pageNumber",
          c."chunkIndex"                         AS "chunkIndex",
          1 - (c.embedding <=> $1::vector)        AS "similarity"
        FROM "Chunk" c
        JOIN "Document" d ON d.id = c."documentId"
        WHERE c."userId" = $2 AND c."documentId" = $3
        ORDER BY c.embedding <=> $1::vector
        LIMIT $4;
        `,
        vectorLiteral,
        userId,
        documentId,
        limit
      )
    : await prisma.$queryRawUnsafe(
        `
        SELECT
          c.id                                   AS "chunkId",
          c.content                              AS "content",
          c."documentId"                         AS "documentId",
          d.name                                 AS "documentName",
          c."pageNumber"                         AS "pageNumber",
          c."chunkIndex"                         AS "chunkIndex",
          1 - (c.embedding <=> $1::vector)        AS "similarity"
        FROM "Chunk" c
        JOIN "Document" d ON d.id = c."documentId"
        WHERE c."userId" = $2
        ORDER BY c.embedding <=> $1::vector
        LIMIT $3;
        `,
        vectorLiteral,
        userId,
        limit
      );

  const results = rows.map((r) => ({
    ...r,
    similarity: typeof r.similarity === "number" ? r.similarity : Number(r.similarity),
  }));

  if (typeof minimumSimilarity === "number") {
    return results.filter((r) => r.similarity >= minimumSimilarity);
  }

  return results;
}

/**
 * Sorts retrieved chunks into a stable reading order (document, page,
 * chunkIndex) rather than pure similarity order, so neighboring information
 * is easier for Gemini to follow when assembled into context (TRD section 26).
 */
export function sortForContext(chunks) {
  return [...chunks].sort((a, b) => {
    if (a.documentId !== b.documentId) return a.documentId.localeCompare(b.documentId);
    if (a.pageNumber !== b.pageNumber) return a.pageNumber - b.pageNumber;
    return a.chunkIndex - b.chunkIndex;
  });
}

export default { searchRelevantChunks, sortForContext };
