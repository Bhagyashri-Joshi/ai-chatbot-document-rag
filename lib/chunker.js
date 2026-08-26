// lib/chunker.js
// Responsible for: text -> chunks (TRD section 15/16). Must not contain
// database logic.
//
// Implements a RecursiveCharacterTextSplitter, matching the well-known
// LangChain algorithm: try to split on the largest separator first
// (paragraphs), then fall back to smaller separators (lines, sentences,
// words, characters) whenever a piece is still too big, so chunks break at
// natural boundaries whenever possible.
//
// TOKEN <-> CHARACTER APPROXIMATION:
// pdf text is split by character count, not real tokenizer tokens. As a
// documented approximation we use ~4 characters per token (a common rule of
// thumb for English text with Gemini tokenizers). So:
//   chunk size:  1200 tokens ≈ 4800 characters
//   overlap:     200 tokens  ≈ 800 characters
// These are configurable via CHUNK_SIZE / CHUNK_OVERLAP env vars (expressed
// in tokens, converted to characters internally).

const CHARS_PER_TOKEN = 4;

const DEFAULT_CHUNK_SIZE_TOKENS = parseInt(process.env.CHUNK_SIZE || "1200", 10);
const DEFAULT_CHUNK_OVERLAP_TOKENS = parseInt(process.env.CHUNK_OVERLAP || "200", 10);

const DEFAULT_SEPARATORS = ["\n\n", "\n", ". ", " ", ""];

function splitOnSeparator(text, separator) {
  if (separator === "") {
    return text.split("");
  }
  return text.split(separator);
}

/**
 * Recursively splits `text` into chunks no larger than `chunkSizeChars`,
 * preferring to break on the earliest separator in `separators` that
 * successfully produces small-enough pieces.
 */
function recursiveSplit(text, chunkSizeChars, separators) {
  if (text.length <= chunkSizeChars) {
    return [text];
  }

  const [separator, ...restSeparators] = separators;

  // If we've run out of separators, hard-cut by character count.
  if (separator === undefined) {
    const pieces = [];
    for (let i = 0; i < text.length; i += chunkSizeChars) {
      pieces.push(text.slice(i, i + chunkSizeChars));
    }
    return pieces;
  }

  const rawPieces = splitOnSeparator(text, separator).filter((p) => p.length > 0);

  // Re-glue the separator back on (except for the empty-string separator,
  // which splits into individual characters).
  const pieces =
    separator === ""
      ? rawPieces
      : rawPieces.map((p, i) => (i < rawPieces.length - 1 ? p + separator : p));

  const results = [];
  for (const piece of pieces) {
    if (piece.length <= chunkSizeChars) {
      results.push(piece);
    } else {
      results.push(...recursiveSplit(piece, chunkSizeChars, restSeparators));
    }
  }
  return results;
}

/**
 * Merges small adjacent pieces into chunks close to (but not exceeding)
 * chunkSizeChars, inserting `overlapChars` of trailing context from the
 * previous chunk at the start of the next one.
 */
function mergeWithOverlap(pieces, chunkSizeChars, overlapChars) {
  const chunks = [];
  let current = "";

  for (const piece of pieces) {
    if ((current + piece).length <= chunkSizeChars) {
      current += piece;
    } else {
      if (current.length > 0) {
        chunks.push(current);
      }
      // Start the next chunk with overlap from the tail of the previous one.
      const overlapText =
        overlapChars > 0 && current.length > 0
          ? current.slice(Math.max(0, current.length - overlapChars))
          : "";
      current = overlapText + piece;

      // Edge case: a single piece bigger than chunkSizeChars on its own
      // (recursiveSplit should normally prevent this, but guard anyway).
      while (current.length > chunkSizeChars) {
        chunks.push(current.slice(0, chunkSizeChars));
        current = current.slice(chunkSizeChars - overlapChars);
      }
    }
  }
  if (current.trim().length > 0) {
    chunks.push(current);
  }
  return chunks;
}

/**
 * Splits a single page's text into overlapping chunks.
 *
 * @param {string} text
 * @param {{ chunkSizeTokens?: number, overlapTokens?: number }} [options]
 * @returns {string[]} array of chunk strings
 */
export function splitText(text, options = {}) {
  const chunkSizeTokens = options.chunkSizeTokens ?? DEFAULT_CHUNK_SIZE_TOKENS;
  const overlapTokens = options.overlapTokens ?? DEFAULT_CHUNK_OVERLAP_TOKENS;

  const chunkSizeChars = chunkSizeTokens * CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;

  const trimmed = (text || "").trim();
  if (!trimmed) return [];

  const pieces = recursiveSplit(trimmed, chunkSizeChars, DEFAULT_SEPARATORS);
  const merged = mergeWithOverlap(pieces, chunkSizeChars, overlapChars);

  return merged.map((c) => c.trim()).filter((c) => c.length > 0);
}

/**
 * Chunks an array of page-aware text ({ pageNumber, text }) into an array
 * of chunk metadata objects, preserving the originating page number for
 * each chunk and assigning a document-wide chunkIndex (TRD section 16).
 *
 * @param {{ pageNumber: number, text: string }[]} pages
 * @param {{ chunkSizeTokens?: number, overlapTokens?: number }} [options]
 * @returns {{ content: string, chunkIndex: number, pageNumber: number, startChar: number, endChar: number }[]}
 */
export function chunkPages(pages, options = {}) {
  const allChunks = [];
  let chunkIndex = 0;

  for (const page of pages) {
    const pageChunks = splitText(page.text, options);
    let cursor = 0;
    for (const content of pageChunks) {
      const startChar = page.text.indexOf(content, Math.max(0, cursor - 50));
      const endChar = startChar >= 0 ? startChar + content.length : -1;
      if (startChar >= 0) cursor = startChar + content.length;

      allChunks.push({
        content,
        chunkIndex: chunkIndex++,
        pageNumber: page.pageNumber,
        startChar: startChar >= 0 ? startChar : null,
        endChar: endChar >= 0 ? endChar : null,
      });
    }
  }

  return allChunks;
}

export default { splitText, chunkPages };
