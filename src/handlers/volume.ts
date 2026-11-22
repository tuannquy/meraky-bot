import type { Subcommand } from "../types.js";
import { refreshNowPlayingControls } from "../music/player.js";
import { infoEmbed, successEmbed } from "../utils/embed.js";
import { requireQueue } from "../utils/voice.js";

function volumeBar(level: number) {
  const filled = Math.round(level / 10);
  return `${"█".repeat(filled)}${"░".repeat(10 - filled)}`;
}

export const volume: Subcommand = {
  name: "volume",
  description: "Xem hoặc chỉnh âm lượng (0-100)",
  options: (sub) =>
    sub.addIntegerOption((o) =>
      o.setName("level").setDescription("Mức âm lượng từ 0 đến 100").setMinValue(0).setMaxValue(100),
    ),
  async execute(interaction, distube) {
    const queue = requireQueue(distube, interaction.member);
    const level = interaction.options.getInteger("level");

    if (level === null) {
      await interaction.reply({
        embeds: [infoEmbed(`Âm lượng hiện tại: **${queue.volume}%**\n\`${volumeBar(queue.volume)}\``)],
      });
      return;
    }

    queue.setVolume(level);
    await refreshNowPlayingControls(queue);
    await interaction.reply({
      embeds: [successEmbed(`Đã chỉnh âm lượng: **${level}%**\n\`${volumeBar(level)}\``)],
    });
  },
};
