# SupportMind - Self-Learning Support Intelligence (RealPage Track)

SupportMind is a local demo of a self-learning support intelligence layer over the synthetic workbook `SupportMind__Final_Data.xlsx`.

It focuses on trust primitives for support at scale:
- Triage new cases and recommend KB vs Script vs prior resolution
- Generate a governed KB draft (or patch an existing KB) from resolved cases + transcripts
- Run compliance/safety guardrails before publish
- Score interactions with the provided QA rubric (and use QA as a publish gate in Autopilot)
- Preserve provenance/lineage + an audit/X-Ray view (“show your work”)
- Evaluate retrieval accuracy deterministically using `Questions.Answer_Type` + `Target_ID`

## What You Can Demo

- `Cases` (human-in-the-loop): Gap → KB Draft/Patch → Guardrails → QA → Governance publish
- `Autopilot` (automated): Seed a new simulated case → run the pipeline → publish or route to review
- `X-Ray` (audit): data sources + joins, automation timeline, citations, guardrail artifacts, and LLM trace artifacts
- `Dashboard`: hit@k retrieval metrics + learning loop KPIs

## Dataset

Place the workbook at:
- `.data/SupportMind__Final_Data.xlsx`

Key joins used by the app:
- `Ticket_Number`: Tickets ↔ Conversations
- `Script_ID`: Tickets ↔ Scripts_Master
- `KB_Article_ID`: Tickets ↔ Knowledge_Articles

Corpora used for retrieval:
- `KB`: `Knowledge_Articles` + locally published KB artifacts
- `SCRIPT`: `Scripts_Master`
- `TICKET_RESOLUTION`: `Tickets` + locally seeded sim tickets

## Run Locally

Prereqs:
- Node 20+
- `OPENAI_API_KEY` in your environment

```bash
npm install

export OPENAI_API_KEY=...

# default
npm run dev

# or run on a 9000-series port
npm run dev -- --port 9000
```

Open:
- `http://localhost:9000/` (or `3000` if you didn’t set a port)
- `http://localhost:9000/cases`
- `http://localhost:9000/autopilot`
- `http://localhost:9000/dashboard`

## Recommended Demo Script

1) `Autopilot` → `Seed New Case (Agent)`
2) Autopilot runs: gap_detect → kb_draft/kb_patch → guardrail → qa_eval → publish (or needs_review)
3) Open the seeded case in `Cases` and click `X-Ray` to show:
   - where the case data came from (seed artifact vs workbook)
   - how case context was aggregated + truncated
   - evidence/citations used for decisions
   - guardrails output + moderation artifact path
   - LLM trace artifacts (prompts/outputs) saved locally
4) `Dashboard` → run `Hit@K` evaluation to show measurable retrieval accuracy

## Local Artifacts (Generated)

All artifacts are local-only and ignored by git:
- `.data/audit/events.jsonl` (audit timeline)
- `.data/kb_drafts/<Ticket_Number>.json`
- `.data/kb_published/<Ticket_Number>.json`
- `.data/lineage/kb_lineage.jsonl`
- `.data/qa/<Ticket_Number>.json`
- `.data/reports/retrieval_metrics.json`
- `.data/traces/<Ticket_Number>/**` (LLM prompts/outputs, moderation artifacts)

## Tests

```bash
npm run test:e2e
```

## Notes

- The provided dataset is synthetic; this repo does not include real customer PII.
- This is a hackathon-grade PoC optimized for demo clarity, traceability, and measurable evaluation.
