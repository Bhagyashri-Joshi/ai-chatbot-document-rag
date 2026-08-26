// pages/api/documents/index.js
// GET /api/documents - list the current user's documents (TRD section 40).
//
// Must filter by userId = session.user.id. Never trust a client-supplied
// userId.

import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { prisma } from "../../../lib/db";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const documents = await prisma.document.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        fileName: true,
        pageCount: true,
        status: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { chunks: true } },
      },
    });

    return res.status(200).json({ documents });
  } catch (err) {
    console.error("[DOCUMENTS] list error", err);
    return res.status(500).json({ error: "Failed to load documents" });
  }
}
