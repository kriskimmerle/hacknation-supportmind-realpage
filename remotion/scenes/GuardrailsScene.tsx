import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "../components/Background";
import { theme } from "../theme";

const guardrails = [
  { icon: "📝", name: "Citation Required", desc: "Sensitive topics MUST cite KB/Script/Ticket sources" },
  { icon: "⚖️", name: "Fair Housing", desc: "Blocks discriminatory language and practices" },
  { icon: "🔒", name: "PII Protection", desc: "Detects and flags personal information" },
  { icon: "🚫", name: "Moderation", desc: "OpenAI safety checks on all content" },
  { icon: "✅", name: "Script Consistency", desc: "Verifies referenced scripts are included" },
  { icon: "🔗", name: "Link Review", desc: "Flags external URLs for compliance review" },
];

export const GuardrailsScene = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const titleSpring = spring({ frame, fps, config: { damping: 200 } });
  const titleOpacity = interpolate(titleSpring, [0, 1], [0, 1]);
  
  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: theme.fontFamily,
          gap: 40,
        }}
      >
        <div
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: theme.colors.ink,
            opacity: titleOpacity,
          }}
        >
          🛡️ Guardrails: Trust at Scale
        </div>
        
        <div
          style={{
            fontSize: 20,
            color: theme.colors.muted,
            opacity: interpolate(frame, [15, 30], [0, 1], { extrapolateRight: "clamp" }),
            maxWidth: 800,
            textAlign: "center",
          }}
        >
          Every KB draft passes through safety checks before publishing
        </div>
        
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 24,
            marginTop: 20,
          }}
        >
          {guardrails.map((g, i) => {
            const delay = 30 + i * 10;
            const localFrame = Math.max(0, frame - delay);
            const itemSpring = spring({ frame: localFrame, fps, config: { damping: 100 } });
            const opacity = interpolate(itemSpring, [0, 1], [0, 1]);
            const scale = interpolate(itemSpring, [0, 1], [0.8, 1]);
            
            return (
              <div
                key={g.name}
                style={{
                  width: 280,
                  padding: 20,
                  background: theme.colors.panel,
                  borderRadius: 12,
                  border: `1px solid ${theme.colors.border}`,
                  opacity,
                  transform: `scale(${scale})`,
                }}
              >
                <div style={{ fontSize: 32, marginBottom: 8 }}>{g.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: theme.colors.ink, marginBottom: 6 }}>
                  {g.name}
                </div>
                <div style={{ fontSize: 13, color: theme.colors.muted, lineHeight: 1.4 }}>
                  {g.desc}
                </div>
              </div>
            );
          })}
        </div>
        
        <div
          style={{
            marginTop: 32,
            padding: "12px 24px",
            background: "#DC2626",
            borderRadius: 8,
            color: "white",
            fontSize: 18,
            fontWeight: 600,
            opacity: interpolate(frame, [120, 150], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          ⚠️ Unsafe content is BLOCKED, not just flagged
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
