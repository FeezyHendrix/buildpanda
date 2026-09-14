import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCalibration, calibrationScore, type OutcomeSample } from "./calibration.ts";

test("computeCalibration aggregates correction rate per band", () => {
  const samples: OutcomeSample[] = [
    { band: "high", needsCorrection: false },
    { band: "high", needsCorrection: false },
    { band: "high", needsCorrection: true },
    { band: "low", needsCorrection: true },
    { band: "low", needsCorrection: true },
    { band: "low", needsCorrection: false },
  ];
  const result = computeCalibration(samples);
  const high = result.find((r) => r.band === "high")!;
  const low = result.find((r) => r.band === "low")!;
  assert.equal(high.total, 3);
  assert.equal(Math.round(high.correctionRate * 100), 33);
  assert.equal(low.total, 3);
  assert.equal(Math.round(low.correctionRate * 100), 67);
});

test("well-calibrated data (low confidence corrected more) scores high", () => {
  const bands = computeCalibration([
    { band: "high", needsCorrection: false },
    { band: "high", needsCorrection: false },
    { band: "medium", needsCorrection: true },
    { band: "low", needsCorrection: true },
    { band: "low", needsCorrection: true },
  ]);
  const score = calibrationScore(bands, ["high", "medium", "low"]);
  assert.ok(score >= 0.9, `expected well-calibrated score, got ${score}`);
});

test("miscalibrated data (high confidence corrected more) scores low", () => {
  const bands = computeCalibration([
    { band: "high", needsCorrection: true },
    { band: "high", needsCorrection: true },
    { band: "low", needsCorrection: false },
    { band: "low", needsCorrection: false },
  ]);
  const score = calibrationScore(bands, ["high", "low"]);
  assert.ok(score < 0.5, `expected miscalibrated score, got ${score}`);
});

test("insufficient bands returns the neutral 0.5", () => {
  const bands = computeCalibration([{ band: "high", needsCorrection: false }]);
  assert.equal(calibrationScore(bands, ["high", "low"]), 0.5);
});
