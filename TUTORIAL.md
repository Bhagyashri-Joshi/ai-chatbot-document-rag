# Tutorial: Setting Up & Running the Project

This walks through everything needed to get the app running locally and
deployed to Vercel, matching the Deployment Checklist in the TRD.

## 1. Install dependencies

```bash
npm install
```

## 2. Create a Supabase project

1. Go to https://supabase.com and create a new project.
2. In **Project Settings → Database**, copy:
   - the **Connection pooling** URI (port 6543) → this is your `DATABASE_URL`
   - the **direct connection** URI (port 5432) → this is your `DIRECT_URL`
3. Add `?pgbouncer=true` to the end of `DATABASE_URL` if it isn't already
   there.

## 3. Enable pgvector

Prisma will create the `Chunk` table (with an `embedding` column typed as
`vector(1536)`), but the `vector` extension and the similarity index must be
created manually.

1. Run `npx prisma db push` (see step 6) first, so the tables exist.
2. Open the Supabase **SQL Editor** and run the contents of
   `sql/enable-pgvector.sql`. This:
   - runs `CREATE EXTENSION IF NOT EXISTS vector;`
   - verifies the extension is active
   - creates an `ivfflat` index using `vector_cosine_ops` for fast cosine
     similarity search

## 4. Create a Google OAuth app

1. Go to the [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Create an **OAuth 2.0 Client ID** (type: Web application).
3. Add authorized redirect URIs:
   - Local: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://YOUR-VERCEL-DOMAIN/api/auth/callback/google`
4. Copy the **Client ID** and **Client Secret**.

## 5. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in:

```
DATABASE_URL=...
DIRECT_URL=...
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GEMINI_API_KEY=...
```

Never expose these through `NEXT_PUBLIC_` prefixes — they must stay
server-only.

## 6. Push the database schema

```bash
npx prisma generate
npx prisma db push
```

This creates `User`, `Document`, `Chunk`, and the NextAuth
`Account`/`Session`/`VerificationToken` tables. Then go back and run
`sql/enable-pgvector.sql` (step 3) if you haven't already.

## 7. Run locally

```bash
npm run dev
```

Visit http://localhost:3000, sign in with Google, and upload a PDF.

## 8. Test the pipeline end-to-end

This is the single most important test (TRD section 61):

1. Log in.
2. Upload a multi-page PDF.
3. Watch the server logs — you should see:
   ```
   [UPLOAD] file received: ...
   [PDF] extracted N pages
   [CHUNK] created N chunks
   [EMBED] generated embeddings
   [DB] stored N chunks
   ```
4. Once the document shows **Ready**, click **Chat**.
5. Ask a question. You should see:
   - tokens streaming in
   - a "Sources" section with document name + page number
   - (in development mode) a "Retrieved Chunks" debug panel showing
     similarity scores

## 9. Verify user isolation

1. Sign in as a second Google account.
2. Confirm you do **not** see the first user's documents.
3. Try asking a question against a `documentId` that belongs to the other
   user (e.g. via a manual API call) — the API should respond `404 Not
   Found`, never someone else's content.

## 10. Deploy to Vercel

1. Push the repo to GitHub.
2. Import the project in Vercel.
3. Add all environment variables from `.env.local` into the Vercel project
   settings (Production + Preview as needed). Set `NEXTAUTH_URL` to your
   production domain.
4. Update the Google OAuth app with the production callback URL:
   `https://YOUR-VERCEL-DOMAIN/api/auth/callback/google`.
5. Deploy.

### Deployment checklist

```
□ Build succeeds locally (npm run build)
□ Prisma client generated (happens automatically via postinstall)
□ pgvector enabled
□ Database schema applied (prisma db push)
□ Gemini API key configured
□ Google OAuth configured
□ NEXTAUTH_SECRET configured
□ NEXTAUTH_URL configured
□ Vercel environment variables configured
□ Production OAuth callback configured
□ PDF upload tested
□ Vector search tested
□ Gemini streaming tested
```

## Troubleshooting

- **"relation Chunk does not exist"** — run `npx prisma db push` again.
- **Vector search errors mentioning operator `<=>`** — the `vector`
  extension isn't enabled; re-run `sql/enable-pgvector.sql`.
- **Document stuck on "Processing"** — check server logs for
  `[EMBED] GEMINI error`; verify `GEMINI_API_KEY` is valid and has quota.
- **401 on every request** — check `NEXTAUTH_SECRET` / `NEXTAUTH_URL` are
  set and match your current domain.
