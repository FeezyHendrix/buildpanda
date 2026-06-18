import type { FastifyBaseLogger } from "fastify";

let instance: FastifyBaseLogger | null = null;

export function setLogger(logger: FastifyBaseLogger): void {
  instance = logger;
}

export const logger = {
  info(obj: unknown, msg?: string): void {
    if (instance) instance.info(obj as object, msg as string);
    else console.info(msg ?? obj);
  },
  warn(obj: unknown, msg?: string): void {
    if (instance) instance.warn(obj as object, msg as string);
    else console.warn(msg ?? obj);
  },
  error(obj: unknown, msg?: string): void {
    if (instance) instance.error(obj as object, msg as string);
    else console.error(msg ?? obj);
  },
};
