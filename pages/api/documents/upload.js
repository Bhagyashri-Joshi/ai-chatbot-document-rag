// pages/api/documents/upload.js
// POST /api/documents/upload - upload and process a PDF (TRD section 11, 39).
//
// Server flow (TRD section 11):
//   Request -> check session -> validate file -> read file -> parse PDF ->
//   create Document -> extract pages -> chunk -> generate embeddings ->
//   store chunks -> mark document READY
//
// Body parsing is disabled (see `config` export) because we handle the
// multipart/form-data upload manually with formidable.

import { getServerSession } from "next-auth/next";
import formidable from "formidable";
import fs from "fs/promises";
import crypto from "crypto";
import { authOptions } from "../../../lib/auth";
import { prisma } from "../../../lib/db";
import { extractPdfPages, isEffectivelyEmpty } from "../../../lib/pdfParser";
import { chunkPages } from "../../../lib/chunker";
import { generateEmbeddings, toVectorLiteral } from "../../../lib/embedder";
import { hashFileBuffer } from "../../../lib/fileHash";

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || `${10 * 1024 * 1024}`, 10); // 10MB default

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      maxFileSize: MAX_FILE_SIZE,
      multiples: false,
    });
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

async function storeChunksWithEmbeddings({ documentId, userId, chunks }) {
  console.log(`[CHUNK] created ${chunks.length} chunks`);

  const vectors = await generateEmbeddings(chunks.map((c) => c.content));
  console.log(`[EMBED] generated embeddings`);

  // Insert with raw SQL because Prisma cannot bind the `vector` column type
  // directly (see prisma/schema.prisma note). Each insert is parameterized.
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const vectorLiteral = toVectorLiteral(vectors[i]);
    // Generate the id in JS rather than relying on a Postgres extension
    // like pgcrypto's gen_random_uuid(), which may not be enabled.
    const chunkId = crypto.randomUUID();

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "Chunk"
        (id, "documentId", "userId", content, "chunkIndex", "pageNumber", "startChar", "endChar", "createdAt", embedding)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, now(), $9::vector)
      `,
      chunkId,
      documentId,
      userId,
      chunk.content,
      chunk.chunkIndex,
      chunk.pageNumber,
      chunk.startChar,
      chunk.endChar,
      vectorLiteral
    );
  }

  console.log(`[DB] stored ${chunks.length} chunks`);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Layer 1: Authentication (TRD section 55)
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = session.user.id;

  let uploadedFilePath;

  try {
    const { files } = await parseForm(req);
    const fileField = files.file;
    const file = Array.isArray(fileField) ? fileField[0] : fileField;

    if (!file) {
      return res.status(400).json({ error: "No file provided. Expected form field 'file'." });
    }
    uploadedFilePath = file.filepath;

    // File validation (TRD section 12): never trust only the filename
    // extension - also check the reported MIME type.
    const originalName = file.originalFilename || "document.pdf";
    const extensionOk = originalName.toLowerCase().endsWith(".pdf");
    const mimeOk = file.mimetype === "application/pdf";

    if (!extensionOk || !mimeOk) {
      return res.status(400).json({ error: "Invalid file type. Only PDF files are accepted." });
    }

    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({ error: `File too large. Maximum size is ${MAX_FILE_SIZE} bytes.` });
    }

    console.log(`[UPLOAD] file received: ${originalName} (${file.size} bytes)`);

    const buffer = await fs.readFile(file.filepath);
    const fileHash = hashFileBuffer(buffer);

    // Duplicate processing protection (TRD section 18/57): same user +
    // same hash => reuse the existing document instead of re-embedding.
    const existing = await prisma.document.findFirst({
      where: { userId, fileHash, status: "READY" },
    });
    if (existing) {
      console.log(`[UPLOAD] duplicate detected for user, reusing document ${existing.id}`);
      return res.status(200).json({
        success: true,
        duplicate: true,
        document: { id: existing.id, name: existing.name, status: existing.status },
      });
    }

    // Create the Document row in PROCESSING state up front so the UI can
    // poll/reflect progress even if a later step fails.
    const document = await prisma.document.create({
      data: {
        userId,
        name: originalName,
        fileName: originalName,
        fileHash,
        status: "PROCESSING",
        pageCount: 0,
      },
    });

    try {
      // Parse PDF -> page-aware text (TRD section 13/14)
      let extraction;
      try {
        extraction = await extractPdfPages(buffer);
      } catch (parseErr) {
        console.error("[PDF] parse error", parseErr);
        await prisma.document.update({
          where: { id: document.id },
          data: { status: "FAILED", errorMessage: "Invalid PDF" },
        });
        return res.status(400).json({ error: "Invalid PDF" });
      }

      console.log(`[PDF] extracted ${extraction.pageCount} pages`);

      if (isEffectivelyEmpty(extraction.pages)) {
        await prisma.document.update({
          where: { id: document.id },
          data: { status: "FAILED", errorMessage: "No extractable text was found." },
        });
        return res.status(422).json({ error: "No extractable text was found." });
      }

      // Chunk (TRD section 15/16)
      const chunks = chunkPages(extraction.pages);

      // Embed + store (TRD section 17-19)
      try {
        await storeChunksWithEmbeddings({ documentId: document.id, userId, chunks });
      } catch (embedErr) {
        console.error("[EMBED] Gemini error", embedErr);
        await prisma.document.update({
          where: { id: document.id },
          data: { status: "FAILED", errorMessage: "Embedding generation failed." },
        });
        return res.status(502).json({ error: "Embedding generation failed. Please try again." });
      }

      const readyDocument = await prisma.document.update({
        where: { id: document.id },
        data: { status: "READY", pageCount: extraction.pageCount },
      });

      return res.status(200).json({
        success: true,
        document: {
          id: readyDocument.id,
          name: readyDocument.name,
          status: readyDocument.status,
          pageCount: readyDocument.pageCount,
        },
      });
    } catch (pipelineErr) {
      console.error("[UPLOAD] pipeline error", pipelineErr);
      await prisma.document
        .update({
          where: { id: document.id },
          data: { status: "FAILED", errorMessage: "Processing failed." },
        })
        .catch(() => {});
      return res.status(500).json({ error: "Failed to process document." });
    }
  } catch (err) {
    console.error("[UPLOAD] unexpected error", err);
    return res.status(500).json({ error: "Upload failed. Please try again." });
  } finally {
    if (uploadedFilePath) {
      await fs.unlink(uploadedFilePath).catch(() => {});
    }
  }
}
