import { Easing, interpolate, useCurrentFrame } from "remotion";
import { COLORS } from "../theme";

const MOVE = Easing.bezier(0.5, 0, 0.2, 1);

export interface Point {
  x: number;
  y: number;
}

export const Cursor: React.FC<{
  from: Point;
  to: Point;
  moveStart: number;
  moveDur: number;
  clickFrame: number;
}> = ({ from, to, moveStart, moveDur, clickFrame }) => {
  const frame = useCurrentFrame();

  const travel = interpolate(frame, [moveStart, moveStart + moveDur], [0, 1], {
    easing: MOVE,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x = interpolate(travel, [0, 1], [from.x, to.x]);
  const y = interpolate(travel, [0, 1], [from.y, to.y]);

  const appear = interpolate(frame, [moveStart - 10, moveStart], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const press = interpolate(frame, [clickFrame - 3, clickFrame, clickFrame + 7], [1, 0.8, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const ringT = interpolate(frame, [clickFrame, clickFrame + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ringSize = interpolate(ringT, [0, 1], [12, 84]);
  const ringOpacity = interpolate(ringT, [0, 1], [0.5, 0]);

  return (
    <div style={{ position: "absolute", inset: 0, opacity: appear, pointerEvents: "none" }}>
      {frame >= clickFrame ? (
        <div
          style={{
            position: "absolute",
            left: x - ringSize / 2,
            top: y - ringSize / 2,
            width: ringSize,
            height: ringSize,
            borderRadius: "50%",
            border: `3px solid ${COLORS.brand}`,
            opacity: ringOpacity,
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          left: x - 5,
          top: y - 3,
          transform: `scale(${press})`,
          transformOrigin: "6px 4px",
          filter: "drop-shadow(0 5px 9px rgba(0,0,0,0.30))",
        }}
      >
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 2.4 L4 19.3 L8.3 15 L11.1 20.8 L13.7 19.5 L10.9 13.8 L16.8 13.8 Z"
            fill="#FFFFFF"
            stroke="#111111"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
};
