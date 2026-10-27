import {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  StreamType,
  VoiceConnectionStatus,
  type AudioPlayer,
  type VoiceConnection,
} from "@discordjs/voice";
import { Readable } from "node:stream";
import type { Guild, VoiceBasedChannel } from "discord.js";
import type { FishAudioResult } from "./fish.js";

const VOICE_READY_TIMEOUT_MS = 15_000;
const audioPlayers = new Map<string, { connection: VoiceConnection; player: AudioPlayer }>();
const speechQueues = new Map<string, Promise<void>>();
const playbackVersions = new Map<string, number>();

function resetVoicePlayback(guildId: string): void {
  playbackVersions.set(guildId, (playbackVersions.get(guildId) ?? 0) + 1);
  audioPlayers.get(guildId)?.player.stop(true);
  audioPlayers.delete(guildId);
}

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
      resetVoicePlayback(guild.id);
      existing.destroy();
    }
  } else {
    if (existing) resetVoicePlayback(guild.id);
    existing?.destroy();
  }

  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: false,
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
  resetVoicePlayback(guildId);
  connection.destroy();
  return true;
}

export function isAmieVoiceConnectionReady(guildId: string): boolean {
  return getVoiceConnection(guildId)?.state.status === VoiceConnectionStatus.Ready;
}

function getAudioPlayer(guildId: string, connection: VoiceConnection): AudioPlayer {
  const existing = audioPlayers.get(guildId);
  if (existing?.connection === connection) return existing.player;

  existing?.player.stop(true);
  const player = createAudioPlayer();
  player.on("error", (error) => {
    console.warn("[Amie] Voice audio playback failed:", error);
  });
  connection.subscribe(player);
  audioPlayers.set(guildId, { connection, player });
  return player;
}

function waitForPlayback(player: AudioPlayer, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      player.off(AudioPlayerStatus.Idle, onIdle);
      player.off("error", onError);
    };
    const onIdle = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const timeout = setTimeout(() => {
      cleanup();
      player.stop(true);
      reject(new Error("Voice playback timed out."));
    }, timeoutMs);

    player.once(AudioPlayerStatus.Idle, onIdle);
    player.once("error", onError);
  });
}

async function playInVoiceChannel(
  guildId: string,
  audio: FishAudioResult,
  version: number,
): Promise<boolean> {
  if ((playbackVersions.get(guildId) ?? 0) !== version) return false;

  const connection = getVoiceConnection(guildId);
  if (!connection || connection.state.status !== VoiceConnectionStatus.Ready) return false;

  const player = getAudioPlayer(guildId, connection);
  const resource = createAudioResource(Readable.from([audio.audio]), {
    inputType: StreamType.OggOpus,
  });
  const timeoutMs = Math.max(15_000, Math.ceil(audio.durationSecs + 10) * 1_000);
  const playbackFinished = waitForPlayback(player, timeoutMs);
  try {
    player.play(resource);
  } catch (error) {
    player.stop(true);
    await playbackFinished.catch(() => undefined);
    throw error;
  }
  await playbackFinished;
  return (playbackVersions.get(guildId) ?? 0) === version;
}

export function speakInAmieVoiceChannel(
  guildId: string,
  audio: FishAudioResult,
): Promise<boolean> {
  const version = playbackVersions.get(guildId) ?? 0;
  const previous = speechQueues.get(guildId) ?? Promise.resolve();
  const playback = previous
    .catch(() => undefined)
    .then(() => playInVoiceChannel(guildId, audio, version));
  const queueTail = playback.then(
    () => undefined,
    () => undefined,
  );
  speechQueues.set(guildId, queueTail);
  void queueTail.then(() => {
    if (speechQueues.get(guildId) === queueTail) speechQueues.delete(guildId);
  });
  return playback;
}
