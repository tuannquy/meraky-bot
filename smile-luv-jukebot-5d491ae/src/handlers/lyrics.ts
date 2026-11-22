import { EmbedBuilder } from "discord.js";
import type { Subcommand } from "../types.js";
import { findLyrics } from "../music/lyricsService.js";
import { BRAND, Colors, warningEmbed } from "../utils/embed.js";
import { chunkText, truncate } from "../utils/formatters.js";
import { UserError } from "../utils/errors.js";

const EMBED_TEXT_LIMIT = 4000;
const MAX_EMBEDS = 3;

export const lyrics: Subcommand = {
  name: "lyrics",
  description: "Xem lời bài đang phát hoặc tìm lời của một bài bất kỳ",
  options: (sub) =>
    sub.addStringOption((o) =>
      o.setName("query").setDescription("Tên bài hát (bỏ trống để lấy bài đang phát)").setMaxLength(200),
    ),
  async execute(interaction, distube) {
    const current = distube.getQueue(interaction.guildId)?.songs[0];
    const query = interaction.options.getString("query")?.trim() || current?.name;
    if (!query) {
      throw new UserError("Không có bài nào đang phát. Hãy nhập tên bài: `/meraky lyrics query:<tên bài>`.");
    }

    await interaction.deferReply();
    const result = await findLyrics(query);
    if (!result) {
      await interaction.editReply({
        embeds: [warningEmbed(`Không tìm thấy lời cho **${truncate(query, 100)}**. Thử nhập tên bài kèm ca sĩ nhé.`)],
      });
      return;
    }

    const chunks = chunkText(result.lyrics, EMBED_TEXT_LIMIT);
    const shown = chunks.slice(0, MAX_EMBEDS);
    const embeds = shown.map((chunk, i) => {
      const embed = new EmbedBuilder().setColor(Colors.brand).setDescription(chunk);
      if (i === 0) {
        embed
          .setTitle(truncate(`${result.title} — ${result.artist}`, 256))
          .setURL(result.url ?? null)
          .setThumbnail(result.thumbnail ?? current?.thumbnail ?? null);
      }
      if (i === shown.length - 1) {
        const more = chunks.length > shown.length ? " · Lời bài quá dài, đã rút gọn" : "";
        embed.setFooter({ text: `${BRAND} · Nguồn: ${result.source}${more}` });
      }
      return embed;
    });

    await interaction.editReply({ embeds });
  },
};
