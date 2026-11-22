import type { Subcommand } from "../types.js";
import { refreshNowPlayingControls } from "../music/player.js";
import { successEmbed } from "../utils/embed.js";
import { UserError } from "../utils/errors.js";
import { requireQueue } from "../utils/voice.js";

export const pause: Subcommand = {
  name: "pause",
  description: "Tạm dừng bài đang phát",
  async execute(interaction, distube) {
    const queue = requireQueue(distube, interaction.member);
    if (queue.paused) throw new UserError("Nhạc đang tạm dừng sẵn rồi. Dùng `/meraky resume` để phát tiếp.");
    await queue.pause();
    await refreshNowPlayingControls(queue);
    await interaction.reply({ embeds: [successEmbed("Đã tạm dừng. Dùng `/meraky resume` để phát tiếp.")] });
  },
};
