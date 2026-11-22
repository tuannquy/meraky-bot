import { VoiceConnectionStatus } from "@discordjs/voice";
import type { Guild } from "discord.js";
import type { DisTube } from "distube";
import { infoEmbed } from "../utils/embed.js";
import { cancelIdleLeave } from "./player.js";

const STOP_TIMEOUT_MS = 1500;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * A session is stale when the bot's voice channel no longer exists (for example a
 * temporary channel removed by a voice-master bot) or the connection died and the
 * bot is not in any channel. DisTube would otherwise keep the old queue and
 * connection around and the bot looks stuck.
 */
export function isSessionStale(distube: DisTube, guild: Guild): boolean {
  const voice = distube.voices.get(guild.id);
  const queue = distube.getQueue(guild.id);
  if (!voice && !queue) return false;

  const channelId = voice?.channelId ?? queue?.voiceChannel?.id;
  if (channelId && !guild.channels.cache.has(channelId)) return true;

  const status = voice?.connection?.state.status;
  const connectionDead =
    status === VoiceConnectionStatus.Disconnected || status === VoiceConnectionStatus.Destroyed;
  return connectionDead && !guild.members.me?.voice.channelId;
}

/** Drops the queue and voice connection of a guild without waiting on DisTube's own timers. */
export async function resetSession(distube: DisTube, guildId: string) {
  cancelIdleLeave(guildId);
  const queue = distube.getQueue(guildId);
  if (queue) {
    await Promise.race([queue.stop().catch(() => undefined), sleep(STOP_TIMEOUT_MS)]);
    if (distube.getQueue(guildId)) queue.remove();
  }
  if (distube.voices.get(guildId)) distube.voices.leave(guildId);
}

/** Cleans up a stale session if there is one. Returns whether anything was cleaned. */
export async function purgeStaleSession(
  distube: DisTube,
  guild: Guild,
  options: { notify?: boolean } = {},
): Promise<boolean> {
  if (!isSessionStale(distube, guild)) return false;

  const textChannel = distube.getQueue(guild.id)?.textChannel;
  console.warn(`[session] Phiên phát ở guild ${guild.id} đã hỏng (kênh thoại bị xóa hoặc mất kết nối), đang dọn.`);
  await resetSession(distube, guild.id);

  if (options.notify) {
    await textChannel
      ?.send({
        embeds: [infoEmbed("Kênh thoại của Meraky không còn nữa nên hàng đợi đã được xóa. Vào một kênh thoại rồi dùng `/meraky play` để phát lại.")],
      })
      .catch(() => undefined);
  }
  return true;
}
