import assert from "node:assert/strict";
import test from "node:test";
import { shouldEmitFireworks } from "./effect_triggers.mjs";

test("smile and laugh both emit fireworks", () => {
  assert.equal(shouldEmitFireworks("smile"), true);
  assert.equal(shouldEmitFireworks("laugh"), true);
});

test("neutral faces do not emit fireworks", () => {
  assert.equal(shouldEmitFireworks("neutral"), false);
});
