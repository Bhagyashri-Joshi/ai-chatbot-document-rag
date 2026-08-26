import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL || "gemini-embedding-2";

export const EMBEDDING_DIMENSIONS = 768;

/**
 * Generate an embedding for one text.
 */
export async function generateEmbedding(text) {
  if (!text || !text.trim()) {
    throw new Error("Cannot generate embedding for empty text");
  }

  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: text,
    config: {
      outputDimensionality: EMBEDDING_DIMENSIONS,
    },
  });

  const embedding = response.embeddings?.[0]?.values;

  if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Invalid embedding returned. Expected ${EMBEDDING_DIMENSIONS} dimensions.`
    );
  }

  return embedding;
}

/**
 * Generate embeddings for multiple texts.
 */
export async function generateEmbeddings(texts) {
  if (!Array.isArray(texts) || texts.length === 0) {
    return [];
  }

  const embeddings = [];

  for (const text of texts) {
    embeddings.push(await generateEmbedding(text));
  }

  return embeddings;
}

/**
 * Convert embedding array to PostgreSQL pgvector literal.
 */
export function toVectorLiteral(embedding) {
  if (!Array.isArray(embedding)) {
    throw new Error("Embedding must be an array.");
  }

  return `[${embedding.join(",")}]`;
}