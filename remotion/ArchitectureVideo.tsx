import { AbsoluteFill, Series, useVideoConfig } from "remotion";
import { IntroScene } from "./scenes/IntroScene";
import { PersonasScene } from "./scenes/PersonasScene";
import { ArchitectureScene } from "./scenes/ArchitectureScene";
import { DataflowScene } from "./scenes/DataflowScene";
import { GuardrailsScene } from "./scenes/GuardrailsScene";
import { AutopilotScene } from "./scenes/AutopilotScene";

/**
 * 60-second Tech Video for Hackathon Submission
 * 
 * Timeline:
 * 0-4s:   Intro - Title card
 * 4-14s:  Personas - Listener, Whisperer, Gatekeeper
 * 14-26s: Architecture - Component diagram
 * 26-38s: Dataflow - How data moves through the system
 * 38-50s: Guardrails - Safety and compliance checks
 * 50-60s: Autopilot - Full automation mode
 */
export const ArchitectureVideo = () => {
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill>
      <Series>
        {/* Intro - 4 seconds */}
        <Series.Sequence durationInFrames={4 * fps} premountFor={1 * fps}>
          <IntroScene />
        </Series.Sequence>
        
        {/* Three Personas - 10 seconds */}
        <Series.Sequence durationInFrames={10 * fps} premountFor={1 * fps}>
          <PersonasScene />
        </Series.Sequence>
        
        {/* Architecture Diagram - 12 seconds */}
        <Series.Sequence durationInFrames={12 * fps} premountFor={1 * fps}>
          <ArchitectureScene />
        </Series.Sequence>
        
        {/* Dataflow Animation - 12 seconds */}
        <Series.Sequence durationInFrames={12 * fps} premountFor={1 * fps}>
          <DataflowScene />
        </Series.Sequence>
        
        {/* Guardrails - 12 seconds */}
        <Series.Sequence durationInFrames={12 * fps} premountFor={1 * fps}>
          <GuardrailsScene />
        </Series.Sequence>
        
        {/* Autopilot Mode - 10 seconds */}
        <Series.Sequence durationInFrames={10 * fps} premountFor={1 * fps}>
          <AutopilotScene />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
