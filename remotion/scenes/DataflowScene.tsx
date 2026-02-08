import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { NodeBox } from "../components/NodeBox";
import { ArrowLayer } from "../components/ArrowLayer";
import { SceneTitle } from "../components/SceneTitle";
import { theme } from "../theme";

const steps = [
  "User triggers an action from Cases or Dashboard",
  "API route loads case + conversation from workbook",
  "BM25 retrieval gathers evidence from KB, scripts, tickets",
  "LLM decides gap and drafts KB with citations",
  "Guardrails + QA rubric verify quality",
  "Artifacts written to .data (drafts, lineage, governance)",
];

export const DataflowScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stepDuration = Math.round(1.6 * fps);
  const step = Math.min(steps.length - 1, Math.floor(frame / stepDuration));
  const localFrame = frame % stepDuration;

  const captionOpacity = interpolate(localFrame, [0, 10], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <Background />
      <SceneTitle title="Request Dataflow" subtitle="End-to-end loop per ticket" />

      <NodeBox
        x={160}
        y={320}
        w={260}
        h={130}
        title="UI Action"
        subtitle="Cases / Dashboard"
        tone="warm"
        highlight={step >= 0}
        delay={10}
      />
      <NodeBox
        x={470}
        y={320}
        w={260}
        h={130}
        title="API Route"
        subtitle="/api/run/*"
        tone="cool"
        highlight={step >= 1}
        delay={20}
      />
      <NodeBox
        x={780}
        y={320}
        w={260}
        h={130}
        title="Retrieve"
        subtitle="BM25 Evidence"
        tone="green"
        highlight={step >= 2}
        delay={30}
      />
      <NodeBox
        x={1090}
        y={320}
        w={260}
        h={130}
        title="LLM Agents"
        subtitle="Gap + Draft + QA"
        tone="warm"
        highlight={step >= 3}
        delay={40}
      />
      <NodeBox
        x={1400}
        y={320}
        w={320}
        h={130}
        title="Artifacts"
        subtitle="kb_drafts · lineage · reports"
        tone="neutral"
        highlight={step >= 4}
        delay={50}
      />

      <ArrowLayer
        width={1920}
        height={1080}
        paths={[
          { d: "M420 385 L 470 385", delay: 20, color: theme.colors.accentWarm },
          { d: "M730 385 L 780 385", delay: 30, color: theme.colors.accent },
          { d: "M1040 385 L 1090 385", delay: 40, color: theme.colors.accentGreen },
          { d: "M1350 385 L 1400 385", delay: 50, color: theme.colors.accent },
        ]}
      />

      <div
        style={{
          position: "absolute",
          left: 160,
          right: 160,
          bottom: 120,
          padding: "22px 28px",
          borderRadius: 18,
          background: theme.colors.panelSoft,
          border: `1px solid ${theme.colors.border}`,
          color: theme.colors.ink,
          fontFamily: theme.fontFamily,
          fontSize: 20,
          opacity: captionOpacity,
        }}
      >
        {steps[step]}
      </div>
    </AbsoluteFill>
  );
};
