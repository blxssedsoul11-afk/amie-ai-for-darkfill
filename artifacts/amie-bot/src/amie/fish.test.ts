import assert from "node:assert/strict";
import test from "node:test";
import { prepareSpeechText, wantsVoiceReply } from "./fish.js";

test("voice replies are created only for explicit voice requests", () => {
  assert.equal(wantsVoiceReply("Could you answer with a voice reply?"), true);
  assert.equal(wantsVoiceReply("Tell me a joke."), false);
});

test("spoken text omits legacy command and reaction tags", () => {
  assert.equal(prepareSpeechText("Hello there. [CMD:ban] [REACT:💜]"), "Hello there.");
});
