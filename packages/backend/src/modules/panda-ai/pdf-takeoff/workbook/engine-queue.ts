// How many workbook calculations may be in flight, and how many may wait.
//
// The spike measured a second concurrent worker costing roughly 154 MiB on top
// of the first, so concurrency is a resource decision, not a throughput one.
// The queue is bounded for the same reason a worker has a deadline: an unbounded
// queue does not shed load, it converts it into memory and into callers waiting
// past the point where they still care about the answer.
//
// A full queue is a refusal, not a slower success — the caller is told to retry
// and nothing has been calculated.

import { rejectWorkbook } from "./engine-errors.ts";

export interface BoundedQueueOptions {
  readonly concurrency: number;
  readonly maxQueued: number;
}

export class BoundedJobQueue {
  readonly #concurrency: number;
  readonly #maxQueued: number;
  readonly #waiting: Array<() => void> = [];
  #active = 0;

  constructor(options: BoundedQueueOptions) {
    if (!Number.isInteger(options.concurrency) || options.concurrency < 1) {
      throw new RangeError(`concurrency must be a positive integer, got ${options.concurrency}`);
    }
    if (!Number.isInteger(options.maxQueued) || options.maxQueued < 0) {
      throw new RangeError(`maxQueued must be a non-negative integer, got ${options.maxQueued}`);
    }
    this.#concurrency = options.concurrency;
    this.#maxQueued = options.maxQueued;
  }

  get active(): number {
    return this.#active;
  }

  get queued(): number {
    return this.#waiting.length;
  }

  get capacity(): number {
    return this.#concurrency + this.#maxQueued;
  }

  /**
   * Run `task` when a slot is free, or refuse now.
   *
   * A finished job hands its slot straight to the next waiter rather than
   * releasing it and letting whoever calls next race for it, so the queue is
   * first-in-first-out and a caller cannot be starved by later arrivals.
   */
  async run<T>(task: () => Promise<T>): Promise<T> {
    if (this.#active < this.#concurrency) {
      this.#active += 1;
    } else {
      if (this.#waiting.length >= this.#maxQueued) {
        rejectWorkbook(
          "busy",
          `workbook calculation queue is full (${this.#concurrency} running, ${this.#maxQueued} waiting). ` +
            "Nothing was calculated; retry shortly.",
        );
      }
      await new Promise<void>((resolve) => {
        this.#waiting.push(resolve);
      });
      // The slot was handed over: `#active` was never decremented for it.
    }

    try {
      return await task();
    } finally {
      const next = this.#waiting.shift();
      if (next === undefined) this.#active -= 1;
      else next();
    }
  }
}
