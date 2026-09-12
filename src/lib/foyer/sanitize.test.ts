import assert from "node:assert/strict";
import { test } from "node:test";
import { sanitizeHost, sanitizeMeeting, sanitizeMessage, sanitizeTitle } from "./sanitize.ts";

test("script tags never survive as HTML", () => {
  const title = sanitizeTitle("<script>alert(1)</script> Q3");
  assert.equal(title, "Q3");
  assert.equal(title.includes("<"), false);
  assert.equal(title.toLowerCase().includes("script"), false);
});

test("busy meetings lose title and host", () => {
  const meeting = sanitizeMeeting(
    { title: "Board", host: "Ada", startIso: "2026-09-12T10:00:00Z", endIso: "2026-09-12T11:00:00Z" },
    { busy: true },
  );
  assert.deepEqual(meeting, {
    title: "Busy",
    host: "",
    description: "",
    startIso: "2026-09-12T10:00:00Z",
    endIso: "2026-09-12T11:00:00Z",
  });
  assert.equal(sanitizeHost("Ada", { busy: true }), "");
});

test("long titles are capped", () => {
  const title = sanitizeTitle("x".repeat(10_000));
  assert.equal(title.length, 80);
});

test("empty title uses fallback", () => {
  assert.equal(sanitizeTitle("   ", { fallback: "Meeting" }), "Meeting");
  assert.equal(sanitizeTitle("", { fallback: "" }), "");
});

test("message cap and entities", () => {
  assert.equal(sanitizeMessage("Hello&nbsp;<b>world</b>").includes("<"), false);
  assert.ok(sanitizeMessage("m".repeat(500)).length <= 200);
});
