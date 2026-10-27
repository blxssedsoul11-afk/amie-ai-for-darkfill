import { readdirSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import type { AmieClient } from "../client.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function loadEvents(client: AmieClient): Promise<void> {
  const eventsPath = join(__dirname, "../events");
  const files = readdirSync(eventsPath).filter(f => f.endsWith(".ts") || f.endsWith(".js"));

  let loaded = 0;

  for (const file of files) {
    const filePath = join(eventsPath, file);
    try {
      const mod = await import(filePath);
      const event = mod.default ?? mod.event;

      if (!event?.name || !event?.execute) {
        console.warn(`[Events] Skipping ${file}: missing name or execute`);
        continue;
      }

      if (event.once) {
        client.once(event.name, (...args) => event.execute(...args, client));
      } else {
        client.on(event.name, (...args) => event.execute(...args, client));
      }

      loaded++;
    } catch (err) {
      console.error(`[Events] Failed to load ${file}:`, err);
    }
  }

  console.log(`[Events] Loaded ${loaded} events`);
}
