import { Composition, Folder } from "remotion";
import { ArchitectureVideo } from "./ArchitectureVideo";

export const RemotionRoot = () => {
  return (
    <Folder name="SupportMind">
      <Composition
        id="SupportMind-Architecture"
        component={ArchitectureVideo}
        durationInFrames={600}
        fps={30}
        width={1920}
        height={1080}
      />
    </Folder>
  );
};
