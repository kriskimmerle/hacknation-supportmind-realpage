"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

import { MessageCircle, X, Sparkles } from "lucide-react";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ChatMsg =
  | { role: "user"; content: string }
  | {
      role: "assistant";
      content: string;
      citations?: Array<{ sourceType: string; sourceId: string; score: number }>;
    };

type ChatIntentEvent = CustomEvent<{ message?: string; autoSend?: boolean; openOnly?: boolean }>;

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "I can answer using KB / Scripts / prior Ticket resolutions with citations. Ask a question, or use “Ask Agent” from a case.",
    },
  ]);

  const canSend = text.trim().length > 0 && !busy;
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const suggestions = useMemo(
    () => [
      "What script should I run for a Certifications workflow block?",
      "Date advance fails due to invalid backend reference — what’s the verified fix?",
      "Write a KB outline with required inputs and verification steps.",
    ],
    []
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length, open]);

  const sendMessage = useCallback(async (content: string) => {
    const msg = content.trim();
    if (!msg) return;
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", content: msg }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      if (!res.ok) throw new Error(await res.text());
      const out = (await res.json()) as {
        answer: string;
        citations: Array<{ sourceType: string; sourceId: string; score: number }>;
      };
      setMsgs((m) => [...m, { role: "assistant", content: out.answer, citations: out.citations }]);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    function onIntent(e: Event) {
      const ev = e as ChatIntentEvent;
      const msg = (ev.detail?.message || "").trim();
      setOpen(true);
      // If autoSend, don't leave the structured prompt sitting in the input.
      if (msg && !ev.detail?.autoSend) setText(msg);
      if (msg && ev.detail?.autoSend) {
        // queue so input state is set first
        setTimeout(() => {
          sendMessage(msg);
        }, 0);
        setText("");
      }
    }
    window.addEventListener("supportmind:chat", onIntent as EventListener);
    return () => window.removeEventListener("supportmind:chat", onIntent as EventListener);
  }, [sendMessage]);

  async function send(explicit?: string) {
    const content = (explicit ?? text).trim();
    if (!content) return;
    if (!explicit) setText("");
    await sendMessage(content);
  }

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-50"
          aria-hidden="true"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="fixed bottom-5 right-5 z-50">
        {open ? (
          <div
            className="w-[94vw] max-w-[480px] animate-in fade-in slide-in-from-bottom-3 duration-300 fx-gradient-border rounded-3xl p-[1px]"
            onClick={(e) => e.stopPropagation()}
          >
            <Card className="fx-glass fx-ring overflow-hidden rounded-3xl border-border/60">
            <CardHeader className="py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[rgb(var(--fx-cyan))]" />
                  <CardTitle className="text-sm">SupportMind Agent</CardTitle>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    citations
                  </Badge>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => setOpen(false)}
                  aria-label="Close chat"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="grid gap-3 pb-3">
              <ScrollArea className="h-[360px] rounded-xl border bg-muted/30 p-3">
                <div className="grid gap-3">
                  {msgs.map((m, idx) => (
                    <div key={idx} className="grid gap-2">
                      <div className="text-[10px] text-muted-foreground">
                        {m.role === "user" ? "You" : "Agent"}
                      </div>
                      <div
                        className={
                          m.role === "user"
                            ? "ml-auto max-w-[92%] rounded-2xl border bg-background/80 p-3 text-sm leading-6 shadow-sm"
                            : "mr-auto max-w-[92%] rounded-2xl border bg-card/70 backdrop-blur-xl p-3 text-sm leading-6 shadow-sm"
                        }
                      >
                        {m.role === "assistant" ? (
                          <MarkdownText text={m.content} />
                        ) : (
                          <div className="whitespace-pre-wrap">{m.content}</div>
                        )}
                      </div>
                      {m.role === "assistant" && m.citations && m.citations.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {m.citations.slice(0, 6).map((c) => (
                            <Badge
                              key={`${c.sourceType}-${c.sourceId}`}
                              variant="secondary"
                              className="font-mono text-[10px]"
                            >
                              {c.sourceType}:{c.sourceId}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
              </ScrollArea>

              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    className="rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground transition hover:bg-foreground/5"
                    onClick={() => {
                      setText(s);
                    }}
                    type="button"
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Ask about an issue… (Enter = send, Shift+Enter = new line)"
                  className="min-h-[44px] max-h-[140px] resize-none bg-background/70"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <Button className="h-[44px]" onClick={() => send()} disabled={!canSend}>
                  {busy ? "…" : "Send"}
                </Button>
              </div>
            </CardContent>
          </Card>
          </div>
        ) : (
          <Button
            onClick={() => setOpen(true)}
            className="h-14 w-14 rounded-2xl fx-ring bg-gradient-to-br from-[rgba(var(--fx-cyan),0.95)] via-[rgba(var(--fx-mint),0.75)] to-[rgba(var(--fx-amber),0.75)] hover:opacity-95 transition shadow-lg"
            aria-label="Open chat"
          >
            <MessageCircle
              className="h-6 w-6 text-[rgb(var(--fx-ink))] drop-shadow-[0_10px_24px_rgba(0,0,0,0.25)]"
              strokeWidth={2.2}
            />
          </Button>
        )}
      </div>
    </>
  );
}

function MarkdownText(props: { text: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: (p) => <p className="whitespace-pre-wrap">{p.children}</p>,
        ul: (ul) => <ul className="list-disc pl-5 space-y-1">{ul.children}</ul>,
        ol: (ol) => <ol className="list-decimal pl-5 space-y-1">{ol.children}</ol>,
        li: (li) => <li className="whitespace-pre-wrap">{li.children}</li>,
        a: (a) => (
          <a
            href={String(a.href || "#")}
            className="underline underline-offset-4 hover:no-underline text-foreground"
            target="_blank"
            rel="noreferrer"
          >
            {a.children}
          </a>
        ),
        code: (code) => (
          <code className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-[0.9em]">
            {code.children}
          </code>
        ),
        pre: (pre) => (
          <pre className="mt-2 overflow-x-auto rounded-lg border bg-background/60 p-3 text-xs leading-5">
            {pre.children}
          </pre>
        ),
      }}
    >
      {props.text}
    </ReactMarkdown>
  );
}
