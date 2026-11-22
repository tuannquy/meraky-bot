import { Playlist, type DisTube, type Song } from "distube";
import type { GuildInteraction, Subcommand } from "../types.js";
import { addedPlaylistEmbed, addedSongEmbed, infoEmbed, successEmbed } from "../utils/embed.js";
import { songLink, truncate } from "../utils/formatters.js";
import { requireVoiceChannel } from "../utils/voice.js";

/**
 * Resolves `input` (URL, search text, Song or Playlist), enqueues it and edits the
 * deferred reply with the result. Shared by play, search and playlist.
 */
export async function enqueue(
  interaction: GuildInteraction,
  distube: DisTube,
  input: string | Song | Playlist,
  options: { position?: number; shuffle?: boolean } = {},
) {
  const voiceChannel = requireVoiceChannel(interaction.member);

  if (typeof input === "string") {
    await interaction.editReply({
      embeds: [infoEmbed(`Đang tìm **${truncate(input, 100)}**...`)],
      components: [],
    });
  }

  const resolved =
    typeof input === "string"
      ? await distube.handler.resolve(input, { member: interaction.member })
      : input;

  if (resolved instanceof Playlist && options.shuffle) {
    for (let i = resolved.songs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [resolved.songs[i], resolved.songs[j]] = [resolved.songs[j], resolved.songs[i]];
    }
  }

  const hadQueue = Boolean(distube.getQueue(interaction.guildId)?.songs.length);
  await distube.play(voiceChannel, resolved, {
    member: interaction.member,
    textChannel: interaction.channel ?? undefined,
    position: options.position,
  });

  const queue = distube.getQueue(interaction.guildId);
  if (!queue) return;

  if (resolved instanceof Playlist) {
    await interaction.editReply({ embeds: [addedPlaylistEmbed(resolved)], components: [] });
  } else if (hadQueue) {
    await interaction.editReply({ embeds: [addedSongEmbed(queue, resolved)], components: [] });
  } else {
    await interaction.editReply({
      embeds: [successEmbed(`Bắt đầu phát **${songLink(resolved, 80)}**`)],
      components: [],
    });
  }
}

export const play: Subcommand = {
  name: "play",
  description: "Phát một bài từ link YouTube hoặc từ khóa tìm kiếm",
  options: (sub) =>
    sub
      .addStringOption((o) =>
        o
          .setName("query")
          .setDescription("Link YouTube (video hoặc playlist) hoặc tên bài hát")
          .setRequired(true)
          .setMaxLength(500),
      )
      .addBooleanOption((o) =>
        o.setName("next").setDescription("Chèn lên đầu hàng đợi thay vì cuối"),
      ),
  async execute(interaction, distube) {
    requireVoiceChannel(interaction.member);
    await interaction.deferReply();
    const query = interaction.options.getString("query", true).trim();
    const next = interaction.options.getBoolean("next") ?? false;
    await enqueue(interaction, distube, query, { position: next ? 1 : 0 });
  },
};
