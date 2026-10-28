import {
  MISTRAL_AUDIO_TRANSCRIPTION_URL,
  MISTRAL_MODEL,
  MISTRAL_API_URL,
  MISTRAL_TRANSCRIPTION_MODEL,
} from "./config.js";

// Content can be plain text OR a multimodal array (text + images).
export type MistralContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: string };

export interface MistralMessage {
  role: "system" | "user" | "assistant";
  content: string | MistralContentPart[];
}

export class MistralRateLimitError extends Error {
  constructor(public readonly retryAfterMs: number | null) {
    super("Mistral API rate limit exceeded.");
    this.name = "MistralRateLimitError";
  }
}

function getRetryAfterMs(response: Response): number | null {
  const retryAfter = response.headers.get("retry-after");
  if (!retryAfter) return null;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const timestamp = Date.parse(retryAfter);
  return Number.isNaN(timestamp) ? null : Math.max(0, timestamp - Date.now());
}

function stripHiddenReasoning(content: string): string {
  return content
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<analysis>[\s\S]*?<\/analysis>/gi, "")
    .replace(/<think>[\s\S]*$/i, "")
    .replace(/<analysis>[\s\S]*$/i, "")
    .trim();
}

export async function callMistral(
  messages: MistralMessage[],
  model: string = MISTRAL_MODEL,
): Promise<string> {
  const apiKey = process.env["MISTRAL_API_KEY"];
  if (!apiKey) throw new Error("MISTRAL_API_KEY is not set.");

  const res = await fetch(MISTRAL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 1024,
      temperature: 0.85,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown error");
    if (res.status === 429) {
      throw new MistralRateLimitError(getRetryAfterMs(res));
    }
    throw new Error(`Mistral API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return stripHiddenReasoning(data.choices[0]?.message.content ?? "");
}

export async function transcribeVoiceAudio(wavAudio: Buffer): Promise<string> {
  const apiKey = process.env["MISTRAL_API_KEY"];
  if (!apiKey) throw new Error("MISTRAL_API_KEY is not set.");

  const audioBytes = new Uint8Array(wavAudio.byteLength);
  audioBytes.set(wavAudio);
  const form = new FormData();
  form.append("model", MISTRAL_TRANSCRIPTION_MODEL);
  form.append(
    "file",
    new Blob([audioBytes.buffer], { type: "audio/wav" }),
    "amie-voice-input.wav",
  );

  const response = await fetch(MISTRAL_AUDIO_TRANSCRIPTION_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const error = await response.text().catch(() => "unknown error");
    throw new Error(`Mistral voice transcription error ${response.status}: ${error}`);
  }

  const result = (await response.json()) as { text?: unknown };
  if (typeof result.text !== "string") {
    throw new Error("Mistral voice transcription returned no transcript.");
  }
  return result.text.trim();
}