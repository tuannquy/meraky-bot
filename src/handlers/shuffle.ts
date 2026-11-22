import type { Subcommand } from "../types.js";
import { refreshNowPlayingControls } from "../music/player.js";
import { successEmbed } from "../utils/embed.js";
import { UserError } from "../utils/errors.js";
import { requireQueue } from "../utils/voice.js";

export const shuffle: Subcommand = {
  name: "shuffle",
  description: "Xáo trộn thứ tự các bài đang chờ",
  async execute(interaction, distube) {
    const queue = requireQueue(distube, interaction.member);
    if (queue.songs.length < 3) throw new UserError("Cần ít nhất 2 bài đang chờ để xáo trộn.");
    await queue.shuffle();
    await refreshNowPlayingControls(queue);
    await interaction.reply({
      embeds: [successEmbed(`Đã xáo trộn ${queue.songs.length - 1} bài. Xem lại bằng \`/meraky queue\`.`)],
    });
  },
};
