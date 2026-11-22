import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ColorResolvable,
} from "discord.js";
import { RepeatMode, type Playlist, type Queue, type Song } from "distube";
import {
  escapeMarkdown,
  formatNumber,
  formatTime,
  orFallback,
  progressBar,
  songLink,
  songTitle,
  truncate,
  uploaderName,
} from "./formatters.js";

export const BRAND = "Meraky";

export const Colors = {
  brand: 0x8b5cf6,
  success: 0x22c55e,
  warning: 0xf59e0b,
  error: 0xef4444,
  info: 0x38bdf8,
} satisfies Record<string, ColorResolvable>;

export const REPEAT_LABEL: Record<RepeatMode, string> = {
  [RepeatMode.DISABLED]: "Tắt",
  [RepeatMode.SONG]: "Lặp bài",
  [RepeatMode.QUEUE]: "Lặp hàng đợi",
};

function base(color: number) {
  return new EmbedBuilder().setColor(color).setFooter({ text: `${BRAND} · /meraky help` });
}

export function successEmbed(description: string) {
  return base(Colors.success).setDescription(description);
}

export function infoEmbed(description: string) {
  return base(Colors.info).setDescription(description);
}

export function warningEmbed(description: string) {
  return base(Colors.warning).setDescription(description);
}

export function errorEmbed(description: string) {
  return base(Colors.error).setTitle("Có lỗi xảy ra").setDescription(description);
}

function requester(song: Song) {
  return song.user ? `<@${song.user.id}>` : "—";
}

export function nowPlayingEmbed(queue: Queue, song: Song, withProgress = false) {
  const embed = base(Colors.brand)
    .setAuthor({ name: queue.paused ? "Đang tạm dừng" : "Đang phát" })
    .setTitle(truncate(songTitle(song), 256))
    .setURL(song.url || null)
    .setThumbnail(song.thumbnail || null)
    .addFields(
      { name: "Kênh", value: truncate(uploaderName(song), 100), inline: true },
      {
        name: "Thời lượng",
        value: song.isLive ? "Trực tiếp" : orFallback(song.formattedDuration, "—"),
        inline: true,
      },
      { name: "Yêu cầu bởi", value: requester(song), inline: true },
      { name: "Âm lượng", value: `${queue.volume}%`, inline: true },
      { name: "Lặp lại", value: REPEAT_LABEL[queue.repeatMode], inline: true },
      { name: "Còn lại", value: `${queue.songs.length - 1} bài`, inline: true },
    );

  if (withProgress) {
    const current = queue.currentTime;
    embed.setDescription(
      `\`${formatTime(current)}\` ${progressBar(current, song.duration)} \`${song.isLive ? "LIVE" : song.formattedDuration}\``,
    );
    if (song.views !== undefined || song.likes !== undefined) {
      embed.addFields({
        name: "Thống kê",
        value: `${formatNumber(song.views)} lượt xem · ${formatNumber(song.likes)} lượt thích`,
      });
    }
  }
  return embed;
}

export function addedSongEmbed(queue: Queue, song: Song) {
  const position = queue.songs.indexOf(song);
  const waitSeconds = queue.songs
    .slice(0, Math.max(position, 0))
    .reduce((sum, s) => sum + (s.duration || 0), 0) - queue.currentTime;

  return base(Colors.success)
    .setAuthor({ name: "Đã thêm vào hàng đợi" })
    .setDescription(`**${songLink(song, 80)}**`)
    .setThumbnail(song.thumbnail || null)
    .addFields(
      { name: "Thời lượng", value: song.isLive ? "Trực tiếp" : song.formattedDuration, inline: true },
      { name: "Vị trí", value: position > 0 ? `#${position}` : "Tiếp theo", inline: true },
      { name: "Phát sau khoảng", value: formatTime(Math.max(waitSeconds, 0)), inline: true },
    );
}

export function addedPlaylistEmbed(playlist: Playlist) {
  const playlistName = escapeMarkdown(truncate(orFallback(playlist.name, "Playlist"), 80));
  return base(Colors.success)
    .setAuthor({ name: "Đã thêm playlist" })
    .setDescription(`**${playlist.url ? `[${playlistName}](${playlist.url})` : playlistName}**`)
    .setThumbnail(playlist.thumbnail || null)
    .addFields(
      { name: "Số bài", value: `${playlist.songs.length}`, inline: true },
      { name: "Tổng thời lượng", value: playlist.formattedDuration, inline: true },
    );
}

export const CONTROL_PREFIX = "meraky-ctl";

export type ControlAction = "toggle" | "skip" | "stop" | "loop" | "shuffle";

export function controlRow(queue: Queue) {
  const btn = (action: ControlAction, label: string, style = ButtonStyle.Secondary) =>
    new ButtonBuilder().setCustomId(`${CONTROL_PREFIX}:${action}`).setLabel(label).setStyle(style);

  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    btn("toggle", queue.paused ? "Tiếp tục" : "Tạm dừng", ButtonStyle.Primary),
    btn("skip", "Bỏ qua"),
    btn("loop", `Lặp: ${REPEAT_LABEL[queue.repeatMode]}`),
    btn("shuffle", "Xáo trộn"),
    btn("stop", "Dừng", ButtonStyle.Danger),
  );
}
