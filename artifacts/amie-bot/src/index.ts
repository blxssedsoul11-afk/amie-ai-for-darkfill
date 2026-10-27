import { AmieClient } from "./client.js";
import { loadEvents } from "./handlers/events.js";
import { BOT_NAME } from "./config.js";

const token = process.env["DISCORD_TOKEN"];

if (!token) {
  console.error("DISCORD_TOKEN is required in Replit Secrets.");
  process.exit(1);
}

const client = new AmieClient();

console.log(`Starting ${BOT_NAME}...`);

await loadEvents(client);

await client.login(token);
