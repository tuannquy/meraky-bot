import { Client, Events, GatewayIntentBits } from "discord.js";
import type { DisTube } from "distube";
import { createPlayer } from "./music/player.js";
import { registerInteractionEvents } from "./events/interactionCreate.js";
import { registerReadyEvent } from "./events/ready.js";
import { registerVoiceStateEvents } from "./events/voiceStateUpdate.js";

export interface Bot {
  client: Client;
  distube: DisTube;
}

export function createBot(): Bot {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });
  const distube = createPlayer(client);

  client.on(Events.Error, (err) => console.error("[discord] Client error:", err));
  client.on(Events.ShardError, (err, shardId) => console.error(`[discord] Shard ${shardId} lỗi:`, err));

  registerReadyEvent(client);
  registerInteractionEvents(client, distube);
  registerVoiceStateEvents(client, distube);

  return { client, distube };
}
