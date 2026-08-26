// pages/api/documents/[id].js
// GET    /api/documents/[id] - get one document (TRD section 41)
// DELETE /api/documents/[id] - delete a document + its chunks (TRD section 42)
//
// Both must verify ownership: never return or delete a document belonging
// to another user (Layer 2 authorization, TRD section 55).

import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { prisma } from "../../../lib/db";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const userId = session.user.id;
  const { id } = req.query;

  const document = await prisma.document.findUnique({ where: { id } });

  if (!document || document.userId !== userId) {
    // Same response whether the document doesn't exist or belongs to
    // someone else - don't leak existence of other users' documents.
    return res.status(404).json({ error: "Document not found" });
  }

  if (req.method === "GET") {
    return res.status(200).json({ document });
  }

  if (req.method === "DELETE") {
    try {
      // Chunk rows cascade-delete via the Prisma relation
      // (onDelete: Cascade in schema.prisma), but we delete explicitly
      // first for clarity/older DBs without the FK cascade applied.
      await prisma.chunk.deleteMany({ where: { documentId: id } });
      await prisma.document.delete({ where: { id } });
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error("[DOCUMENTS] delete error", err);
      return res.status(500).json({ error: "Failed to delete document" });
    }
  }

  res.setHeader("Allow", ["GET", "DELETE"]);
  return res.status(405).json({ error: "Method not allowed" });
}
