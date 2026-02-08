export type Doc = {
  id: string;
  text: string;
  meta?: Record<string, string>;
};

export type SearchHit = {
  id: string;
  score: number;
  snippet: string;
  meta?: Record<string, string>;
};

type IndexDoc = {
  id: string;
  tokens: string[];
  tf: Map<string, number>;
  len: number;
  text: string;
  meta?: Record<string, string>;
};

export class BM25Index {
  private docs: IndexDoc[];
  private df: Map<string, number>;
  private avgdl: number;
  private k1: number;
  private b: number;

  constructor(docs: Doc[], opts?: { k1?: number; b?: number }) {
    this.k1 = opts?.k1 ?? 1.2;
    this.b = opts?.b ?? 0.75;
    this.df = new Map();
    this.docs = docs.map((d) => {
      const tokens = tokenize(d.text);
      const tf = new Map<string, number>();
      for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
      for (const t of new Set(tokens)) this.df.set(t, (this.df.get(t) || 0) + 1);
      return { id: d.id, tokens, tf, len: tokens.length, text: d.text, meta: d.meta };
    });
    const totalLen = this.docs.reduce((s, d) => s + d.len, 0);
    this.avgdl = this.docs.length ? totalLen / this.docs.length : 0;
  }

  search(query: string, k: number = 5): SearchHit[] {
    const qTokens = Array.from(new Set(tokenize(query)));
    if (!qTokens.length) return [];

    const N = this.docs.length;
    const scores: Array<{ id: string; score: number; doc: IndexDoc }> = [];

    for (const doc of this.docs) {
      let score = 0;
      for (const t of qTokens) {
        const df = this.df.get(t) || 0;
        if (df === 0) continue;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        const tf = doc.tf.get(t) || 0;
        if (tf === 0) continue;
        const denom = tf + this.k1 * (1 - this.b + (this.b * doc.len) / (this.avgdl || 1));
        score += idf * ((tf * (this.k1 + 1)) / denom);
      }
      if (score > 0) scores.push({ id: doc.id, score, doc });
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, k).map((s) => ({
      id: s.id,
      score: round3(s.score),
      snippet: makeSnippet(s.doc.text, query),
      meta: s.doc.meta,
    }));
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_<>]+/g)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

function makeSnippet(text: string, query: string): string {
  const q = tokenize(query);
  if (!q.length) return text.slice(0, 180);
  const lower = text.toLowerCase();
  let best = -1;
  for (const t of q) {
    const idx = lower.indexOf(t);
    if (idx !== -1 && (best === -1 || idx < best)) best = idx;
  }
  if (best === -1) return text.slice(0, 180);
  const start = Math.max(0, best - 60);
  const end = Math.min(text.length, best + 120);
  const snip = text.slice(start, end).replace(/\s+/g, " ").trim();
  return (start > 0 ? "..." : "") + snip + (end < text.length ? "..." : "");
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
