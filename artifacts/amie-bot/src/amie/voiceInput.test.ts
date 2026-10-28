import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import test from "node:test";
import type { VoiceConnection } from "@discordjs/voice";
import prism from "prism-media";
import {
  attachAuthorizedVoiceReceiver,
  createTranscriptionWavFromStereoPcm,
} from "./voiceInput.js";

test("transcription audio is mono 16 kHz WAV", () => {
  const stereoPcm = Buffer.alloc(6 * 4);
  for (let frame = 0; frame < 3; frame++) {
    stereoPcm.writeInt16LE(1_000, frame * 4);
    stereoPcm.writeInt16LE(3_000, frame * 4 + 2);
  }
  for (let frame = 3; frame < 6; frame++) {
    stereoPcm.writeInt16LE(-3_000, frame * 4);
    stereoPcm.writeInt16LE(-1_000, frame * 4 + 2);
  }

  const wav = createTranscriptionWavFromStereoPcm(stereoPcm);
  assert.equal(wav.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(wav.subarray(8, 12).toString("ascii"), "WAVE");
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt32LE(24), 16_000);
  assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.readUInt32LE(40), 4);
  assert.equal(wav.readInt16LE(44), 2_000);
  assert.equal(wav.readInt16LE(46), -2_000);
});

test("voice receiver never subscribes to an unauthorized user", () => {
  const speaking = new EventEmitter();
  const subscribedUsers: string[] = [];
  const connection = {
    joinConfig: { guildId: "guild", channelId: "voice" },
    receiver: {
      speaking,
      subscriptions: new Map(),
      subscribe(userId: string) {
        subscribedUsers.push(userId);
        return Readable.from([]);
      },
    },
  } as unknown as VoiceConnection;
  const stop = attachAuthorizedVoiceReceiver(connection, async () => undefined);

  speaking.emit("start", "123456789");
  assert.deepEqual(subscribedUsers, []);
  stop();
});

test("voice receiver subscribes to an authorized owner", () => {
  const speaking = new EventEmitter();
  const subscribedUsers: string[] = [];
  const connection = {
    joinConfig: { guildId: "guild", channelId: "voice" },
    receiver: {
      speaking,
      subscriptions: new Map(),
      subscribe(userId: string) {
        subscribedUsers.push(userId);
        return Readable.from([]);
      },
    },
  } as unknown as VoiceConnection;
  const stop = attachAuthorizedVoiceReceiver(connection, async () => undefined);

  speaking.emit("start", "1117540437016727612");
  assert.deepEqual(subscribedUsers, ["1117540437016727612"]);
  stop();
});

test("voice receiver decodes an authorized Opus utterance to WAV", async () => {
  const encoder = new prism.opus.Encoder({
    rate: 48_000,
    channels: 2,
    frameSize: 960,
  });
  const opusPackets: Buffer[] = [];
  encoder.on("data", (packet: Buffer) => opusPackets.push(Buffer.from(packet)));
  const encoded = new Promise<Buffer[]>((resolve, reject) => {
    encoder.once("error", reject);
    encoder.once("end", () => resolve(opusPackets));
    const silentPcmFrame = Buffer.alloc(960 * 2 * 2);
    for (let frame = 0; frame < 15; frame++) encoder.write(silentPcmFrame);
    encoder.end();
  });
  const packets = await encoded;

  const speaking = new EventEmitter();
  const subscriptions = new Map<string, Readable>();
  const connection = {
    joinConfig: { guildId: "guild", channelId: "voice" },
    receiver: {
      speaking,
      subscriptions,
      subscribe(userId: string) {
        const stream = Readable.from(packets);
        subscriptions.set(userId, stream);
        return stream;
      },
    },
  } as unknown as VoiceConnection;
  let resolveAudio!: (audio: Buffer) => void;
  const receivedAudio = new Promise<Buffer>((resolve) => {
    resolveAudio = resolve;
  });
  const stop = attachAuthorizedVoiceReceiver(connection, async (_guild, _channel, _user, audio) => {
    resolveAudio(audio);
  });

  speaking.emit("start", "1117540437016727612");
  const wav = await Promise.race([
    receivedAudio,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timed out waiting for decoded voice audio.")), 3_000),
    ),
  ]);
  stop();

  assert.equal(wav.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(wav.readUInt32LE(24), 16_000);
  assert.ok(wav.length > 44);
});
