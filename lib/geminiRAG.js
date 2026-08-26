import { GoogleGenAI } from "@google/genai";
import { searchRelevantChunks } from "./vectorSearch";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODEL =
  process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

export async function answerQuestionWithStreaming({
  userId,
  documentId,
  question,
  onEvent,
}) {
  try {
    // 1. Retrieve relevant chunks from pgvector
    const chunks = await searchRelevantChunks({
      userId,
      documentId,
      question,
    });

    console.log(`[SEARCH] found ${chunks.length} relevant chunks`);

    // 2. No relevant information found
    if (!chunks || chunks.length === 0) {
      onEvent({
        type: "token",
        text: "I couldn't find relevant information in the uploaded document.",
      });

      onEvent({
        type: "done",
      });

      return;
    }

    // 3. Build context from retrieved chunks
    const context = chunks
      .map((chunk, index) => {
        return `--- SOURCE ${index + 1} ---\n${chunk.content}`;
      })
      .join("\n\n");

    // 4. RAG prompt
    const prompt = `You are a helpful document question-answering assistant.

Answer the user's question using ONLY the information contained in the document context.

Rules:
- Use only the provided document context.
- Do not invent facts.
- Do not use outside knowledge.
- If the answer cannot be found in the context, say that the information is not available in the document.
- Give a clear and concise answer.

DOCUMENT CONTEXT:

${context}

USER QUESTION:

${question}`;

    console.log("[GEMINI] generation started");

    // 5. Generate Gemini response
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
    });

    const answer = response.text;

    if (!answer) {
      throw new Error("Gemini returned an empty response.");
    }

    // 6. Send answer through existing SSE system
    onEvent({
      type: "token",
      text: answer,
    });

    // 7. Send sources
    onEvent({
      type: "sources",
      sources: chunks.map((chunk) => ({
        id: chunk.id,
        content: chunk.content,
      })),
    });

    // 8. Tell frontend generation is complete
    onEvent({
      type: "done",
    });

    console.log("[GEMINI] generation completed");
  } catch (error) {
    console.error("[GEMINI] generation error", error);

    onEvent({
      type: "error",
      message: "Gemini could not generate a response.",
    });

    onEvent({
      type: "done",
    });
  }
}