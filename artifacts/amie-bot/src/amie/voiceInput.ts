import { EndBehaviorType, type VoiceConnection } from "@discordjs/voice";
import prism from "prism-media";
import { isAuthorizedUser } from "./config.js";

const INPUT_RATE = 48_000;
const INPUT_CHANNELS = 2;
const OUTPUT_RATE = 16_000;
const INPUT_FRAME_BYTES = INPUT_CHANNELS * 2;
const MAX_UTTERANCE_MS = 20_000;
const MAX_PCM_BYTES = INPUT_RATE * INPUT_FRAME_BYTES * (MAX_UTTERANCE_MS / 1_000);
const MIN_PCM_BYTES = INPUT_RATE * INPUT_FRAME_BYTES * 0.2;
const SILENCE_END_MS = 800;

export type AuthorizedVoiceAudioHandler = (
  guildId: string,
  voiceChannelId: string,
  userId: string,
  wavAudio: Buffer,
) => Promise<void>;

export function createTranscriptionWavFromStereoPcm(stereoPcm: Buffer): Buffer {
  const inputFrames = Math.floor(stereoPcm.length / INPUT_FRAME_BYTES);
  const outputFrames = Math.floor(inputFrames / 3);
  const monoPcm = Buffer.alloc(outputFrames * 2);

  for (let outputFrame = 0; outputFrame < outputFrames; outputFrame++) {
    let sampleTotal = 0;
    for (let inputOffset = 0; inputOffset < 3; inputOffset++) {
      const frameOffset = (outputFrame * 3 + inputOffset) * INPUT_FRAME_BYTES;
      sampleTotal += stereoPcm.readInt16LE(frameOffset);
      sampleTotal += stereoPcm.readInt16LE(frameOffset + 2);
    }
    monoPcm.writeInt16LE(Math.round(sampleTotal / 6), outputFrame * 2);
  }

  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + monoPcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(OUTPUT_RATE, 24);
  header.writeUInt32LE(OUTPUT_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(monoPcm.length, 40);
  return Buffer.concat([header, monoPcm]);
}

function captureAuthorizedUtterance(
  connection: VoiceConnection,
  userId: string,
): Promise<Buffer | null> {
  const opusStream = connection.receiver.subscribe(userId, {
    end: { behavior: EndBehaviorType.AfterSilence, duration: SILENCE_END_MS },
  });
  const decoder = new prism.opus.Decoder({
    rate: INPUT_RATE,
    channels: INPUT_CHANNELS,
    frameSize: 960,
  });

  return new Promise((resolve, reject) => {
    const pcmChunks: Buffer[] = [];
    let pcmBytes = 0;
    let settled = false;
    let captureTimer: NodeJS.Timeout;

    const cleanup = () => {
      clearTimeout(captureTimer);
      opusStream.off("error", onError);
      decoder.off("error", onError);
      decoder.off("data", onData);
      decoder.off("end", onEnd);
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      opusStream.unpipe(decoder);
      opusStream.destroy();
      decoder.destroy();
      reject(error);
    };
    const finishAtLimit = () => {
      if (settled) return;
      opusStream.unpipe(decoder);
      opusStream.destroy();
      decoder.end();
    };
    const onError = (error: Error) => fail(error);
    const onData = (chunk: Buffer) => {
      const pcmChunk = Buffer.from(chunk);
      pcmChunks.push(pcmChunk);
      pcmBytes += pcmChunk.length;
      if (pcmBytes >= MAX_PCM_BYTES) finishAtLimit();
    };
    const onEnd = () => {
      if (settled) return;
      settled = true;
      cleanup();
      if (pcmBytes < MIN_PCM_BYTES) {
        resolve(null);
        return;
      }
      resolve(createTranscriptionWavFromStereoPcm(Buffer.concat(pcmChunks, pcmBytes)));
    };

    opusStream.once("error", onError);
    decoder.once("error", onError);
    decoder.on("data", onData);
    decoder.once("end", onEnd);
    captureTimer = setTimeout(finishAtLimit, MAX_UTTERANCE_MS);
    opusStream.pipe(decoder);
  });
}

export function attachAuthorizedVoiceReceiver(
  connection: VoiceConnection,
  onAudio: AuthorizedVoiceAudioHandler,
): () => void {
  const processingUsers = new Set<string>();
  const guildId = connection.joinConfig.guildId;
  const voiceChannelId = connection.joinConfig.channelId;
  if (!voiceChannelId) return () => undefined;

  const onSpeakingStart = (userId: string) => {
    if (!isAuthorizedUser(userId) || processingUsers.has(userId)) return;
    processingUsers.add(userId);

    void captureAuthorizedUtterance(connection, userId)
      .then((wavAudio) => {
        if (!wavAudio) return;
        void onAudio(guildId, voiceChannelId, userId, wavAudio).catch((error: unknown) => {
          console.warn("[Amie] Could not handle authorized voice audio:", error);
        });
      })
      .catch((error: unknown) => {
        console.warn("[Amie] Could not process authorized voice audio:", error);
      })
      .finally(() => processingUsers.delete(userId));
  };

  connection.receiver.speaking.on("start", onSpeakingStart);
  return () => {
    connection.receiver.speaking.off("start", onSpeakingStart);
    for (const userId of processingUsers) {
      connection.receiver.subscriptions.get(userId)?.destroy();
    }
    processingUsers.clear();
  };
}
