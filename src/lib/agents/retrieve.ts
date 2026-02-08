import { getCorpora, type CorpusType } from "@/lib/corpus";
import type { EvidenceCitation } from "@/lib/agents/types";

export function retrieveEvidence(params: {
  query: string;
  corpus: CorpusType;
  k?: number;
}): EvidenceCitation[] {
  const { query, corpus, k = 5 } = params;
  const corpora = getCorpora();
  const hits = corpora[corpus].index.search(query, k);
  return hits.map((h) => ({
    sourceType: corpus,
    sourceId: h.id,
    score: h.score,
    snippet: h.snippet,
    title: h.meta?.title || h.meta?.subject,
  }));
}
