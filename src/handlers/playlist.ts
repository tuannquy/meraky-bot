import type { Subcommand } from "../types.js";
import { UserError } from "../utils/errors.js";
import { isYouTubePlaylistUrl } from "../utils/formatters.js";
import { requireVoiceChannel } from "../utils/voice.js";
import { enqueue } from "./play.js";

export const playlist: Subcommand = {
  name: "playlist",
  description: "Thêm toàn bộ một playlist YouTube vào hàng đợi",
  options: (sub) =>
    sub
      .addStringOption((o) =>
        o
          .setName("url")
          .setDescription("Link playlist YouTube (có tham số list=...)")
          .setRequired(true)
          .setMaxLength(500),
      )
      .addBooleanOption((o) => o.setName("shuffle").setDescription("Xáo trộn playlist trước khi thêm")),
  async execute(interaction, distube) {
    const url = interaction.options.getString("url", true).trim();
    if (!isYouTubePlaylistUrl(url)) {
      throw new UserError(
        "Đây không phải link playlist YouTube. Link hợp lệ có dạng `https://www.youtube.com/playlist?list=...`.",
      );
    }
    requireVoiceChannel(interaction.member);
    await interaction.deferReply();
    const shuffle = interaction.options.getBoolean("shuffle") ?? false;
    await enqueue(interaction, distube, url, { shuffle });
  },
};
