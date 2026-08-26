// components/DocumentCard.jsx
// Responsible for: document metadata, processing status, document actions
// (TRD section 36/45).

import Link from "next/link";

const STATUS_STYLES = {
  UPLOADING: { label: "Uploading", color: "#6b7280", bg: "#f3f4f6" },
  PROCESSING: { label: "Processing", color: "#92400e", bg: "#fef3c7" },
  READY: { label: "Ready", color: "#065f46", bg: "#d1fae5" },
  FAILED: { label: "Failed", color: "#991b1b", bg: "#fee2e2" },
};

export default function DocumentCard({ document, onDelete }) {
  const status = STATUS_STYLES[document.status] || STATUS_STYLES.PROCESSING;
  const createdDate = new Date(document.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="document-card">
      <div className="document-card__main">
        <div className="document-card__icon">📄</div>
        <div>
          <div className="document-card__name">{document.name}</div>
          <div className="document-card__meta">
            {document.pageCount ? `${document.pageCount} pages` : "—"} · {createdDate}
          </div>
          {document.status === "FAILED" && document.errorMessage && (
            <div className="document-card__error">{document.errorMessage}</div>
          )}
        </div>
      </div>

      <div className="document-card__actions">
        <span className="document-card__status" style={{ color: status.color, background: status.bg }}>
          {status.label}
        </span>

        {document.status === "READY" && (
          <Link href={`/chat/${document.id}`} className="document-card__button">
            Chat
          </Link>
        )}

        {onDelete && (
          <button className="document-card__button document-card__button--danger" onClick={() => onDelete(document.id)}>
            Delete
          </button>
        )}
      </div>

      <style jsx>{`
        .document-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 14px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          background: #fff;
          margin-bottom: 10px;
          flex-wrap: wrap;
        }
        .document-card__main {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          min-width: 200px;
        }
        .document-card__icon {
          font-size: 22px;
        }
        .document-card__name {
          font-weight: 600;
          color: #111827;
        }
        .document-card__meta {
          font-size: 12px;
          color: #6b7280;
          margin-top: 2px;
        }
        .document-card__error {
          font-size: 12px;
          color: #b91c1c;
          margin-top: 4px;
        }
        .document-card__actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .document-card__status {
          font-size: 12px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 999px;
        }
        .document-card__button {
          font-size: 13px;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 8px;
          background: #4f46e5;
          color: #fff;
          border: none;
          cursor: pointer;
          text-decoration: none;
        }
        .document-card__button--danger {
          background: #fff;
          color: #b91c1c;
          border: 1px solid #fecaca;
        }
      `}</style>
    </div>
  );
}
