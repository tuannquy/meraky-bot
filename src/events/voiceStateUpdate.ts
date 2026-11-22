import { Events, type Client, type VoiceBasedChannel } from "discord.js";
import type { DisTube } from "distube";
import { cancelIdleLeave, scheduleIdleLeave } from "../music/player.js";
import { purgeStaleSession, resetSession } from "../music/session.js";
import { infoEmbed } from "../utils/embed.js";

const DISCONNECT_GRACE_MS = 10_000;

function hasListeners(channel: VoiceBasedChannel) {
  return channel.members.some((m) => !m.user.bot);
}

export function registerVoiceStateEvents(client: Client, distube: DisTube) {
  client.on(Events.ChannelDelete, async (channel) => {
    if (channel.isDMBased() || !channel.isVoiceBased()) return;
    const guildId = channel.guild.id;
    if (distube.voices.get(guildId)?.channelId !== channel.id) return;

    const textChannel = distube.getQueue(guildId)?.textChannel;
    await resetSession(distube, guildId);
    await textChannel
      ?.send({
        embeds: [infoEmbed(`Kênh thoại **${channel.name}** đã bị xóa nên Meraky đã dọn hàng đợi và rời đi. Vào kênh thoại khác rồi dùng \`/meraky play\` để phát lại.`)],
      })
      .catch(() => undefined);
  });

  client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    const guild = newState.guild;
    const botChannel = guild.members.me?.voice.channel;
    const queue = distube.getQueue(guild.id);

    if (newState.id === client.user?.id && !newState.channelId) {
      cancelIdleLeave(guild.id);
      setTimeout(() => void purgeStaleSession(distube, guild, { notify: true }), DISCONNECT_GRACE_MS).unref();
      return;
    }
    if (!botChannel) return;

    const touchesBotChannel =
      oldState.channelId === botChannel.id || newState.channelId === botChannel.id;
    if (!touchesBotChannel) return;

    if (hasListeners(botChannel)) {
      if (queue?.songs.length) cancelIdleLeave(guild.id);
    } else {
      scheduleIdleLeave(distube, guild.id, "không còn ai trong kênh");
    }
  });
}
