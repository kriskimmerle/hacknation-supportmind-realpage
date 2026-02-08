import { spring, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { theme, shadows } from "../theme";

const toneMap = {
  cool: theme.colors.accent,
  warm: theme.colors.accentWarm,
  green: theme.colors.accentGreen,
  red: theme.colors.accentRed,
  neutral: theme.colors.border,
} as const;

export type NodeBoxProps = {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  subtitle?: string;
  tone?: keyof typeof toneMap;
  delay?: number;
  highlight?: boolean;
  detail?: string;
};

export const NodeBox = ({
  x,
  y,
  w,
  h,
  title,
  subtitle,
  detail,
  tone = "neutral",
  delay = 0,
  highlight = false,
}: NodeBoxProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrance = spring({
    frame: frame - delay,
    fps,
    config: { damping: 200 },
  });
  const opacity = interpolate(entrance, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const translateY = interpolate(entrance, [0, 1], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const accent = toneMap[tone];
  const glow = highlight ? `0 0 22px ${accent}55` : shadows.soft;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: 20,
        padding: "18px 20px",
        backgroundColor: theme.colors.panel,
        border: `1px solid ${highlight ? accent : theme.colors.border}`,
        boxShadow: glow,
        color: theme.colors.ink,
        fontFamily: theme.fontFamily,
        opacity,
        transform: `translateY(${translateY}px)`,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 0.2 }}>{title}</div>
      {subtitle ? (
        <div style={{ fontSize: 15, color: theme.colors.muted, lineHeight: 1.3 }}>{subtitle}</div>
      ) : null}
      {detail ? (
        <div style={{ fontSize: 12.5, color: theme.colors.muted }}>{detail}</div>
      ) : null}
    </div>
  );
};
