# Ralph Runs (SupportMind)

This project follows the Ralph file-based agent loop pattern: each run completes one story and writes evidence to disk.

## Run 1
- Completed: US-001 (Ingest workbook + dataset health endpoints)
- Evidence: `src/lib/dataset.ts`, `src/app/api/health/route.ts`, `src/app/cases/page.tsx`

## Run 2
- Completed: US-003 (Gap detection agent), US-004 (KB drafting + lineage), US-005 (Governance publish/reject)
- Evidence: `src/lib/agents/gapDetector.ts`, `src/app/api/run/gap/route.ts`, `src/lib/agents/kbDraft.ts`, `src/app/api/run/kb-draft/route.ts`, `src/app/api/run/publish/route.ts`

## Run 3
- Completed: US-002 (hit@k eval) and US-006 (QA rubric JSON + guardrails UI)
- Evidence: `src/lib/eval.ts`, `src/app/api/run/eval/route.ts`, `src/lib/agents/qaEval.ts`, `src/app/api/run/qa/route.ts`, `src/app/dashboard/page.tsx`
