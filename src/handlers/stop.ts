import type { Subcommand } from "../types.js";
import { successEmbed } from "../utils/embed.js";
import { requireQueue } from "../utils/voice.js";

export const stop: Subcommand = {
  name: "stop",
  description: "Dừng phát, xóa hàng đợi và rời kênh thoại",
  async execute(interaction, distube) {
    const queue = requireQueue(distube, interaction.member);
    await queue.stop();
    distube.voices.leave(interaction.guildId);
    await interaction.reply({ embeds: [successEmbed("Đã dừng phát, xóa hàng đợi và rời kênh thoại.")] });
  },
};
