import type { Subcommand } from "../types.js";
import { refreshNowPlayingControls } from "../music/player.js";
import { successEmbed } from "../utils/embed.js";
import { UserError } from "../utils/errors.js";
import { requireQueue } from "../utils/voice.js";

export const resume: Subcommand = {
  name: "resume",
  description: "Tiếp tục phát bài đang tạm dừng",
  async execute(interaction, distube) {
    const queue = requireQueue(distube, interaction.member);
    if (!queue.paused) throw new UserError("Nhạc đang phát rồi.");
    await queue.resume();
    await refreshNowPlayingControls(queue);
    await interaction.reply({ embeds: [successEmbed("Tiếp tục phát.")] });
  },
};
