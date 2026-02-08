# Run 2 Summary

Goal: implement the self-learning KB loop with governance and provenance.

What changed
- Retrieval corpora + BM25 indices: `src/lib/corpus.ts`, `src/lib/search/bm25.ts`
- Gap detection agent (OpenAI + evidence): `src/lib/agents/gapDetector.ts`
- KB drafting agent (OpenAI) with placeholders + lineage: `src/lib/agents/kbDraft.ts`
- Guardrails pass (moderation + sensitive-data regex): `src/lib/agents/guardrails.ts`
- Governance endpoint (approve/reject): `src/app/api/run/publish/route.ts`
- Case UI runner to exercise the loop: `src/components/app/case-runner.tsx`

Verification
- `npm run lint`
- `npm run build`
