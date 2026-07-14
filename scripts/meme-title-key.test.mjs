import { strict as assert } from "node:assert";
import { memeTitleKey } from "./meme-title-key.mjs";

assert.equal(
  memeTitleKey('임요환 "테란의 황제"'),
  memeTitleKey("임요환 '테란의 황제'")
);
assert.equal(memeTitleKey("1도 없다 / 1도 모르겠다"), memeTitleKey("1도없다·1도모르겠다"));
assert.notEqual(memeTitleKey("간 때문이야"), memeTitleKey("간 때문이야 2차"));
console.log("meme-title-key safeguards OK");
