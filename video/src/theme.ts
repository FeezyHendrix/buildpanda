import { loadFont } from "@remotion/google-fonts/PlusJakartaSans";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

export const FONT = fontFamily;

export const COLORS = {
  brand: "#004DE7",
  brandDeep: "#0037A4",
  brandSoft: "rgba(0,77,231,0.10)",
  text: "#111111",
  textSoft: "#4D4D4D",
  muted: "#888888",
  line: "#EDEDED",
  bgTop: "#FFFFFF",
  bgBottom: "#E6EDFD",
  white: "#FFFFFF",
};

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export const UHD_WIDTH = 3840;
export const UHD_HEIGHT = 2160;

export const SHOT_W = 1500;
export const SHOT_H = 940;
export const SHOT_RATIO = SHOT_W / SHOT_H;
