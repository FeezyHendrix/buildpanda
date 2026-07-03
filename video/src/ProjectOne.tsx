import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Wordmark } from "./components/Wordmark";
import { COLORS, FONT, FPS } from "./theme";

// Each clip is trimmed to a representative mid-section so the whole video stays
// under a minute. `start` is the in-point within the source recording.
// A third file on disk is a byte-identical duplicate of clip 2 and is omitted.
const CLIPS = [
  { src: "project1/clip-0.mp4", start: 0, frames: 240 },
  { src: "project1/clip-1.mp4", start: 25, frames: 540 },
  { src: "project1/clip-2.mp4", start: 18, frames: 540 },
] as const;

const INTRO = 105;
const OUTRO = 90;
const TRANSITION = 7;

const total =
  INTRO +
  CLIPS.reduce((acc, c) => acc + c.frames, 0) +
  OUTRO -
  (CLIPS.length + 1) * TRANSITION;

export const PROJECT_ONE_DURATION = total;

const FOOTAGE_END = total - OUTRO + TRANSITION;
const timing = linearTiming({ durationInFrames: TRANSITION });
const EASE = Easing.bezier(0.16, 1, 0.3, 1);

export const ProjectOne: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000000" }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={INTRO}>
          <BrandCard intro />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition timing={timing} presentation={fade()} />

        {CLIPS.flatMap((clip, i) => [
          <TransitionSeries.Sequence key={`clip-${i}`} durationInFrames={clip.frames}>
            <AbsoluteFill
              style={{
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "#000000",
              }}
            >
              <OffthreadVideo
                src={staticFile(clip.src)}
                trimBefore={clip.start * FPS}
                muted
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />
            </AbsoluteFill>
          </TransitionSeries.Sequence>,
          <TransitionSeries.Transition
            key={`t-${i}`}
            timing={timing}
            presentation={fade()}
          />,
        ])}

        <TransitionSeries.Sequence durationInFrames={OUTRO}>
          <BrandCard />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      <Sequence from={INTRO - TRANSITION} durationInFrames={FOOTAGE_END - (INTRO - TRANSITION)}>
        <Watermark />
      </Sequence>

      <Audio
        src={staticFile("audio/music-raw.mp3")}
        volume={(f) =>
          interpolate(
            f,
            [0, 20, total - 30, total - 1],
            [0, 0.18, 0.18, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          )
        }
      />
    </AbsoluteFill>
  );
};

const Watermark: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 12], [0, 0.85], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 40,
          opacity,
          background: COLORS.white,
          borderRadius: 14,
          padding: "12px 20px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
        }}
      >
        <Wordmark height={40} />
      </div>
    </AbsoluteFill>
  );
};

const BrandCard: React.FC<{ intro?: boolean }> = ({ intro }) => {
  const frame = useCurrentFrame();
  const logo = interpolate(frame, [0, 22], [0, 1], {
    easing: EASE,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tag = interpolate(frame, [14, 38], [0, 1], {
    easing: EASE,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        fontFamily: FONT,
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(180deg, ${COLORS.bgTop} 0%, ${COLORS.bgBottom} 100%)`,
      }}
    >
      <div
        style={{
          opacity: logo,
          transform: `translateY(${interpolate(logo, [0, 1], [22, 0])}px) scale(${interpolate(logo, [0, 1], [0.9, 1])})`,
        }}
      >
        <Wordmark height={150} />
      </div>
      <div
        style={{
          marginTop: 42,
          opacity: tag,
          transform: `translateY(${interpolate(tag, [0, 1], [16, 0])}px)`,
          textAlign: "center",
        }}
      >
        {intro ? (
          <>
            <div
              style={{
                fontSize: 52,
                fontWeight: 800,
                letterSpacing: -1,
                color: COLORS.text,
              }}
            >
              Two-Storey Building
            </div>
            <div
              style={{
                marginTop: 12,
                fontSize: 30,
                fontWeight: 600,
                letterSpacing: 1,
                color: COLORS.brand,
              }}
            >
              Shomolu, Lagos, Nigeria
            </div>
          </>
        ) : (
          <div
            style={{
              fontSize: 44,
              fontWeight: 700,
              letterSpacing: -0.8,
              color: COLORS.textSoft,
            }}
          >
            Build with confidence.
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
