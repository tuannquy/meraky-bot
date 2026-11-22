import type { Subcommand } from "../types.js";
import { successEmbed } from "../utils/embed.js";
import { songLink } from "../utils/formatters.js";
import { UserError } from "../utils/errors.js";
import { requireQueue } from "../utils/voice.js";

export const skip: Subcommand = {
  name: "skip",
  description: "Bỏ qua bài hiện tại (hoặc nhảy tới một vị trí trong hàng đợi)",
  options: (sub) =>
    sub.addIntegerOption((o) =>
      o.setName("to").setDescription("Nhảy thẳng tới bài ở vị trí này trong /meraky queue").setMinValue(1),
    ),
  async execute(interaction, distube) {
    const queue = requireQueue(distube, interaction.member);
    const current = queue.songs[0];
    const to = interaction.options.getInteger("to");

    if (to !== null) {
      if (to >= queue.songs.length) {
        throw new UserError(`Hàng đợi chỉ có ${queue.songs.length - 1} bài đang chờ.`);
      }
      const next = await queue.jump(to);
      await interaction.reply({
        embeds: [successEmbed(`Đã nhảy tới **${songLink(next)}** (bỏ qua ${to} bài).`)],
      });
      return;
    }

    if (queue.songs.length <= 1 && !queue.autoplay) {
      await queue.stop();
      await interaction.reply({
        embeds: [successEmbed(`Đã bỏ qua **${songLink(current)}**. Hàng đợi đã hết.`)],
      });
      return;
    }

    const next = await queue.skip();
    await interaction.reply({
      embeds: [successEmbed(`Đã bỏ qua **${songLink(current)}**.\nTiếp theo: **${songLink(next)}**`)],
    });
  },
};
