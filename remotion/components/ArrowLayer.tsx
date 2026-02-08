import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";

export type ArrowPath = {
  d: string;
  delay?: number;
  color?: string;
  strokeWidth?: number;
};

export const ArrowLayer = ({
  width,
  height,
  paths,
}: {
  width: number;
  height: number;
  paths: ArrowPath[];
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: "absolute", left: 0, top: 0 }}
    >
      {paths.map((path, index) => {
        const delay = path.delay ?? 0;
        const progress = interpolate(frame - delay, [0, 0.6 * fps], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const markerId = `arrow-${index}`;
        const color = path.color ?? "rgba(236, 243, 255, 0.55)";
        return (
          <g key={markerId}>
            <defs>
              <marker
                id={markerId}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
              </marker>
            </defs>
            <path
              d={path.d}
              fill="none"
              stroke={color}
              strokeWidth={path.strokeWidth ?? 2}
              strokeDasharray={1}
              strokeDashoffset={1 - progress}
              pathLength={1}
              markerEnd={`url(#${markerId})`}
            />
          </g>
        );
      })}
    </svg>
  );
};
