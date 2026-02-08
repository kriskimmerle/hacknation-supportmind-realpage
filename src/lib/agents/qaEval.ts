import { getOpenAI } from "@/lib/openai";
import { loadWorkbook, getQaPromptText } from "@/lib/dataset";

export async function runQaEvaluation(params: {
  ticketNumber: string;
  transcript?: string;
  ticketFields: Record<string, string>;
}) {
  const wb = loadWorkbook();
  const rubric = getQaPromptText(wb);
  if (!rubric) throw new Error("QA rubric prompt not found in dataset.");

  const prompt = `${rubric}\n\n---\nEVIDENCE PAYLOAD\n\nTicket_Number: ${params.ticketNumber}\n\nTICKET_FIELDS(JSON):\n${JSON.stringify(params.ticketFields, null, 2)}\n\nTRANSCRIPT (if any):\n${(params.transcript || "").slice(0, 8000)}\n\nReturn ONLY the JSON object described in the Output Format.`;

  const client = getOpenAI();
  const resp = await client.responses.create({
    model: "gpt-4.1-mini",
    input: prompt,
  });

  const text = resp.output_text;
  const json = safeJsonParse(text);
  if (!json || typeof json !== "object") {
    throw new Error(`QA evaluation did not return JSON. Raw: ${text.slice(0, 400)}`);
  }
  return json;
}

function safeJsonParse(s: string): unknown {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch {
    return null;
  }
}
