// pages/api/search.js
// POST /api/search - standalone vector search endpoint (TRD section 3).
//
// Useful for testing retrieval quality independently of Gemini generation
// (see TRD section 66, Phase 6: "Test retrieval before adding Gemini").
// Returns the raw retrieved chunks + similarity scores; the UI does not
// need to call this directly, but it's handy during development
// (TRD section 54, Retrieval Debugging).

import { getServerSession } from "next-auth/next";
import { authOptions } from "../../lib/auth";
import { prisma } from "../../lib/db";
import { searchRelevantChunks } from "../../lib/vectorSearch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = session.user.id;

  const { documentId, question, limit } = req.body || {};
  if (!question || typeof question !== "string" || !question.trim()) {
    return res.status(400).json({ error: "question is required" });
  }

  if (documentId) {
    const document = await prisma.document.findUnique({ where: { id: documentId } });
    if (!document || document.userId !== userId) {
      return res.status(404).json({ error: "Document not found" });
    }
  }

  try {
    const results = await searchRelevantChunks({
      userId,
      question,
      documentId,
      limit: limit || undefined,
    });

    console.log(`[SEARCH] retrieved ${results.length} chunks`);

    return res.status(200).json({ results });
  } catch (err) {
    console.error("[SEARCH] error", err);
    return res.status(500).json({ error: "Search failed" });
  }
}
