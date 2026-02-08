import { getOpenAI } from "@/lib/openai";
import { writeTraceArtifact } from "@/lib/trace";

export type GuardrailResult = {
  ok: boolean;
  reasons: string[];
  moderation?: unknown;
  artifactPath?: string;
  citationCheck?: CitationCheckResult;
};

export type CitationCheckResult = {
  hasCitations: boolean;
  citationsFound: string[];
  requiresCitation: boolean;
  sensitiveTopics: string[];
};

// Topics that REQUIRE citations - no hallucination allowed
const SENSITIVE_TOPICS = [
  { pattern: /fair housing|fha|discrimination|protected class/i, topic: "Fair Housing/FHA" },
  { pattern: /legal|lawsuit|litigation|attorney|court/i, topic: "Legal/Compliance" },
  { pattern: /refund|charge|fee|payment|billing/i, topic: "Financial/Billing" },
  { pattern: /eviction|terminate|lease break/i, topic: "Eviction/Lease" },
  { pattern: /ada|accessibility|disability|accommodation/i, topic: "ADA/Accessibility" },
  { pattern: /hipaa|medical|health information/i, topic: "HIPAA/Medical" },
  { pattern: /security deposit|withhold|deduction/i, topic: "Security Deposits" },
];

// Citation patterns we accept
const CITATION_PATTERNS = [
  /KB[-_]?\d+/i,           // KB-123, KB_456, KB123
  /Script[-_]?\d+/i,       // Script-123, SCRIPT_456
  /Ticket[-_]?\d+/i,       // Ticket-789
  /Article[-_]?ID[:\s]+\S+/i, // Article ID: xxx
  /Source:\s*\S+/i,        // Source: xxx
  /\[KB:[^\]]+\]/i,        // [KB: xxx]
  /\[Script:[^\]]+\]/i,    // [Script: xxx]
  /\[Ticket:[^\]]+\]/i,    // [Ticket: xxx]
];

/**
 * Check if content has required citations for sensitive topics
 */
export function checkCitations(content: string): CitationCheckResult {
  const sensitiveTopics: string[] = [];
  for (const { pattern, topic } of SENSITIVE_TOPICS) {
    if (pattern.test(content)) {
      sensitiveTopics.push(topic);
    }
  }
  
  const citationsFound: string[] = [];
  for (const pattern of CITATION_PATTERNS) {
    const matches = content.match(new RegExp(pattern.source, 'gi'));
    if (matches) {
      citationsFound.push(...matches);
    }
  }
  
  const requiresCitation = sensitiveTopics.length > 0;
  const hasCitations = citationsFound.length > 0;
  
  return {
    hasCitations,
    citationsFound: [...new Set(citationsFound)], // dedupe
    requiresCitation,
    sensitiveTopics,
  };
}

export async function runGuardrails(params: {
  content: string;
  context: { ticketNumber?: string; kbDraftId?: string; scriptId?: string };
}): Promise<GuardrailResult> {
  const client = getOpenAI();
  const mod = await client.moderations.create({
    model: "omni-moderation-latest",
    input: params.content,
  });

  const flagged = mod.results.some((r) => r.flagged);
  const reasons: string[] = [];
  if (flagged) reasons.push("OpenAI moderation flagged this content.");
  
  // Citation enforcement - CRITICAL for compliance
  const citationCheck = checkCitations(params.content);
  if (citationCheck.requiresCitation && !citationCheck.hasCitations) {
    reasons.push(
      `CITATION REQUIRED: Content covers sensitive topics (${citationCheck.sensitiveTopics.join(", ")}) ` +
      `but has no source citations. Must cite KB article, Script, or Ticket as evidence.`
    );
  }

  // Lightweight additional checks aligned to prompt expectations.
  if (params.content.includes("<")) {
    // placeholders are expected; no action.
  }
  if (/\b(card number|cvv|ssn|password)\b/i.test(params.content)) {
    reasons.push("Potential sensitive data handling issue (PCI/credentials). Review required.");
  }

  // PII-ish detection for enterprise demo (synthetic-safe but demonstrates policy).
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(params.content)) {
    reasons.push("Potential PII: email address detected in content.");
  }
  if (/\b\+?1?[-.\s]?(\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}\b/.test(params.content)) {
    reasons.push("Potential PII: phone number detected in content.");
  }
  if (/https?:\/\//i.test(params.content)) {
    reasons.push("External link detected. For compliance, require review before publishing.");
  }

  // Consistency checks: if ticket links a script, KB should mention it.
  const scriptId = (params.context.scriptId || "").trim();
  if (scriptId && !params.content.includes(scriptId)) {
    reasons.push(`Script_ID ${scriptId} present on ticket but not referenced in KB draft.`);
  }

  const artifactPath = writeTraceArtifact({
    ticketNumber: params.context.ticketNumber,
    scope: "guardrail",
    kind: "moderation",
    data: {
      model: "omni-moderation-latest",
      context: params.context,
      contentChars: params.content.length,
      contentPreview: params.content.slice(0, 900),
      moderation: mod,
      citationCheck,
      reasons,
      ok: reasons.length === 0,
    },
  });

  return { ok: reasons.length === 0, reasons, moderation: mod, artifactPath, citationCheck };
}
