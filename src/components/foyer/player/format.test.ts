import assert from "node:assert/strict";
import { test } from "node:test";
import { welcomeStartLine } from "./format.ts";

test("welcome shows the start time when the session is more than 15 minutes out", () => {
  assert.equal(
    welcomeStartLine("2026-09-12T13:00:00Z", "2026-09-12T12:00:00Z", "UTC"),
    "13:00",
  );
});

test("welcome counts down inside the last 15 minutes", () => {
  assert.equal(
    welcomeStartLine("2026-09-12T12:15:00Z", "2026-09-12T12:00:00Z", "UTC"),
    "Starting in 15 minutes",
  );
  assert.equal(
    welcomeStartLine("2026-09-12T12:08:00Z", "2026-09-12T12:00:00Z", "UTC"),
    "Starting in 8 minutes",
  );
  assert.equal(
    welcomeStartLine("2026-09-12T12:00:40Z", "2026-09-12T12:00:00Z", "UTC"),
    "Starting in 1 minute",
  );
});

test("welcome says starting soon once the session should have begun", () => {
  assert.equal(
    welcomeStartLine("2026-09-12T12:00:00Z", "2026-09-12T12:00:00Z", "UTC"),
    "Starting soon",
  );
  assert.equal(
    welcomeStartLine("2026-09-12T11:55:00Z", "2026-09-12T12:00:00Z", "UTC"),
    "Starting soon",
  );
});
