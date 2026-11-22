import {
  ActionRowBuilder,
  ComponentType,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
} from "discord.js";
import { YouTubePlugin } from "@distube/youtube";
import type { Subcommand } from "../types.js";
import { BRAND, Colors, warningEmbed } from "../utils/embed.js";
import { songLink, truncate } from "../utils/formatters.js";
import { UserError } from "../utils/errors.js";
import { requireVoiceChannel } from "../utils/voice.js";
import { enqueue } from "./play.js";

const SELECT_TIMEOUT_MS = 60_000;

export const search: Subcommand = {
  name: "search",
  description: "Tìm trên YouTube và chọn bài muốn phát",
  options: (sub) =>
    sub
      .addStringOption((o) =>
        o.setName("query").setDescription("Từ khóa tìm kiếm").setRequired(true).setMaxLength(200),
      )
      .addIntegerOption((o) =>
        o.setName("limit").setDescription("Số kết quả (mặc định 10)").setMinValue(1).setMaxValue(25),
      ),
  async execute(interaction, distube) {
    requireVoiceChannel(interaction.member);
    const youtube = distube.plugins.find((p): p is YouTubePlugin => p instanceof YouTubePlugin);
    if (!youtube) throw new UserError("Chức năng tìm kiếm YouTube chưa được bật.");

    const query = interaction.options.getString("query", true).trim();
    const limit = interaction.options.getInteger("limit") ?? 10;
    await interaction.deferReply();

    const results = await youtube.search(query, { limit, safeSearch: false });
    if (!results.length) {
      await interaction.editReply({
        embeds: [warningEmbed(`Không tìm thấy kết quả nào cho **${truncate(query, 100)}**.`)],
      });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(Colors.brand)
      .setTitle(`Kết quả cho "${truncate(query, 200)}"`)
      .setDescription(
        results
          .map(
            (song, i) =>
              `\`${i + 1}.\` ${songLink(song, 55)} · \`${song.isLive ? "LIVE" : song.formattedDuration}\`\n-# ${truncate(song.uploader.name ?? "—", 60)}`,
          )
          .join("\n"),
      )
      .setFooter({ text: `${BRAND} · Chọn một bài trong menu bên dưới (60 giây)` });

    const menu = new StringSelectMenuBuilder()
      .setCustomId("search:select")
      .setPlaceholder("Chọn bài muốn phát")
      .addOptions(
        results.map((song, i) => ({
          label: truncate(`${i + 1}. ${song.name ?? "Không rõ tên"}`, 100),
          description: truncate(`${song.uploader.name ?? "—"} · ${song.isLive ? "LIVE" : song.formattedDuration}`, 100),
          value: String(i),
        })),
      );

    const message = await interaction.editReply({
      embeds: [embed],
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
    });

    try {
      const selection = await message.awaitMessageComponent({
        componentType: ComponentType.StringSelect,
        time: SELECT_TIMEOUT_MS,
        filter: async (i) => {
          if (i.user.id === interaction.user.id) return true;
          await i.reply({
            content: "Chỉ người dùng lệnh mới chọn được. Hãy tự dùng `/meraky search` nhé.",
            flags: MessageFlags.Ephemeral,
          });
          return false;
        },
      });
      await selection.deferUpdate();
      const song = results[Number(selection.values[0])];
      await enqueue(interaction, distube, song);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "InteractionCollectorError") {
        await interaction.editReply({
          embeds: [warningEmbed("Hết thời gian chọn. Dùng lại `/meraky search` khi bạn sẵn sàng.")],
          components: [],
        });
        return;
      }
      throw error;
    }
  },
};
