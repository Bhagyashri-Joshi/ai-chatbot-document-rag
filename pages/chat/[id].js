// pages/chat/[id].js
// Chat page (TRD section 37): document selector context, chat history,
// question input, streaming response, sources.
//
// Since fetch's streaming body reader is more broadly compatible than
// EventSource for POST requests (EventSource only supports GET), we read
// the SSE stream manually from the fetch Response body and parse
// `data: {...}\n\n` frames ourselves.

import { getServerSession } from "next-auth/next";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { authOptions } from "../../lib/auth";
import { prisma } from "../../lib/db";
import ChatMessage from "../../components/ChatMessage";

export async function getServerSideProps(context) {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session) {
    return { redirect: { destination: "/", permanent: false } };
  }

  const { id } = context.params;
  const document = await prisma.document.findUnique({ where: { id } });

  if (!document || document.userId !== session.user.id) {
    return { notFound: true };
  }

  return {
    props: {
      document: JSON.parse(JSON.stringify(document)),
    },
  };
}

export default function ChatPage({ document }) {
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [retrievedChunks, setRetrievedChunks] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e) {
    e.preventDefault();
    const question = input.trim();
    if (!question || isSending) return;

    setInput("");
    setIsSending(true);
    setRetrievedChunks(null);

    const userMsg = { role: "user", content: question };
    const assistantMsg = { role: "assistant", content: "", sources: [], isStreaming: true };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: document.id, message: question }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Request failed");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop(); // keep incomplete trailing frame in buffer

        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const event = JSON.parse(line.slice("data: ".length));
          handleEvent(event);
        }
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        last.content = "The AI service could not generate a response. Please try again.";
        last.isStreaming = false;
        return next;
      });
    } finally {
      setIsSending(false);
    }
  }

  function handleEvent(event) {
    if (event.type === "chunks") {
      setRetrievedChunks(event.chunks);
      return;
    }

    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];

      if (event.type === "token") {
        last.content += event.text;
      } else if (event.type === "sources") {
        last.sources = event.sources;
      } else if (event.type === "done") {
        last.isStreaming = false;
      } else if (event.type === "error") {
        last.content = event.message;
        last.isStreaming = false;
      }
      return next;
    });
  }

  return (
    <div className="page chat-page">
      <div className="page-header">
        <div>
          <Link href="/" className="btn" style={{ marginBottom: 8, display: "inline-block" }}>
            ← Dashboard
          </Link>
          <h1>{document.name}</h1>
          <p className="chat-page__subtitle">{document.pageCount} pages · Ask anything from this document</p>
        </div>
      </div>

      {process.env.NODE_ENV !== "production" && retrievedChunks && (
        <div className="card chat-page__debug">
          <div className="section-title">Retrieved Chunks (dev only)</div>
          <ol>
            {retrievedChunks.map((c, i) => (
              <li key={i}>
                {c.documentName} — Page {c.pageNumber} — similarity {c.similarity.toFixed(2)}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="card chat-page__history" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="empty-state">Ask a question to get started, e.g. &ldquo;What is this document about?&rdquo;</div>
        )}
        {messages.map((m, i) => (
          <ChatMessage
            key={i}
            role={m.role}
            content={m.content}
            sources={m.sources}
            isStreaming={m.isStreaming}
            isLoading={m.isStreaming && m.content === ""}
          />
        ))}
      </div>

      <form className="chat-page__input-row" onSubmit={sendMessage}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about this document…"
          disabled={isSending}
        />
        <button className="btn chat-page__send" type="submit" disabled={isSending || !input.trim()}>
          Send
        </button>
      </form>

      <style jsx>{`
        .chat-page__subtitle {
          font-size: 13px;
          color: #6b7280;
          margin: 4px 0 0;
        }
        .chat-page__history {
          min-height: 320px;
          max-height: 55vh;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }
        .chat-page__debug ol {
          margin: 0;
          padding-left: 20px;
          font-size: 13px;
          color: #4b5563;
        }
        .chat-page__input-row {
          display: flex;
          gap: 10px;
        }
        .chat-page__input-row input {
          flex: 1;
          padding: 12px 14px;
          border-radius: 10px;
          border: 1px solid #d1d5db;
          font-size: 14px;
        }
        .chat-page__send {
          background: #4f46e5;
          color: #fff;
          border: none;
        }
      `}</style>
    </div>
  );
}
