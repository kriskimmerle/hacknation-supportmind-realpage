import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig, Sequence } from "remotion";
import { Background } from "../components/Background";
import { theme } from "../theme";

const personas = [
  {
    name: "The Listener",
    emoji: "👂",
    role: "Triage & Retrieval",
    description: "Classifies incoming cases and finds relevant KB articles, scripts, and past resolutions",
    color: "#3B82F6", // blue
  },
  {
    name: "The Whisperer",
    emoji: "💡",
    role: "Knowledge Extraction",
    description: "Detects knowledge gaps and drafts new KB articles or patches existing ones",
    color: "#8B5CF6", // purple
  },
  {
    name: "The Gatekeeper",
    emoji: "🛡️",
    role: "Governance & Safety",
    description: "Runs guardrails, enforces citation policies, and manages publish approval",
    color: "#10B981", // green
  },
];

const PersonaCard = ({ persona, index, frame, fps }: {
  persona: typeof personas[0];
  index: number;
  frame: number;
  fps: number;
}) => {
  const delay = index * 15;
  const localFrame = Math.max(0, frame - delay);
  
  const scale = spring({
    frame: localFrame,
    fps,
    config: { damping: 100, mass: 0.5 },
  });
  
  const opacity = interpolate(scale, [0, 1], [0, 1]);
  
  return (
    <div
      style={{
        width: 340,
        padding: 32,
        background: theme.colors.panel,
        borderRadius: 16,
        border: `2px solid ${persona.color}`,
        boxShadow: `0 4px 24px ${persona.color}33`,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>{persona.emoji}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: persona.color, marginBottom: 8 }}>
        {persona.name}
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: theme.colors.ink, marginBottom: 12 }}>
        {persona.role}
      </div>
      <div style={{ fontSize: 14, color: theme.colors.muted, lineHeight: 1.5 }}>
        {persona.description}
      </div>
    </div>
  );
};

export const PersonasScene = () => {
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
          gap: 48,
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
          Three Personas, One Knowledge Loop
        </div>
        
        <div style={{ display: "flex", gap: 32 }}>
          {personas.map((persona, i) => (
            <PersonaCard
              key={persona.name}
              persona={persona}
              index={i}
              frame={frame}
              fps={fps}
            />
          ))}
        </div>
        
        <div
          style={{
            marginTop: 24,
            fontSize: 18,
            color: theme.colors.muted,
            opacity: interpolate(frame, [60, 90], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          Every support case flows through this lifecycle: Listen → Learn → Govern
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
