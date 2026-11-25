export interface QueueWorkerOptions {
  concurrency?: number;
  limiter?: { max: number; duration: number };
}
