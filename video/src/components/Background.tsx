import { AbsoluteFill } from "remotion";
import { COLORS } from "../theme";

export const Background: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(160deg, ${COLORS.bgTop} 0%, ${COLORS.bgBottom} 100%)`,
      }}
    >
      <AbsoluteFill
        style={{
          background: `radial-gradient(1200px 700px at 12% -8%, rgba(0,77,231,0.10), transparent 60%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${COLORS.line} 1.2px, transparent 1.2px)`,
          backgroundSize: "38px 38px",
          opacity: 0.5,
          maskImage: "linear-gradient(180deg, rgba(0,0,0,0.5), transparent 70%)",
          WebkitMaskImage: "linear-gradient(180deg, rgba(0,0,0,0.5), transparent 70%)",
        }}
      />
    </AbsoluteFill>
  );
};
