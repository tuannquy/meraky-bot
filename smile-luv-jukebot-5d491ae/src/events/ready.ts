import { ActivityType, Events, type Client } from "discord.js";
import { config } from "../config.js";
import { merakyCommand } from "../commands/meraky.js";

export function registerReadyEvent(client: Client) {
  client.once(Events.ClientReady, async (ready) => {
    console.log(`[discord] Đã đăng nhập: ${ready.user.tag} (${ready.guilds.cache.size} server)`);
    ready.user.setActivity("/meraky play", { type: ActivityType.Listening });

    const body = [merakyCommand.toJSON()];
    try {
      if (config.guildId) {
        const guild = await ready.guilds.fetch(config.guildId);
        await guild.commands.set(body);
        console.log(`[discord] Đã đăng ký /meraky cho server "${guild.name}".`);
      } else {
        await ready.application.commands.set(body);
        console.log("[discord] Đã đăng ký /meraky toàn cục (có thể mất vài phút để hiện).");
      }
    } catch (err) {
      console.error("[discord] Không đăng ký được slash command:", err);
    }
  });
}
