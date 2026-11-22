import { Events, type Client, type VoiceBasedChannel } from "discord.js";
import type { DisTube } from "distube";
import { cancelIdleLeave, scheduleIdleLeave } from "../music/player.js";

function hasListeners(channel: VoiceBasedChannel) {
  return channel.members.some((m) => !m.user.bot);
}

export function registerVoiceStateEvents(client: Client, distube: DisTube) {
  client.on(Events.VoiceStateUpdate, (oldState, newState) => {
    const guild = newState.guild;
    const botChannel = guild.members.me?.voice.channel;
    const queue = distube.getQueue(guild.id);

    if (newState.id === client.user?.id && !newState.channelId) {
      cancelIdleLeave(guild.id);
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
