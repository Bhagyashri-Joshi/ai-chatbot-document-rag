// components/PdfUploader.jsx
// Responsible for: PDF selection, validation, upload, processing state
// (TRD section 35/45).
//
// State machine (TRD section 35):
//   IDLE -> SELECTED -> UPLOADING -> PROCESSING -> READY
//   Failure states: UPLOAD_FAILED, PROCESSING_FAILED

import { useRef, useState } from "react";

const MAX_FILE_SIZE_MB = 10;

export default function PdfUploader({ onUploaded }) {
  const [state, setState] = useState("IDLE");
  const [file, setFile] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const inputRef = useRef(null);

  function reset() {
    setState("IDLE");
    setFile(null);
    setErrorMessage("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleFileSelect(e) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    // Client-side validation (server re-validates - never trust the client).
    if (!selected.name.toLowerCase().endsWith(".pdf") || selected.type !== "application/pdf") {
      setErrorMessage("Please select a PDF file.");
      setState("UPLOAD_FAILED");
      return;
    }
    if (selected.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setErrorMessage(`File is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
      setState("UPLOAD_FAILED");
      return;
    }

    setFile(selected);
    setErrorMessage("");
    setState("SELECTED");
  }

  async function handleUpload() {
    if (!file) return;
    setState("UPLOADING");

    try {
      const formData = new FormData();
      formData.append("file", file);

      setState("PROCESSING");
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.error || "Processing failed.");
        setState("PROCESSING_FAILED");
        return;
      }

      setState("READY");
      onUploaded?.(data.document);

      // Return to idle after a moment so the uploader is ready for another file.
      setTimeout(reset, 1500);
    } catch (err) {
      console.error(err);
      setErrorMessage("Upload failed. Please check your connection and try again.");
      setState("UPLOAD_FAILED");
    }
  }

  const isBusy = state === "UPLOADING" || state === "PROCESSING";
  const isFailed = state === "UPLOAD_FAILED" || state === "PROCESSING_FAILED";

  return (
    <div className="pdf-uploader">
      <div className="pdf-uploader__row">
        <label className="pdf-uploader__choose">
          Choose PDF
          <input ref={inputRef} type="file" accept="application/pdf" onChange={handleFileSelect} hidden />
        </label>

        <button className="pdf-uploader__upload" onClick={handleUpload} disabled={!file || isBusy}>
          {state === "UPLOADING" && "Uploading…"}
          {state === "PROCESSING" && "Processing…"}
          {state !== "UPLOADING" && state !== "PROCESSING" && "Upload"}
        </button>

        {file && !isBusy && <span className="pdf-uploader__filename">{file.name}</span>}
      </div>

      {state === "READY" && <p className="pdf-uploader__success">✓ Document ready!</p>}
      {isFailed && <p className="pdf-uploader__error">{errorMessage}</p>}

      <style jsx>{`
        .pdf-uploader {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .pdf-uploader__row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .pdf-uploader__choose,
        .pdf-uploader__upload {
          font-size: 14px;
          font-weight: 600;
          padding: 8px 16px;
          border-radius: 8px;
          cursor: pointer;
        }
        .pdf-uploader__choose {
          background: #fff;
          border: 1px solid #d1d5db;
          color: #111827;
        }
        .pdf-uploader__upload {
          background: #4f46e5;
          border: none;
          color: #fff;
        }
        .pdf-uploader__upload:disabled {
          background: #a5a6f6;
          cursor: not-allowed;
        }
        .pdf-uploader__filename {
          font-size: 13px;
          color: #6b7280;
        }
        .pdf-uploader__success {
          color: #065f46;
          font-size: 13px;
          margin: 0;
        }
        .pdf-uploader__error {
          color: #b91c1c;
          font-size: 13px;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
