# SupportMind for RealPage (Challenge 5)

> Hack Nation Hackathon Submission

SupportMind is a support-intelligence workspace built for the RealPage challenge. It turns historical support data into a practical learning loop for operations teams: detect gaps, draft knowledge, evaluate quality, and track governance over time.

## Team

This project is co-maintained with equal ownership of ongoing development and decisions.

- **Kris Kimmerle** (Maintainer) - [github.com/kriskimmerle](https://github.com/kriskimmerle)
- **YashwanthReddy Paakaala** (Maintainer) - [github.com/kebo08](https://github.com/kebo08)

## Challenge Context

- Event: Hack Nation
- Track: RealPage
- Challenge: Challenge 5

## What It Does

- Detects knowledge gaps using ticket and conversation evidence
- Drafts KB articles from resolved cases and script context
- Applies governance flow for approve/reject with lineage tracking
- Evaluates support quality using rubric-based QA scoring
- Runs deterministic retrieval evaluation using target IDs and answer types

## Tech Stack

- Next.js 16 + React 19 + TypeScript
- OpenAI API (`openai` SDK)
- XLSX ingestion from workbook source data
- Playwright for smoke/e2e tests
- Tailwind + shadcn/ui components

## How We Built It (Ralph Wiggum Method)

We built this project using a Ralph Wiggum-style iterative loop (fresh context each run, filesystem plus tests as state).

1. Planned architecture and feature approach with **Claude Opus 4.6**.
2. Used Opus 4.6 to generate a robust **JSON PRD**, a required input for the Ralph method.
3. Configured the Ralph engine (internally referred to as `ralpha`) to run **GPT-5.3 Codex** in high-thinking mode for implementation iterations.
4. Ran approximately **15 Ralph iterations**, with each run taking about **25-45 minutes**.
5. Each run produced automated tests; we fixed issues between runs, with fewer defects over time.
6. Performed user testing, identified new feature opportunities, and fed those requirements back into the next loop.
7. Repeated this cycle until we reached the final product in this repository.

This workflow emphasized rapid iteration, evidence-driven fixes, and steady convergence through repeated test-and-improve cycles.

## Repository Layout

- `src/app` - UI pages and API routes
- `src/lib` - data loading, agents, evaluation, and reporting logic
- `tests` - Playwright smoke tests
- `.data` - local generated artifacts (ignored by git)

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- `OPENAI_API_KEY` in your shell (required for AI-powered flows)

### Dataset

By default, the app reads:

- `SupportMind__Final_Data.xlsx` from the repository root

You can override this path if needed:

```bash
export DATASET_PATH="/absolute/path/to/SupportMind__Final_Data.xlsx"
```

### Run Locally

```bash
npm ci
export OPENAI_API_KEY="<your_key_here>"
npm run dev
```

Open:

- [http://localhost:3000](http://localhost:3000)
- [http://localhost:3000/cases](http://localhost:3000/cases)
- [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

## Test

```bash
npm run test:e2e
```

## Demo Flow

1. Open `Dashboard` and run `Hit@K Evaluation`
2. Open a case and run:
   - `Gap Detection`
   - `Generate KB Draft`
   - `Run QA / Coaching`
   - `Publish (Approve)`
3. Return to `Dashboard` to review updated governance and lineage metrics

## Local Output Artifacts

Generated during demo runs:

- `.data/audit/events.jsonl`
- `.data/kb_drafts/<Ticket_Number>.json`
- `.data/kb_published/<Ticket_Number>.json`
- `.data/lineage/kb_lineage.jsonl`
- `.data/qa/<Ticket_Number>.json`
- `.data/reports/retrieval_metrics.json`
