import { AbsoluteFill, Series, useVideoConfig } from "remotion";
import { IntroScene } from "./scenes/IntroScene";
import { ArchitectureScene } from "./scenes/ArchitectureScene";
import { DataflowScene } from "./scenes/DataflowScene";
import { AutopilotScene } from "./scenes/AutopilotScene";

export const ArchitectureVideo = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Series>
        <Series.Sequence durationInFrames={2 * fps} premountFor={1 * fps}>
          <IntroScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={6 * fps} premountFor={1 * fps}>
          <ArchitectureScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={8 * fps} premountFor={1 * fps}>
          <DataflowScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={4 * fps} premountFor={1 * fps}>
          <AutopilotScene />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
