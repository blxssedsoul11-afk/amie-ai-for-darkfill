import { SESSION_HISTORY_LIMIT } from "./config.js";

export interface SessionMessage {
  role: "user" | "assistant";
  content: string;
  authorId?: string;
  authorName?: string;
}

export interface ListeningSession {
  channelId: string;
  guildId: string;
  expiresAt: number;
  timer: NodeJS.Timeout;
  history: SessionMessage[];
}

const sessions = new Map<string, ListeningSession>();

function key(guildId: string, channelId: string): string {
  return `${guildId}:${channelId}`;
}

export const amieState = {
  startSession(
    guildId: string,
    channelId: string,
    minutes: number,
    onExpire: () => void,
  ): ListeningSession {
    const existing = sessions.get(key(guildId, channelId));
    if (existing) clearTimeout(existing.timer);

    const expiresAt = Date.now() + minutes * 60 * 1000;
    const timer = setTimeout(() => {
      sessions.delete(key(guildId, channelId));
      onExpire();
    }, minutes * 60 * 1000);

    const session: ListeningSession = {
      channelId,
      guildId,
      expiresAt,
      timer,
      history: [],
    };
    sessions.set(key(guildId, channelId), session);
    return session;
  },

  endSession(guildId: string, channelId: string): boolean {
    const session = sessions.get(key(guildId, channelId));
    if (!session) return false;
    clearTimeout(session.timer);
    sessions.delete(key(guildId, channelId));
    return true;
  },

  getSession(guildId: string, channelId: string): ListeningSession | undefined {
    return sessions.get(key(guildId, channelId));
  },

  addToHistory(
    guildId: string,
    channelId: string,
    role: "user" | "assistant",
    content: string,
    authorId?: string,
    authorName?: string,
  ): void {
    const session = sessions.get(key(guildId, channelId));
    if (!session) return;
    session.history.push({ role, content, authorId, authorName });
    if (session.history.length > SESSION_HISTORY_LIMIT) {
      session.history.shift();
    }
  },

};
