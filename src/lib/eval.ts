import { loadWorkbook } from "@/lib/dataset";
import { getCorpora } from "@/lib/corpus";

export type RetrievalMetrics = {
  overall: Record<string, number>;
  byType: Record<string, Record<string, number>>;
  totals: Record<string, number>;
};

function hitAtK(results: string[], targetId: string, k: number): number {
  return results.slice(0, k).includes(targetId) ? 1 : 0;
}

export function runRetrievalEval(kValues: number[] = [1, 3, 5]) {
  const wb = loadWorkbook();
  const questions = wb.sheets["Questions"] || [];
  const corpora = getCorpora();

  const totals: Record<string, number> = { overall: 0 };
  const sumsByType: Record<string, Record<string, number>> = {};
  const countsByType: Record<string, number> = {};

  for (const q of questions) {
    const at = (q.Answer_Type || "").trim().toUpperCase();
    const targetId = (q.Target_ID || "").trim();
    const text = (q.Question_Text || "").trim();
    if (!at || !targetId || !text) continue;
    if (!(at in corpora)) continue;

    const hits = corpora[at as keyof typeof corpora].index.search(text, Math.max(...kValues));
    const ids = hits.map((h) => h.id);

    totals.overall += 1;
    totals[at] = (totals[at] || 0) + 1;
    countsByType[at] = (countsByType[at] || 0) + 1;
    sumsByType[at] ||= {};

    for (const k of kValues) {
      const key = `hit@${k}`;
      const v = hitAtK(ids, targetId, k);
      sumsByType[at][key] = (sumsByType[at][key] || 0) + v;
    }
  }

  const byType: RetrievalMetrics["byType"] = {};
  for (const [at, sums] of Object.entries(sumsByType)) {
    const n = countsByType[at] || 1;
    byType[at] = {};
    for (const [k, v] of Object.entries(sums)) byType[at][k] = round3(v / n);
  }

  const overall: RetrievalMetrics["overall"] = {};
  const denom = totals.overall || 1;
  for (const k of kValues) {
    const key = `hit@${k}`;
    let sum = 0;
    for (const at of Object.keys(sumsByType)) sum += sumsByType[at][key] || 0;
    overall[key] = round3(sum / denom);
  }

  return { overall, byType, totals } satisfies RetrievalMetrics;
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}
