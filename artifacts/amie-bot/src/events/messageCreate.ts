import type { Message } from "discord.js";
import { isAuthorizedUser } from "../amie/config.js";
import { handleAmieMessage } from "../amie/handler.js";

export default {
  name: "messageCreate",
  once: false,
  async execute(message: Message): Promise<void> {
    if (message.author.bot) return;
    if (!isAuthorizedUser(message.author.id)) return;
    await handleAmieMessage(message);
  },
};
