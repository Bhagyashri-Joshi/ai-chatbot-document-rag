// pages/api/chat.js
// POST /api/chat - question answering over a document via SSE streaming
// (TRD section 31/32/43).
//
// Processing: authenticate -> verify document ownership -> embed question ->
// search vectors -> retrieve top 5 -> assemble context -> Gemini ->
// stream response.

import { getServerSession } from "next-auth/next";
import { authOptions } from "../../lib/auth";
import { prisma } from "../../lib/db";
import { answerQuestionWithStreaming } from "../../lib/geminiRAG";

export const config = {
  api: {
    // We stream manually via res.write, default body parsing (JSON) is fine.
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Layer 1: Authentication
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = session.user.id;

  const { documentId, message } = req.body || {};

  if (!documentId || !message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "documentId and message are required" });
  }

  // Layer 2: Authorization - verify document ownership before doing
  // anything else (embedding, retrieval, etc).
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document || document.userId !== userId) {
    return res.status(404).json({ error: "Document not found" });
  }
  if (document.status !== "READY") {
    return res.status(409).json({ error: `Document is not ready (status: ${document.status})` });
  }

  // Set up Server-Sent Events response.
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const send = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // Keep the connection alive on some proxies.
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeat);
  });

  try {
    console.log(`[SEARCH] querying vectors for document ${documentId}`);
    console.log(`[GEMINI] generation started`);

    await answerQuestionWithStreaming({
      userId,
      documentId,
      question: message,
      onEvent: send,
    });

    console.log(`[GEMINI] generation completed`);
  } catch (err) {
    console.error("[CHAT] unexpected error", err);
    send({ type: "error", message: "The AI service could not generate a response. Please try again." });
    send({ type: "done" });
  } finally {
    clearInterval(heartbeat);
    res.end();
  }
}
