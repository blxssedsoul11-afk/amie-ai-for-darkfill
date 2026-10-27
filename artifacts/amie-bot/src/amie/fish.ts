import {
  FISH_AUDIO_API_URL,
  FISH_AUDIO_MODEL,
  FISH_AUDIO_REFERENCE_ID,
} from "./config.js";

const DISCORD_VOICE_MESSAGE_FLAG = 8192;
const OPUS_SAMPLE_RATE = 48_000;

export interface FishAudioResult {
  audio: Buffer;
  durationSecs: number;
  waveform: string;
}

function getOggDurationSecs(audio: Buffer): number {
  let offset = 0;
  let lastGranulePosition = 0n;

  while (offset + 27 <= audio.length) {
    if (audio.subarray(offset, offset + 4).toString("ascii") !== "OggS") break;

    const segmentCount = audio[offset + 26]!;
    const segmentTableEnd = offset + 27 + segmentCount;
    if (segmentTableEnd > audio.length) break;

    const bodyLength = audio
      .subarray(offset + 27, segmentTableEnd)
      .reduce((sum, length) => sum + length, 0);
    const pageEnd = segmentTableEnd + bodyLength;
    if (pageEnd > audio.length) break;

    const granulePosition = audio.readBigUInt64LE(offset + 6);
    if (granulePosition > lastGranulePosition) lastGranulePosition = granulePosition;
    offset = pageEnd;
  }

  return Math.max(1, Number(lastGranulePosition) / OPUS_SAMPLE_RATE);
}

function buildWaveform(audio: Buffer): string {
  const points = 256;
  const waveform = Buffer.alloc(points);
  const start = Math.min(128, audio.length);
  const usableLength = Math.max(1, audio.length - start);

  for (let index = 0; index < points; index++) {
    const chunkStart = start + Math.floor((index * usableLength) / points);
    const chunkEnd = start + Math.floor(((index + 1) * usableLength) / points);
    let total = 0;
    let count = 0;

    for (let cursor = chunkStart; cursor < Math.max(chunkStart + 1, chunkEnd); cursor++) {
      const value = audio[cursor % audio.length]!;
      total += Math.abs(value - 128);
      count++;
    }

    waveform[index] = Math.max(12, Math.min(255, Math.round((total / count) * 2.2)));
  }

  return waveform.toString("base64");
}

export function prepareSpeechText(text: string): string {
  const cleaned = text
    .replace(/\[EMBED\][\s\S]*?\[\/EMBED\]/gi, "")
    .replace(/\[GIF:[^\]]+\]/gi, "")
    .replace(/\[CMD:[^\]]+\]/gi, "")
    .replace(/\[REACT:[^\]]+\]/gi, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[*_~`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.slice(0, 2_000) || "I don't have anything to add.";
}

export function wantsVoiceReply(content: string): boolean {
  return /\b(?:voice message|voice note|audio message|voice reply|audio reply|send (?:that|this|it|me) (?:as )?(?:a )?(?:voice|audio)|give me (?:a )?(?:voice|audio)|(?:reply|respond|answer) (?:with|in) (?:a )?(?:voice|audio)|say (?:that|this|it) aloud|read (?:that|this|it) aloud|speak (?:that|this|it))\b/i.test(
    content,
  );
}

export async function synthesizeVoice(text: string): Promise<FishAudioResult> {
  const apiKey = process.env["FISH_AUDIO_API_KEY"];
  if (!apiKey) throw new Error("FISH_AUDIO_API_KEY is not set.");

  const response = await fetch(FISH_AUDIO_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      model: FISH_AUDIO_MODEL,
    },
    body: JSON.stringify({
      text: `[warmly] ${prepareSpeechText(text)}`,
      reference_id: FISH_AUDIO_REFERENCE_ID,
      format: "opus",
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "unknown error");
    throw new Error(`Fish Audio API error ${response.status}: ${detail}`);
  }

  const audio = Buffer.from(await response.arrayBuffer());
  if (audio.subarray(0, 4).toString("ascii") !== "OggS") {
    throw new Error("Fish Audio returned audio that is not an Ogg Opus file.");
  }

  return {
    audio,
    durationSecs: getOggDurationSecs(audio),
    waveform: buildWaveform(audio),
  };
}

export async function sendVoiceMessage(
  channelId: string,
  result: FishAudioResult,
): Promise<void> {
  const discordToken = process.env["DISCORD_TOKEN"];
  if (!discordToken) throw new Error("DISCORD_TOKEN is not set.");

  const form = new FormData();
  form.append(
    "payload_json",
    JSON.stringify({
      flags: DISCORD_VOICE_MESSAGE_FLAG,
      attachments: [
        {
          id: "0",
          filename: "amie-voice.ogg",
          duration_secs: result.durationSecs,
          waveform: result.waveform,
        },
      ],
    }),
  );
  form.append(
    "files[0]",
    (() => {
      const audioBytes = new Uint8Array(result.audio.byteLength);
      audioBytes.set(result.audio);
      return new Blob([audioBytes.buffer], { type: "audio/ogg; codecs=opus" });
    })(),
    "amie-voice.ogg",
  );

  const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${discordToken}` },
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "unknown error");
    throw new Error(`Discord voice message error ${response.status}: ${detail}`);
  }
}