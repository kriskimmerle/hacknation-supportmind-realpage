import { AbsoluteFill } from "remotion";
import { Background } from "../components/Background";
import { NodeBox } from "../components/NodeBox";
import { ArrowLayer } from "../components/ArrowLayer";
import { SceneTitle } from "../components/SceneTitle";
import { theme } from "../theme";

export const ArchitectureScene = () => {
  return (
    <AbsoluteFill>
      <Background />
      <SceneTitle title="System Architecture" subtitle="UI, APIs, agent logic, and local artifacts" />

      <NodeBox
        x={120}
        y={260}
        w={300}
        h={120}
        title="Support Agent"
        subtitle="Dashboard, Cases, Chat"
        tone="warm"
        delay={10}
      />

      <NodeBox
        x={460}
        y={180}
        w={360}
        h={160}
        title="Next.js UI"
        subtitle="App Router pages + components"
        detail="/dashboard · /cases · /chat"
        tone="cool"
        delay={20}
      />

      <NodeBox
        x={900}
        y={180}
        w={360}
        h={160}
        title="API Routes"
        subtitle="/api/run/* · /api/cases · /api/kpi"
        tone="cool"
        delay={30}
      />

      <NodeBox
        x={460}
        y={430}
        w={360}
        h={210}
        title="Core Agents"
        subtitle="Gap detect · KB draft · QA eval"
        detail="Retrieval (BM25) + guardrails"
        tone="green"
        delay={40}
      />

      <NodeBox
        x={900}
        y={430}
        w={360}
        h={160}
        title="OpenAI API"
        subtitle="LLM reasoning + rubric scoring"
        tone="warm"
        delay={50}
      />

      <NodeBox
        x={120}
        y={640}
        w={320}
        h={150}
        title="Dataset Workbook"
        subtitle=".data/SupportMind__Final_Data.xlsx"
        tone="neutral"
        delay={60}
      />

      <NodeBox
        x={460}
        y={700}
        w={360}
        h={150}
        title="Local Artifacts"
        subtitle="kb_drafts · kb_published · lineage"
        detail="qa, audit, reports, governance"
        tone="neutral"
        delay={70}
      />

      <ArrowLayer
        width={1920}
        height={1080}
        paths={[
          {
            d: "M420 320 C 470 300, 470 280, 460 260",
            delay: 25,
            color: theme.colors.accentWarm,
          },
          {
            d: "M820 260 L 900 260",
            delay: 35,
            color: theme.colors.accent,
          },
          {
            d: "M640 340 L 640 430",
            delay: 45,
            color: theme.colors.accent,
          },
          {
            d: "M1080 340 C 1080 380, 980 400, 820 450",
            delay: 50,
            color: theme.colors.accent,
          },
          {
            d: "M820 520 L 900 510",
            delay: 55,
            color: theme.colors.accentWarm,
          },
          {
            d: "M460 535 C 360 560, 260 600, 280 640",
            delay: 60,
            color: theme.colors.accentGreen,
          },
          {
            d: "M640 640 L 640 700",
            delay: 65,
            color: theme.colors.accentGreen,
          },
        ]}
      />
    </AbsoluteFill>
  );
};
