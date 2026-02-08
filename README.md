# SupportMind Learning Loop (Local Demo)

This app demonstrates a self-learning support intelligence layer over the synthetic workbook `SupportMind__Final_Data.xlsx`.

It covers the problem statement end-to-end:
- Knowledge gap detection with evidence
- KB drafting from resolved cases + scripts
- Governance (approve/reject) + provenance (lineage)
- QA coaching using the provided rubric prompt + autozero/red flags
- Deterministic retrieval evaluation using `Questions.Answer_Type` + `Target_ID`

## Prereqs

- Node 20+
- `OPENAI_API_KEY` set in your shell

Dataset:
- The workbook is expected at `SupportMind__Final_Data.xlsx` in repo root.
- You can override this with `DATASET_PATH=/absolute/path/to/SupportMind__Final_Data.xlsx`.

## Run

```bash
cd /Users/yashwanthreddy.paakaala/Desktop/airng/hacknation2

export OPENAI_API_KEY=...

npm install
npm run dev
```

Open:
- `http://localhost:3000/`
- `http://localhost:3000/cases`
- `http://localhost:3000/dashboard`

## Demo Flow (recommended)

1) `Dashboard` → click `Run Hit@K Evaluation`
2) `Cases` → open a Tier-3 ticket → click:
   - `Run Gap Detection`
   - `Generate KB Draft`
   - `Run QA / Coaching`
   - `Publish (Approve)`
3) Return to `Dashboard` → see governance + lineage stats update (local artifacts)

## Ralph Loop Artifacts

This repo includes a Ralph-style PRD and 3 logged runs:
- PRD: `.agents/tasks/prd-supportmind.json`
- Runs: `.ralph/runs/run-1`, `.ralph/runs/run-2`, `.ralph/runs/run-3`

## Local Artifacts

Generated during demo runs:
- `.data/audit/events.jsonl`
- `.data/kb_drafts/<Ticket_Number>.json`
- `.data/kb_published/<Ticket_Number>.json`
- `.data/lineage/kb_lineage.jsonl`
- `.data/qa/<Ticket_Number>.json`
- `.data/reports/retrieval_metrics.json`

## Playwright

Smoke tests:

```bash
npm run test:e2e
```
