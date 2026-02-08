import { getCorpora, type CorpusType } from "@/lib/corpus";
import type { EvidenceCitation } from "@/lib/agents/types";
import { classifyIntent, getCorpusWeights, type IntentClassification } from "./intentRouter";

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

/**
 * Smart retrieval that uses intent classification to search across corpora
 * with appropriate weighting based on query intent.
 */
export function retrieveWithIntent(params: {
  query: string;
  k?: number;
}): {
  classification: IntentClassification;
  results: EvidenceCitation[];
} {
  const { query, k = 5 } = params;
  const classification = classifyIntent(query);
  const weights = getCorpusWeights(classification);
  const corpora = getCorpora();
  
  // Collect results from each corpus, weighted
  const allResults: Array<EvidenceCitation & { weightedScore: number }> = [];
  
  for (const [corpusType, weight] of Object.entries(weights)) {
    if (weight <= 0) continue;
    
    const corpus = corpora[corpusType as CorpusType];
    const hits = corpus.index.search(query, k);
    
    for (const h of hits) {
      allResults.push({
        sourceType: corpusType as CorpusType,
        sourceId: h.id,
        score: h.score,
        snippet: h.snippet,
        title: h.meta?.title || h.meta?.subject,
        weightedScore: h.score * weight,
      });
    }
  }
  
  // Sort by weighted score and deduplicate by sourceId
  allResults.sort((a, b) => b.weightedScore - a.weightedScore);
  
  const seen = new Set<string>();
  const deduped: EvidenceCitation[] = [];
  
  for (const r of allResults) {
    const key = `${r.sourceType}:${r.sourceId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { weightedScore, ...citation } = r;
    deduped.push(citation);
    if (deduped.length >= k) break;
  }
  
  return {
    classification,
    results: deduped,
  };
}
