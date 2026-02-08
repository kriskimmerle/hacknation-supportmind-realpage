import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

export const SceneTitle = ({ title, subtitle }: { title: string; subtitle?: string }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = spring({ frame, fps, config: { damping: 200 } });
  const opacity = interpolate(reveal, [0, 1], [0, 1]);
  const translateY = interpolate(reveal, [0, 1], [12, 0]);

  return (
    <div
      style={{
        position: "absolute",
        left: 110,
        top: 80,
        color: theme.colors.ink,
        fontFamily: theme.fontFamily,
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div style={{ fontSize: 44, fontWeight: 700 }}>{title}</div>
      {subtitle ? (
        <div style={{ fontSize: 18, color: theme.colors.muted, marginTop: 10 }}>{subtitle}</div>
      ) : null}
    </div>
  );
};
