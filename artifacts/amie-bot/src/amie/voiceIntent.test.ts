import assert from "node:assert/strict";
import test from "node:test";
import { parseVoiceChannelAction } from "./voiceIntent.js";

test("recognizes direct join requests", () => {
  assert.equal(parseVoiceChannelAction("Amie, join my voice channel."), "join");
  assert.equal(parseVoiceChannelAction("Could you please come to VC?"), "join");
  assert.equal(parseVoiceChannelAction("<@123456789> hop into voice chat"), "join");
});

test("recognizes direct leave requests", () => {
  assert.equal(parseVoiceChannelAction("Amie, leave voice."), "leave");
  assert.equal(parseVoiceChannelAction("Could you disconnect from the voice channel?"), "leave");
});

test("does not treat ordinary conversation as a voice command", () => {
  assert.equal(parseVoiceChannelAction("I joined voice earlier."), null);
  assert.equal(parseVoiceChannelAction("Could you send that as a voice reply?"), null);
  assert.equal(parseVoiceChannelAction("Don't join voice yet."), null);
});
