import { RepeatMode } from "distube";
import type { Subcommand } from "../types.js";
import { refreshNowPlayingControls } from "../music/player.js";
import { REPEAT_LABEL, successEmbed } from "../utils/embed.js";
import { requireQueue } from "../utils/voice.js";

const MODES: Record<string, RepeatMode> = {
  off: RepeatMode.DISABLED,
  song: RepeatMode.SONG,
  queue: RepeatMode.QUEUE,
};

export const loop: Subcommand = {
  name: "loop",
  description: "Chọn chế độ lặp: tắt, lặp bài hiện tại hoặc lặp cả hàng đợi",
  options: (sub) =>
    sub.addStringOption((o) =>
      o
        .setName("mode")
        .setDescription("Chế độ lặp (bỏ trống để chuyển vòng)")
        .addChoices(
          { name: "Tắt", value: "off" },
          { name: "Lặp bài hiện tại", value: "song" },
          { name: "Lặp cả hàng đợi", value: "queue" },
        ),
    ),
  async execute(interaction, distube) {
    const queue = requireQueue(distube, interaction.member);
    const choice = interaction.options.getString("mode");
    const mode = queue.setRepeatMode(choice ? MODES[choice] : undefined) as RepeatMode;
    await refreshNowPlayingControls(queue);
    await interaction.reply({ embeds: [successEmbed(`Chế độ lặp: **${REPEAT_LABEL[mode]}**`)] });
  },
};
