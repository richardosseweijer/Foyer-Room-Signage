import assert from "node:assert/strict";
import { test } from "node:test";
import {
  arrowForTemplate,
  clampLogoBand,
  defaultLook,
  normalizeLook,
  parsePalette,
} from "./look.ts";

test("unknown palette keeps previous, else linen", () => {
  assert.equal(parsePalette("neon"), "linen");
  assert.equal(parsePalette("neon", "ink"), "ink");
  assert.equal(parsePalette("orchard"), "orchard");
});

test("logo band clamps to 8–20", () => {
  assert.equal(clampLogoBand(3), 8);
  assert.equal(clampLogoBand(40), 20);
  assert.equal(clampLogoBand(14), 14);
  assert.equal(clampLogoBand(Number.NaN), 14);
});

test("arrow is ignored on door and kept on wayfinding", () => {
  assert.equal(arrowForTemplate("door", "right"), "off");
  assert.equal(arrowForTemplate("welcome", "up"), "off");
  assert.equal(arrowForTemplate("split", "left"), "off");
  assert.equal(arrowForTemplate("wayfinding", "right"), "right");
});

test("normalizeLook fills countdown and keeps named palette", () => {
  const look = normalizeLook({ palette: "ink", arrow: "left" });
  assert.equal(look.palette, "ink");
  assert.equal(look.arrow, "left");
  assert.equal(look.typeScale, defaultLook().typeScale);
  assert.equal(look.logoBand, 14);
  assert.equal(look.slots.countdown, true);
});
