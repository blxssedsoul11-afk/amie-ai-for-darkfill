import { ActivityType, type Client } from "discord.js";
import { BOT_NAME } from "../config.js";

const activities = [
  { name: "your favorite people", type: ActivityType.Watching },
  { name: "the household", type: ActivityType.Playing },
  { name: "when you need a hand", type: ActivityType.Listening },
];

async function clearRegisteredCommands(client: Client): Promise<void> {
  const application = client.application;
  if (application) {
    try {
      await application.commands.set([]);
      console.log("[Amie] Removed all global slash commands.");
    } catch (error) {
      console.error("[Amie] Could not remove global slash commands:", error);
    }
  }

  for (const guild of client.guilds.cache.values()) {
    try {
      await guild.commands.set([]);
    } catch (error) {
      console.error(`[Amie] Could not remove slash commands from guild ${guild.id}:`, error);
    }
  }
  console.log(`[Amie] Checked ${client.guilds.cache.size} guild(s) for old slash commands.`);
}

let activityIndex = 0;

export default {
  name: "clientReady",
  once: true,
  async execute(client: Client): Promise<void> {
    if (client.user && client.user.username !== BOT_NAME) {
      await client.user.setUsername(BOT_NAME).catch((error) => {
        console.warn(`[${BOT_NAME}] Could not update the Discord username:`, error);
      });
    }

    console.log(`[${BOT_NAME}] Online as ${client.user?.tag}`);
    await clearRegisteredCommands(client);

    const setActivity = () => {
      const activity = activities[activityIndex % activities.length]!;
      client.user?.setPresence({
        status: "online",
        activities: [{ name: activity.name, type: activity.type }],
      });
      activityIndex++;
    };
    setActivity();
    setInterval(setActivity, 30_000);
  },
};
