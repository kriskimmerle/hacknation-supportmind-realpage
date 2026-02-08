export type EvidenceCitation = {
  sourceType: "KB" | "SCRIPT" | "TICKET_RESOLUTION";
  sourceId: string;
  score: number;
  snippet: string;
  title?: string;
};

export type GapDecision = {
  gapDetected: boolean;
  action: "draft_new_kb" | "patch_existing_kb" | "no_action";
  reason: string;
  answerTypeSuggested: "KB" | "SCRIPT" | "TICKET_RESOLUTION";
  evidence: EvidenceCitation[];
};

export type KBDraft = {
  kbDraftId: string;
  title: string;
  bodyMarkdown: string;
  tags: string[];
  module?: string;
  category?: string;
  requiredInputs: Array<{ placeholder: string; meaning?: string; example?: string }>;
  references: Array<{ type: "SCRIPT" | "KB" | "TICKET"; id: string }>;
  lineage: Array<{
    kbArticleId: string;
    sourceType: "Ticket" | "Conversation" | "Script";
    sourceId: string;
    relationship: "CREATED_FROM" | "REFERENCES";
    evidenceSnippet: string;
  }>;
  modelNotes: string;
};
