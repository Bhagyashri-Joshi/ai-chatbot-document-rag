// lib/pdfParser.js
// Responsible for: PDF -> page-aware text extraction (TRD section 13/14).
//
// Uses `pdf-parse`. By default pdf-parse concatenates every page into a
// single string, which throws away page boundaries. Since citations require
// page numbers, we hook into pdf-parse's low-level `pagerender` callback to
// capture text per page instead.

import pdfParse from "pdf-parse/lib/pdf-parse.js";

/**
 * Extracts page-aware text from a PDF buffer.
 *
 * @param {Buffer} buffer - raw PDF file bytes
 * @returns {Promise<{ pageCount: number, pages: { pageNumber: number, text: string }[] }>}
 */
export async function extractPdfPages(buffer) {
  const pages = [];

  // pdf-parse calls `pagerender` once per page, in order, with a
  // pdf.js page proxy. We extract the text content for each page
  // ourselves instead of letting pdf-parse concatenate everything.
  const options = {
    pagerender: async (pageData) => {
      const textContent = await pageData.getTextContent();
      const text = textContent.items.map((item) => item.str).join(" ");
      pages.push({ pageNumber: pages.length + 1, text });
      // Returning the text also keeps pdf-parse's own `.text` field usable
      // as a fallback/debug artifact.
      return text;
    },
  };

  const result = await pdfParse(buffer, options);

  if (!pages.length) {
    // Fallback: some malformed / image-only PDFs may not trigger
    // pagerender per page. Treat the whole doc as a single page.
    if (result.text && result.text.trim().length > 0) {
      pages.push({ pageNumber: 1, text: result.text });
    }
  }

  return {
    pageCount: result.numpages || pages.length,
    pages,
  };
}

/**
 * Returns true if none of the extracted pages contain meaningful text
 * (e.g. a scanned/image-only PDF with no OCR layer).
 */
export function isEffectivelyEmpty(pages) {
  const totalChars = pages.reduce((sum, p) => sum + (p.text || "").trim().length, 0);
  return totalChars < 20;
}
