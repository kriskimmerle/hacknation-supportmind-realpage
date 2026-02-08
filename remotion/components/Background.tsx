import { AbsoluteFill } from "remotion";
import { theme } from "../theme";

export const Background = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.colors.bgDeep,
        backgroundImage: [
          "radial-gradient(circle at 12% 18%, rgba(89, 215, 255, 0.18) 0%, rgba(7, 11, 22, 0) 38%)",
          "radial-gradient(circle at 82% 22%, rgba(255, 184, 107, 0.12) 0%, rgba(7, 11, 22, 0) 42%)",
          "linear-gradient(135deg, rgba(11, 18, 32, 1) 0%, rgba(14, 26, 43, 1) 48%, rgba(10, 17, 31, 1) 100%)",
        ].join(","),
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage: [
            "linear-gradient(rgba(236, 243, 255, 0.08) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(236, 243, 255, 0.08) 1px, transparent 1px)",
          ].join(","),
          backgroundSize: "72px 72px",
          opacity: 0.28,
        }}
      />
    </AbsoluteFill>
  );
};
