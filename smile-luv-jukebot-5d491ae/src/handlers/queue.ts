import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
} from "discord.js";
import type { Queue } from "distube";
import type { Subcommand } from "../types.js";
import { BRAND, Colors, REPEAT_LABEL } from "../utils/embed.js";
import { formatTime, songLink } from "../utils/formatters.js";
import { requireQueue } from "../utils/voice.js";

const PAGE_SIZE = 10;
const COLLECTOR_MS = 120_000;

function pageCount(queue: Queue) {
  return Math.max(1, Math.ceil((queue.songs.length - 1) / PAGE_SIZE));
}

function buildPage(queue: Queue, page: number) {
  const [current, ...upcoming] = queue.songs;
  const start = page * PAGE_SIZE;
  const lines = upcoming
    .slice(start, start + PAGE_SIZE)
    .map((song, i) => `\`${start + i + 1}.\` ${songLink(song, 55)} · \`${song.formattedDuration}\``);

  const remaining = Math.max(queue.duration - queue.currentTime, 0);
  return new EmbedBuilder()
    .setColor(Colors.brand)
    .setTitle(`Hàng đợi · ${upcoming.length} bài đang chờ`)
    .setDescription(
      [
        `**Đang phát:** ${songLink(current, 60)} · \`${queue.formattedCurrentTime}/${current.formattedDuration}\``,
        "",
        lines.length ? lines.join("\n") : "_Không có bài nào đang chờ. Thêm bằng `/meraky play`._",
      ].join("\n"),
    )
    .addFields(
      { name: "Tổng thời gian còn lại", value: formatTime(remaining), inline: true },
      { name: "Lặp lại", value: REPEAT_LABEL[queue.repeatMode], inline: true },
      { name: "Âm lượng", value: `${queue.volume}%`, inline: true },
    )
    .setFooter({ text: `${BRAND} · Trang ${page + 1}/${pageCount(queue)}` });
}

function buildNav(page: number, total: number, disabled = false) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("queue:prev")
      .setLabel("Trước")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || page === 0),
    new ButtonBuilder()
      .setCustomId("queue:next")
      .setLabel("Sau")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || page >= total - 1),
  );
}

export const queue: Subcommand = {
  name: "queue",
  description: "Xem danh sách bài trong hàng đợi",
  options: (sub) =>
    sub.addIntegerOption((o) => o.setName("page").setDescription("Trang muốn xem").setMinValue(1)),
  async execute(interaction, distube) {
    const q = requireQueue(distube, interaction.member);
    let page = Math.min((interaction.options.getInteger("page") ?? 1) - 1, pageCount(q) - 1);
    const total = pageCount(q);

    const reply = await interaction.reply({
      embeds: [buildPage(q, page)],
      components: total > 1 ? [buildNav(page, total)] : [],
      withResponse: true,
    });
    const message = reply.resource?.message;
    if (total <= 1 || !message) return;

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: COLLECTOR_MS,
    });

    collector.on("collect", async (button) => {
      if (button.user.id !== interaction.user.id) {
        await button.reply({
          content: "Dùng `/meraky queue` để mở danh sách của riêng bạn.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const live = distube.getQueue(interaction.guildId);
      if (!live || !live.songs.length) {
        collector.stop();
        await button.update({ components: [] });
        return;
      }
      const pages = pageCount(live);
      page = button.customId === "queue:next" ? Math.min(page + 1, pages - 1) : Math.max(page - 1, 0);
      await button.update({ embeds: [buildPage(live, page)], components: [buildNav(page, pages)] });
    });

    collector.on("end", async () => {
      await interaction.editReply({ components: [] }).catch(() => undefined);
    });
  },
};
