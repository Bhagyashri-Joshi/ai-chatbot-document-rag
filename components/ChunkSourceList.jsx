// components/ChunkSourceList.jsx
// Responsible for: document source, page number, source metadata
// (TRD section 34/45).
//
// Receives `sources` and renders document name + page. Similarity is only
// shown when NODE_ENV !== "production" (dev-mode retrieval debugging,
// TRD section 54) - internal database details should not otherwise be
// exposed to end users.

export default function ChunkSourceList({ sources = [] }) {
  if (!sources.length) return null;

  const showSimilarity = process.env.NODE_ENV !== "production";

  return (
    <div className="chunk-source-list">
      <div className="chunk-source-list__title">Sources</div>
      <ul>
        {sources.map((source, idx) => (
          <li key={`${source.documentId}-${source.pageNumber}-${idx}`}>
            <span className="icon">📄</span>
            <span className="doc-name">{source.documentName}</span>
            <span className="page"> — Page {source.pageNumber}</span>
            {showSimilarity && typeof source.similarity === "number" && (
              <span className="similarity"> (similarity {source.similarity.toFixed(2)})</span>
            )}
          </li>
        ))}
      </ul>

      <style jsx>{`
        .chunk-source-list {
          margin-top: 10px;
          padding-top: 10px;
          border-top: 1px solid rgba(0, 0, 0, 0.08);
        }
        .chunk-source-list__title {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #6b7280;
          margin-bottom: 6px;
        }
        ul {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        li {
          font-size: 13px;
          color: #374151;
        }
        .doc-name {
          font-weight: 600;
        }
        .similarity {
          color: #9ca3af;
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}
