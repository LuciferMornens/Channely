import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createStreamingBuffer } from "@/lib/streaming";

describe("createStreamingBuffer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("batches many chunks into a single flush update", () => {
    const flushed: string[] = [];
    const buffer = createStreamingBuffer((value) => flushed.push(value), {
      schedule: (cb) => globalThis.setTimeout(cb, 16),
      cancel: (id) => globalThis.clearTimeout(id),
    });

    buffer.append("Hel");
    buffer.append("lo");
    buffer.append("!");

    expect(flushed).toHaveLength(0);
    vi.advanceTimersByTime(16);
    expect(flushed).toEqual(["Hello!"]);
  });

  it("flushes synchronously when flush is called", () => {
    const flushed: string[] = [];
    const buffer = createStreamingBuffer((value) => flushed.push(value), {
      schedule: (cb) => globalThis.setTimeout(cb, 16),
      cancel: (id) => globalThis.clearTimeout(id),
    });

    buffer.append("abc");
    buffer.flush();
    expect(flushed).toEqual(["abc"]);
    expect(buffer.text()).toBe("abc");
  });

  it("reset clears accumulated and pending text", () => {
    const flushed: string[] = [];
    const buffer = createStreamingBuffer((value) => flushed.push(value), {
      schedule: (cb) => globalThis.setTimeout(cb, 16),
      cancel: (id) => globalThis.clearTimeout(id),
    });

    buffer.append("hello");
    buffer.reset();
    vi.advanceTimersByTime(16);
    expect(flushed).toHaveLength(0);
    expect(buffer.text()).toBe("");
  });
});
