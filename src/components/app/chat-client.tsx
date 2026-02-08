"use client";

import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ChatMsg =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; citations?: Array<{ sourceType: string; sourceId: string; score: number }> };

export function ChatClient() {
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "Ask me about a support issue. I will retrieve evidence from KB/Scripts/Tickets and respond with citations.",
    },
  ]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const canSend = text.trim().length > 0 && !busy;

  async function send() {
    const content = text.trim();
    if (!content) return;
    setText("");
    setBusy(true);
    setMsgs((m) => [...m, { role: "user", content }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: content }),
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
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Chat</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <ScrollArea className="h-[520px] rounded-md border bg-muted/30 p-3">
          <div className="grid gap-3">
            {msgs.map((m, idx) => (
              <div key={idx} className="grid gap-2 animate-in fade-in slide-in-from-bottom-1 duration-500">
                <div className="text-xs text-muted-foreground">
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
                      <Badge key={`${c.sourceType}-${c.sourceId}`} variant="secondary" className="font-mono">
                        {c.sourceType}:{c.sourceId}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex gap-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ask about an issue… (Enter = send, Shift+Enter = new line)"
            className="min-h-[44px] max-h-[160px] resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Button onClick={send} disabled={!canSend} className="h-[44px]">
            {busy ? "..." : "Send"}
          </Button>
        </div>
      </CardContent>
    </Card>
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
