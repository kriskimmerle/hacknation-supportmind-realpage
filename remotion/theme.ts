import { loadFont } from "@remotion/google-fonts/Manrope";

const { fontFamily } = loadFont();

export const theme = {
  fontFamily,
  colors: {
    bg: "#0b1220",
    bgDeep: "#070b16",
    panel: "rgba(255, 255, 255, 0.08)",
    panelSoft: "rgba(255, 255, 255, 0.05)",
    border: "rgba(255, 255, 255, 0.18)",
    ink: "#ecf3ff",
    muted: "rgba(236, 243, 255, 0.7)",
    accent: "#59d7ff",
    accentWarm: "#ffb86b",
    accentGreen: "#7cffb2",
    accentRed: "#ff6b6b",
  },
};

export const shadows = {
  soft: "0 16px 40px rgba(6, 10, 22, 0.45)",
  glow: "0 0 28px rgba(89, 215, 255, 0.35)",
};
