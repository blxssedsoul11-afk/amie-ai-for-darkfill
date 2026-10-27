export type VoiceChannelAction = "join" | "leave";

const VOICE_TARGET = /\b(?:voice(?:\s+(?:channel|chat))?|vc)\b/i;

export function parseVoiceChannelAction(content: string): VoiceChannelAction | null {
  let command = content
    .replace(/<@!?\d+>/g, " ")
    .replace(/^\s*(?:hey\s+)?amie\b[\s,:-]*/i, "")
    .trim();

  command = command
    .replace(/^(?:please|kindly)\b[\s,:-]*/i, "")
    .replace(/^(?:can|could|would|will)\s+you\b[\s,:-]*(?:please\b[\s,:-]*)?/i, "")
    .replace(/^(?:please|kindly)\b[\s,:-]*/i, "")
    .trim();

  if (!VOICE_TARGET.test(command)) return null;
  if (/^(?:join|come|hop)\b/i.test(command)) return "join";
  if (/^(?:leave|disconnect|exit|drop\s+out\s+of)\b/i.test(command)) return "leave";
  return null;
}
