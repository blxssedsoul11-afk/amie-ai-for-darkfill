export const AUTHORIZED_USERS: ReadonlyMap<string, string> = new Map([
  ["1117540437016727612", "Chakala"],
  ["919581893882695740", "Darkfill"],
]);

export function isAuthorizedUser(userId: string): boolean {
  return AUTHORIZED_USERS.has(userId);
}

export const AMIE_WAKE_PHRASES = [
  "hey amie",
  "amie,",
  "amie wake up",
];

export const AMIE_SLEEP_PHRASES = [
  "enough",
  "done",
  "set free",
  "detach",
  "goodbye",
  "bye amie",
  "stop amie",
];

export const DEFAULT_LISTENING_MINUTES = 30;
export const MIN_LISTENING_MINUTES = 10;
export const MAX_LISTENING_MINUTES = 90;

export const MISTRAL_MODEL = "ministral-8b-latest";
export const MISTRAL_VISION_MODEL = "ministral-8b-latest";
export const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";
export const FISH_AUDIO_API_URL = "https://api.fish.audio/v1/tts";
export const FISH_AUDIO_MODEL = "s2.1-pro-free";
export const FISH_AUDIO_REFERENCE_ID = "2a9605eeafe84974b5b20628d42c0060";

export const SESSION_HISTORY_LIMIT = 40;
export const SKIP_SIGNAL = "[SKIP]";
