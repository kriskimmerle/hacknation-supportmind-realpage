import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { theme } from "../theme";

export const IntroScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = spring({ frame, fps, config: { damping: 200 } });
  const opacity = interpolate(rise, [0, 1], [0, 1]);
  const translateY = interpolate(rise, [0, 1], [40, 0]);

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: theme.colors.ink,
          fontFamily: theme.fontFamily,
        }}
      >
        <div
          style={{
            textAlign: "center",
            maxWidth: 980,
            opacity,
            transform: `translateY(${translateY}px)`,
          }}
        >
          <div style={{ fontSize: 64, fontWeight: 700, letterSpacing: 0.4 }}>
            SupportMind Learning Loop
          </div>
          <div style={{ fontSize: 24, color: theme.colors.muted, marginTop: 18 }}>
            Architecture & dataflow walkthrough
          </div>
          <div
            style={{
              marginTop: 28,
              display: "inline-block",
              padding: "10px 18px",
              borderRadius: 999,
              border: `1px solid ${theme.colors.border}`,
              background: theme.colors.panelSoft,
              fontSize: 14,
              letterSpacing: 1.6,
              textTransform: "uppercase",
              color: theme.colors.accent,
            }}
          >
            Hacknation2 / Local Demo
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
