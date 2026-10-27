import { Client, GatewayIntentBits, Partials } from "discord.js";

export class AmieClient extends Client {
  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Channel],
      allowedMentions: {
        parse: [],
        repliedUser: false,
      },
    });
  }
}
