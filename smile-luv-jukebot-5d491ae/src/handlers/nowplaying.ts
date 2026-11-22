import type { Subcommand } from "../types.js";
import { nowPlayingEmbed } from "../utils/embed.js";
import { UserError } from "../utils/errors.js";

export const nowplaying: Subcommand = {
  name: "nowplaying",
  description: "Xem thông tin và tiến độ bài đang phát",
  async execute(interaction, distube) {
    const queue = distube.getQueue(interaction.guildId);
    const song = queue?.songs[0];
    if (!queue || !song) throw new UserError("Hiện không có bài nào đang phát.");
    await interaction.reply({ embeds: [nowPlayingEmbed(queue, song, true)] });
  },
};
