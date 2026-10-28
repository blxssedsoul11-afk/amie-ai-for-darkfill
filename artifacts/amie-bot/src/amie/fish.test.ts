import assert from "node:assert/strict";
import test from "node:test";
import { getReplyDelivery, prepareSpeechText, wantsVoiceReply } from "./fish.js";

test("voice replies are created only for explicit voice requests", () => {
  assert.equal(wantsVoiceReply("Could you answer with a voice reply?"), true);
  assert.equal(wantsVoiceReply("Tell me a joke."), false);
});

test("ordinary text replies stay in text even while Amie is in voice", () => {
  assert.equal(getReplyDelivery("Tell me a joke.", true), "text");
  assert.equal(getReplyDelivery("Could you answer with a voice reply?", true), "voice-channel");
  assert.equal(getReplyDelivery("Could you answer with a voice reply?", false), "voice-message");
});

test("spoken text omits legacy command and reaction tags", () => {
  assert.equal(prepareSpeechText("Hello there. [CMD:ban] [REACT:💜]"), "Hello there.");
});
