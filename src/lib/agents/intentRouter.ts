/**
 * Intent Router - Classifies incoming queries to route to the appropriate corpus
 * 
 * Three answer types:
 * - KB: Knowledge base questions (policies, explanations, documentation)
 * - SCRIPT: Procedural/how-to questions (step-by-step instructions)
 * - TICKET_RESOLUTION: Historical case questions (past resolutions, examples)
 */

import type { CorpusType } from "@/lib/corpus";

export type IntentClassification = {
  primaryCorpus: CorpusType;
  confidence: number;
  reasoning: string;
  secondaryCorpora: CorpusType[];
};

// Keywords that strongly indicate each corpus type
const KB_KEYWORDS = [
  "what is", "explain", "policy", "rule", "regulation", "requirement",
  "definition", "mean", "overview", "about", "documentation", "article",
  "guide", "reference", "information", "detail", "describe", "understanding",
];

const SCRIPT_KEYWORDS = [
  "how to", "how do i", "steps", "procedure", "process", "instructions",
  "walkthrough", "tutorial", "setup", "configure", "install", "run",
  "execute", "perform", "complete", "follow", "do i", "can i",
  "script", "workflow", "method", "approach",
];

const TICKET_KEYWORDS = [
  "previous", "past", "similar", "example", "case", "ticket", "issue",
  "resolved", "fixed", "solution", "workaround", "before", "history",
  "incident", "problem", "error", "bug", "occurred", "happened",
];

function countKeywordMatches(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter(kw => lower.includes(kw)).length;
}

/**
 * Classifies a query to determine which corpus to search first
 * Uses keyword matching for fast, deterministic routing
 */
export function classifyIntent(query: string): IntentClassification {
  const kbScore = countKeywordMatches(query, KB_KEYWORDS);
  const scriptScore = countKeywordMatches(query, SCRIPT_KEYWORDS);
  const ticketScore = countKeywordMatches(query, TICKET_KEYWORDS);
  
  const total = kbScore + scriptScore + ticketScore;
  const maxScore = Math.max(kbScore, scriptScore, ticketScore);
  
  // Default to KB if no strong signals
  if (total === 0) {
    return {
      primaryCorpus: "KB",
      confidence: 0.5,
      reasoning: "No strong intent signals; defaulting to knowledge base",
      secondaryCorpora: ["SCRIPT", "TICKET_RESOLUTION"],
    };
  }
  
  const confidence = total > 0 ? maxScore / total : 0.5;
  
  // Determine primary corpus
  let primaryCorpus: CorpusType;
  let reasoning: string;
  let secondaryCorpora: CorpusType[];
  
  if (scriptScore === maxScore) {
    primaryCorpus = "SCRIPT";
    reasoning = `Procedural intent detected (${scriptScore} script keywords)`;
    secondaryCorpora = kbScore >= ticketScore ? ["KB", "TICKET_RESOLUTION"] : ["TICKET_RESOLUTION", "KB"];
  } else if (ticketScore === maxScore) {
    primaryCorpus = "TICKET_RESOLUTION";
    reasoning = `Historical case intent detected (${ticketScore} ticket keywords)`;
    secondaryCorpora = kbScore >= scriptScore ? ["KB", "SCRIPT"] : ["SCRIPT", "KB"];
  } else {
    primaryCorpus = "KB";
    reasoning = `Knowledge base intent detected (${kbScore} KB keywords)`;
    secondaryCorpora = scriptScore >= ticketScore ? ["SCRIPT", "TICKET_RESOLUTION"] : ["TICKET_RESOLUTION", "SCRIPT"];
  }
  
  return {
    primaryCorpus,
    confidence: Math.round(confidence * 100) / 100,
    reasoning,
    secondaryCorpora,
  };
}

/**
 * Multi-corpus retrieval with intent-based weighting
 * Returns results from all corpora, weighted by intent classification
 */
export function getCorpusWeights(classification: IntentClassification): Record<CorpusType, number> {
  const { primaryCorpus, secondaryCorpora, confidence } = classification;
  
  // Primary corpus gets the highest weight
  const primaryWeight = 0.5 + (confidence * 0.3); // 0.5 to 0.8
  const remainingWeight = 1 - primaryWeight;
  
  const weights: Record<CorpusType, number> = {
    KB: 0,
    SCRIPT: 0,
    TICKET_RESOLUTION: 0,
  };
  
  weights[primaryCorpus] = primaryWeight;
  
  // Distribute remaining weight to secondary corpora
  if (secondaryCorpora.length > 0) {
    const secondaryWeight = remainingWeight * 0.7;
    const tertiaryWeight = remainingWeight * 0.3;
    weights[secondaryCorpora[0]] = secondaryWeight;
    if (secondaryCorpora[1]) {
      weights[secondaryCorpora[1]] = tertiaryWeight;
    }
  }
  
  return weights;
}
