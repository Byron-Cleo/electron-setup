import { describe, it, expect } from "vitest";
import { formatElapsed, elapsedSeverity } from "@/lib/utils";

const NOW = new Date("2026-09-26T12:00:00.000Z");

function ago(ms: number): string {
  return new Date(NOW.getTime() - ms).toISOString();
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("formatElapsed", () => {
  it("formats sub-hour ages in whole minutes", () => {
    expect(formatElapsed(ago(0), NOW)).toBe("0m");
    expect(formatElapsed(ago(45 * MIN), NOW)).toBe("45m");
    expect(formatElapsed(ago(59 * MIN), NOW)).toBe("59m");
  });

  it("formats hours with a minute remainder", () => {
    expect(formatElapsed(ago(HOUR), NOW)).toBe("1h 0m");
    expect(formatElapsed(ago(6 * HOUR + 20 * MIN), NOW)).toBe("6h 20m");
    expect(formatElapsed(ago(23 * HOUR + 59 * MIN), NOW)).toBe("23h 59m");
  });

  it("formats multi-day ages in days and hours, dropping minutes", () => {
    expect(formatElapsed(ago(DAY), NOW)).toBe("1d 0h");
    expect(formatElapsed(ago(3 * DAY + 4 * HOUR), NOW)).toBe("3d 4h");
    expect(formatElapsed(ago(10 * DAY + 7 * HOUR + 55 * MIN), NOW)).toBe("10d 7h");
  });

  it("clamps future timestamps to zero instead of going negative", () => {
    const future = new Date(NOW.getTime() + 5 * MIN).toISOString();
    expect(formatElapsed(future, NOW)).toBe("0m");
  });

  it("accepts Date objects as well as ISO strings", () => {
    expect(formatElapsed(new Date(NOW.getTime() - 2 * HOUR), NOW)).toBe("2h 0m");
  });
});

describe("elapsedSeverity", () => {
  it("is neutral under 12 hours", () => {
    expect(elapsedSeverity(ago(0), NOW)).toBe("default");
    expect(elapsedSeverity(ago(11 * HOUR + 59 * MIN), NOW)).toBe("default");
  });

  it("turns amber at exactly 12 hours", () => {
    expect(elapsedSeverity(ago(12 * HOUR), NOW)).toBe("warn");
    expect(elapsedSeverity(ago(DAY + HOUR), NOW)).toBe("warn");
  });

  it("turns red at exactly 2 days", () => {
    expect(elapsedSeverity(ago(2 * DAY), NOW)).toBe("danger");
    expect(elapsedSeverity(ago(9 * DAY), NOW)).toBe("danger");
  });

  it("treats a future timestamp as neutral", () => {
    const future = new Date(NOW.getTime() + DAY).toISOString();
    expect(elapsedSeverity(future, NOW)).toBe("default");
  });
});
