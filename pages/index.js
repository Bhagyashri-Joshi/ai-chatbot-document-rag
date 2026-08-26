// pages/index.js
// Main authenticated dashboard (TRD section 38).
//
// Layout: header + logout, upload a document, "My Documents" list.

import { getServerSession } from "next-auth/next";
import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { authOptions } from "../lib/auth";
import PdfUploader from "../components/PdfUploader";
import DocumentCard from "../components/DocumentCard";

export async function getServerSideProps(context) {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) {
    return { props: { session: null } };
  }
  return { props: { session } };
}

export default function Dashboard({ session: initialSession }) {
  const { data: session } = useSession();
  const activeSession = session || initialSession;

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadDocuments() {
    setLoading(true);
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      setDocuments(data.documents || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeSession) {
      loadDocuments();
    }
  }, [activeSession]);

  async function handleDelete(id) {
    if (!confirm("Delete this document and all its chunks?")) return;
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    setDocuments((docs) => docs.filter((d) => d.id !== id));
  }

  if (!activeSession) {
    return (
      <div className="centered-screen">
        <h1>AI Document Assistant</h1>
        <p>Sign in to upload documents and start chatting with them.</p>
        <button className="btn" onClick={() => signIn("google")}>
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>AI Document Assistant</h1>
        <button className="btn" onClick={() => signOut()}>
          Logout
        </button>
      </div>

      <div className="card">
        <div className="section-title">Upload a document</div>
        <PdfUploader onUploaded={loadDocuments} />
      </div>

      <div className="card">
        <div className="section-title">My Documents</div>
        {loading && <div className="empty-state">Loading…</div>}
        {!loading && documents.length === 0 && (
          <div className="empty-state">No documents yet. Upload a PDF to get started.</div>
        )}
        {!loading &&
          documents.map((doc) => <DocumentCard key={doc.id} document={doc} onDelete={handleDelete} />)}
      </div>
    </div>
  );
}
