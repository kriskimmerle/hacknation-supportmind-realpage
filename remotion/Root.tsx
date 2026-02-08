import { Composition, Folder } from "remotion";
import { ArchitectureVideo } from "./ArchitectureVideo";

export const RemotionRoot = () => {
  return (
    <Folder name="SupportMind">
      {/* 60-second Tech Video */}
      <Composition
        id="SupportMind-TechVideo"
        component={ArchitectureVideo}
        durationInFrames={1800}
        fps={30}
        width={1920}
        height={1080}
      />
    </Folder>
  );
};
