import assert from "node:assert/strict";
import { test } from "node:test";
import { PANEL_UNIT, panelRestartCommands } from "./panel.ts";

test("panel restart argv is a fixed unit name", () => {
  const steps = panelRestartCommands();
  assert.ok(steps.length >= 1);
  for (const step of steps) {
    assert.ok(step.args.includes("try-restart"));
    assert.ok(step.args.includes(PANEL_UNIT));
    assert.equal(
      step.args.some((arg) => arg.includes(" ") || arg.includes(";") || arg.includes("|")),
      false,
    );
  }
});
