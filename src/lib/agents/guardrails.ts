import { getOpenAI } from "@/lib/openai";

export type GuardrailResult = {
  ok: boolean;
  reasons: string[];
  moderation?: unknown;
};

export async function runGuardrails(params: {
  content: string;
  context: { ticketNumber?: string; kbDraftId?: string };
}): Promise<GuardrailResult> {
  const client = getOpenAI();
  const mod = await client.moderations.create({
    model: "omni-moderation-latest",
    input: params.content,
  });

  const flagged = mod.results.some((r) => r.flagged);
  const reasons: string[] = [];
  if (flagged) reasons.push("OpenAI moderation flagged this content.");

  // Lightweight additional checks aligned to prompt expectations.
  if (params.content.includes("<")) {
    // placeholders are expected; no action.
  }
  if (/\b(card number|cvv|ssn|password)\b/i.test(params.content)) {
    reasons.push("Potential sensitive data handling issue (PCI/credentials). Review required.");
  }

  return { ok: reasons.length === 0, reasons, moderation: mod };
}
