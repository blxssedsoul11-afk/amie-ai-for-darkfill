import {
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import type { Guild, VoiceBasedChannel } from "discord.js";

const VOICE_READY_TIMEOUT_MS = 15_000;

export async function joinAmieVoiceChannel(
  guild: Guild,
  channel: VoiceBasedChannel,
): Promise<"joined" | "already"> {
  const existing = getVoiceConnection(guild.id);
  if (existing?.joinConfig.channelId === channel.id) {
    try {
      await entersState(existing, VoiceConnectionStatus.Ready, VOICE_READY_TIMEOUT_MS);
      return "already";
    } catch {
      existing.destroy();
    }
  } else {
    existing?.destroy();
  }

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: true,
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, VOICE_READY_TIMEOUT_MS);
    return "joined";
  } catch (error) {
    connection.destroy();
    throw error;
  }
}

export function leaveAmieVoiceChannel(guildId: string): boolean {
  const connection = getVoiceConnection(guildId);
  if (!connection) return false;
  connection.destroy();
  return true;
}
