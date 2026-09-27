/// <reference types="nativewind/types" />

declare module "*.css";
declare module "*.png" {
  const content: number;
  export default content;
}
