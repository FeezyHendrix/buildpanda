import { Img, staticFile } from "remotion";

export const Logo: React.FC<{ size?: number; style?: React.CSSProperties }> = ({
  size = 30,
  style,
}) => (
  <Img
    src={staticFile("brand/mark.svg")}
    alt=""
    style={{ height: size, width: "auto", display: "block", ...style }}
  />
);

export const Wordmark: React.FC<{ height?: number; style?: React.CSSProperties }> = ({
  height = 40,
  style,
}) => (
  <Img
    src={staticFile("brand/logo.svg")}
    alt="BuildPanda"
    style={{ height, width: "auto", display: "block", ...style }}
  />
);
