import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { NodeBox } from "../components/NodeBox";
import { ArrowLayer } from "../components/ArrowLayer";
import { SceneTitle } from "../components/SceneTitle";
import { theme } from "../theme";

export const AutopilotScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pulse = (offset: number) =>
    interpolate(frame - offset, [0, 12, 24], [0, 1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  return (
    <AbsoluteFill>
      <Background />
      <SceneTitle title="Autopilot Loop" subtitle="Automated run + human review fallback" />

      <NodeBox
        x={140}
        y={330}
        w={240}
        h={120}
        title="Seed"
        subtitle="Sim tickets"
        tone="neutral"
        highlight={pulse(10) > 0.2}
        delay={10}
      />
      <NodeBox
        x={420}
        y={330}
        w={240}
        h={120}
        title="Gap Detect"
        subtitle="Decision"
        tone="cool"
        highlight={pulse(25) > 0.2}
        delay={20}
      />
      <NodeBox
        x={700}
        y={330}
        w={240}
        h={120}
        title="KB Draft"
        subtitle="Evidence + LLM"
        tone="green"
        highlight={pulse(40) > 0.2}
        delay={30}
      />
      <NodeBox
        x={980}
        y={330}
        w={240}
        h={120}
        title="Guardrails"
        subtitle="Safety checks"
        tone="warm"
        highlight={pulse(55) > 0.2}
        delay={40}
      />
      <NodeBox
        x={1260}
        y={330}
        w={240}
        h={120}
        title="QA Eval"
        subtitle="Rubric scoring"
        tone="warm"
        highlight={pulse(70) > 0.2}
        delay={50}
      />
      <NodeBox
        x={1540}
        y={330}
        w={240}
        h={120}
        title="Publish"
        subtitle="KB + lineage"
        tone="green"
        highlight={pulse(85) > 0.2}
        delay={60}
      />

      <NodeBox
        x={760}
        y={520}
        w={400}
        h={120}
        title="Needs Review"
        subtitle="Rate limit, guardrail fail, or QA timeout"
        tone="red"
        highlight={pulse(100) > 0.2}
        delay={70}
      />

      <ArrowLayer
        width={1920}
        height={1080}
        paths={[
          { d: "M380 390 L 420 390", delay: 18, color: theme.colors.accent },
          { d: "M660 390 L 700 390", delay: 28, color: theme.colors.accent },
          { d: "M940 390 L 980 390", delay: 38, color: theme.colors.accentGreen },
          { d: "M1220 390 L 1260 390", delay: 48, color: theme.colors.accentWarm },
          { d: "M1500 390 L 1540 390", delay: 58, color: theme.colors.accentGreen },
          { d: "M1100 450 C 1100 500, 1000 520, 960 520", delay: 70, color: theme.colors.accentRed },
        ]}
      />
    </AbsoluteFill>
  );
};
