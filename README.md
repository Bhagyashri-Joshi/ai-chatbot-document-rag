# AI Chatbot with Document RAG

A Next.js (Pages Router) application that lets a signed-in user upload PDF
documents and ask questions about them, answered by Gemini using a real
Retrieval-Augmented Generation (RAG) pipeline backed by Supabase
PostgreSQL + pgvector.

This is **not** a "PDF → Gemini" chatbot. The pipeline is:

```
PDF → parse → chunk → embed → store vectors → retrieve relevant vectors
    → construct context → Gemini → stream answer → cite sources
```

## Tech Stack

- **Frontend:** Next.js (Pages Router), React
- **Backend:** Next.js API routes
- **Auth:** NextAuth (Google OAuth provider)
- **Database:** Supabase PostgreSQL + pgvector
- **Embeddings:** Gemini `text-embedding-3-small` (1536 dimensions)
- **Generation:**  Gemini, streamed via Server-Sent Events

## Project Structure

```
components/       ChatMessage, ChunkSourceList, DocumentCard, PdfUploader
lib/               chunker, embedder, vectorSearch, Gemini, db, auth, pdfParser, fileHash
pages/             index.js (dashboard), documents.js, chat/[id].js
pages/api/         auth/[...nextauth], documents/*, chat, search
prisma/            schema.prisma
sql/               enable-pgvector.sql
```

## Quick Start

See **TUTORIAL.md** for full step-by-step setup (Supabase project creation,
Google OAuth app, environment variables, running locally, and deploying to
Vercel).

```bash
npm install
cp .env.example .env.local   # fill in real values
npx prisma db push           # create tables in Supabase
# then run sql/enable-pgvector.sql in the Supabase SQL editor
npm run dev
```

## Key Design Decisions

- **User isolation:** every document and chunk row is tagged with `userId`.
  Every retrieval query filters `WHERE user_id = <session user>` so one
  user's vectors are never visible to another (see `lib/vectorSearch.js`).
- **Page-aware chunking:** the PDF parser preserves page boundaries so every
  chunk — and therefore every citation — can point back to a specific page
  (`lib/pdfParser.js`, `lib/chunker.js`).
- **pgvector via raw SQL:** Prisma doesn't support the `vector` column type
  natively, so it's declared as `Unsupported("vector(1536)")` in
  `schema.prisma`, and all reads/writes go through parameterized
  `$queryRawUnsafe` / `$executeRawUnsafe` calls.
- **Bounded context:** the RAG pipeline never sends an entire document to
  Gemini — only the top-K (default 5) most relevant chunks, sorted back into
  document/page order and capped by a character budget
  (`lib/geminiRAG.js`).
- **Streaming:** `/api/chat` responds with Server-Sent Events
  (`token`, `sources`, `done`, `error`), consumed manually on the client via
  `fetch` + a streaming body reader (see `pages/chat/[id].js`).

## Environment Variables

See `.env.example` for the full list. At minimum you need:

```
- DATABASE_URL
- DIRECT_URL
- NEXTAUTH_SECRET
- NEXTAUTH_URL
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GEMINI_API_KEY


## License

MIT — use freely for learning/demo purposes.
