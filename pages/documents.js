// pages/documents.js
// A dedicated documents list page (linked from the dashboard), mirroring
// the "My Documents" section but as its own route for direct navigation.

import { getServerSession } from "next-auth/next";
import { useEffect, useState } from "react";
import Link from "next/link";
import { authOptions } from "../lib/auth";
import DocumentCard from "../components/DocumentCard";

export async function getServerSideProps(context) {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) {
    return {
      redirect: { destination: "/", permanent: false },
    };
  }
  return { props: {} };
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadDocuments() {
    setLoading(true);
    const res = await fetch("/api/documents");
    const data = await res.json();
    setDocuments(data.documents || []);
    setLoading(false);
  }

  useEffect(() => {
    loadDocuments();
  }, []);

  async function handleDelete(id) {
    if (!confirm("Delete this document and all its chunks?")) return;
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    setDocuments((docs) => docs.filter((d) => d.id !== id));
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>My Documents</h1>
        <Link href="/" className="btn">
          ← Dashboard
        </Link>
      </div>

      <div className="card">
        {loading && <div className="empty-state">Loading…</div>}
        {!loading && documents.length === 0 && (
          <div className="empty-state">No documents yet. Upload a PDF from the dashboard.</div>
        )}
        {!loading &&
          documents.map((doc) => <DocumentCard key={doc.id} document={doc} onDelete={handleDelete} />)}
      </div>
    </div>
  );
}
