import { PermissionFlagsBits, type GuildMember, type VoiceBasedChannel } from "discord.js";
import type { DisTube, Queue } from "distube";
import { UserError } from "./errors.js";

/** Ensures the member is in a voice channel the bot can join (or is already in). */
export function requireVoiceChannel(member: GuildMember): VoiceBasedChannel {
  const channel = member.voice.channel;
  if (!channel) throw new UserError("Bạn cần vào một kênh thoại trước.");

  const me = member.guild.members.me;
  const botChannel = me?.voice.channel;
  if (botChannel && botChannel.id !== channel.id) {
    throw new UserError(`Meraky đang phát ở ${botChannel}. Hãy vào kênh đó để điều khiển nhạc.`);
  }

  if (!botChannel && me) {
    const perms = channel.permissionsFor(me);
    if (!perms?.has([PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) {
      throw new UserError(`Meraky cần quyền **Connect** và **Speak** ở ${channel}.`);
    }
    if (channel.full && !perms.has(PermissionFlagsBits.MoveMembers)) {
      throw new UserError("Kênh thoại đã đầy, Meraky không vào được.");
    }
  }
  return channel;
}

/** Ensures there is an active queue and the member is listening in the same channel. */
export function requireQueue(distube: DisTube, member: GuildMember): Queue {
  const queue = distube.getQueue(member.guild.id);
  if (!queue || !queue.songs.length) throw new UserError("Hiện không có bài nào đang phát.");

  const channel = member.voice.channel;
  if (!channel || channel.id !== queue.voiceChannel?.id) {
    throw new UserError(
      queue.voiceChannel
        ? `Bạn cần ở trong ${queue.voiceChannel} để điều khiển nhạc.`
        : "Bạn cần vào kênh thoại của Meraky để điều khiển nhạc.",
    );
  }
  return queue;
}
