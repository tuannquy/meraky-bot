import { EmbedBuilder, MessageFlags } from "discord.js";
import type { Subcommand } from "../types.js";
import { BRAND, Colors } from "../utils/embed.js";

const SECTIONS: { title: string; lines: string[] }[] = [
  {
    title: "Phát nhạc",
    lines: [
      "`/meraky play <link | tên bài> [next]` · phát hoặc thêm vào hàng đợi",
      "`/meraky search <từ khóa>` · tìm và chọn bài từ danh sách",
      "`/meraky playlist <link> [shuffle]` · thêm cả playlist YouTube",
    ],
  },
  {
    title: "Điều khiển",
    lines: [
      "`/meraky pause` · `/meraky resume` · tạm dừng / phát tiếp",
      "`/meraky skip [to]` · bỏ qua hoặc nhảy tới vị trí",
      "`/meraky stop` · dừng, xóa hàng đợi và rời kênh",
      "`/meraky volume [level]` · xem / chỉnh âm lượng 0-100",
    ],
  },
  {
    title: "Hàng đợi",
    lines: [
      "`/meraky queue [page]` · xem danh sách chờ",
      "`/meraky loop [mode]` · tắt / lặp bài / lặp hàng đợi",
      "`/meraky shuffle` · xáo trộn bài đang chờ",
    ],
  },
  {
    title: "Thông tin",
    lines: [
      "`/meraky nowplaying` · bài đang phát và tiến độ",
      "`/meraky lyrics [tên bài]` · lời bài hát",
    ],
  },
];

export const help: Subcommand = {
  name: "help",
  description: "Danh sách lệnh của Meraky",
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(Colors.brand)
      .setTitle(`${BRAND} · Hướng dẫn`)
      .setDescription("Vào một kênh thoại rồi dùng `/meraky play` để bắt đầu.")
      .addFields(SECTIONS.map((s) => ({ name: s.title, value: s.lines.join("\n") })))
      .setFooter({ text: "Tin nhắn \"Đang phát\" có nút điều khiển nhanh." });
    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
