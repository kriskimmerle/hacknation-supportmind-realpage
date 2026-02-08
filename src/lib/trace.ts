import crypto from "node:crypto";

import { audit, projectDataPath, writeJson, newId } from "@/lib/storage";

function sha256(txt: string): string {
  return crypto.createHash("sha256").update(txt, "utf8").digest("hex");
}

export function writeTraceArtifact(params: {
  ticketNumber?: string;
  scope: string;
  kind: string;
  data: unknown;
}) {
  const tn = (params.ticketNumber || "").trim();
  const file = `${params.kind}-${Date.now()}-${newId("t")}.json`;
  const p = tn
    ? projectDataPath("traces", tn, params.scope, file)
    : projectDataPath("traces", "_global", params.scope, file);
  writeJson(p, params.data);
  return p;
}

export function traceLLMCall(params: {
  ticketNumber?: string;
  stage: string;
  model: string;
  input: string;
  outputText: string;
  durationMs: number;
  parseOk?: boolean;
  artifactPath?: string;
}) {
  const inputPreview = params.input.slice(0, 700);
  const outputPreview = params.outputText.slice(0, 700);
  audit({
    type: "llm_call",
    ticketNumber: params.ticketNumber,
    ok: true,
    summary: `${params.stage} via ${params.model} (${params.durationMs}ms)`,
    payload: {
      stage: params.stage,
      model: params.model,
      durationMs: params.durationMs,
      inputChars: params.input.length,
      outputChars: params.outputText.length,
      inputSha256: sha256(params.input),
      outputSha256: sha256(params.outputText),
      parseOk: typeof params.parseOk === "boolean" ? params.parseOk : undefined,
      inputPreview,
      outputPreview,
      artifactPath: params.artifactPath || "",
    },
  });
}
