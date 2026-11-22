import type { Client, GuildTextBasedChannel, Message } from "discord.js";
import { DisTube, Events, RepeatMode, type Queue, type Song } from "distube";
import { config } from "../config.js";
import { detectPrematureEnd, recordFfmpegLine, takeFfmpegTail } from "./streamHealth.js";
import { MerakyYouTubePlugin, preferYtDlpFor } from "./youtubePlugin.js";
import { isYtDlpAvailable } from "./ytdlp.js";
import { controlRow, errorEmbed, infoEmbed, nowPlayingEmbed } from "../utils/embed.js";
import { describeError } from "../utils/errors.js";
import { formatTime, songLink } from "../utils/formatters.js";

const idleTimers = new Map<string, NodeJS.Timeout>();
const nowPlayingMessages = new Map<string, Message>();
const retriedSongs = new Set<string>();
const pendingRetries = new Set<string>();

const RETRY_DELAY_MS = 1000;
const MAX_RETRY_MEMORY = 200;

export function createPlayer(client: Client): DisTube {
  const distube = new DisTube(client, {
    plugins: [new MerakyYouTubePlugin({ cookies: config.youtubeCookies })],
    emitNewSongOnly: true,
    savePreviousSongs: true,
    emitAddSongWhenCreatingQueue: false,
    emitAddListWhenCreatingQueue: false,
    joinNewVoiceChannel: false,
  });

  registerPlayerEvents(distube);
  void isYtDlpAvailable();
  return distube;
}

export function cancelIdleLeave(guildId: string) {
  const timer = idleTimers.get(guildId);
  if (timer) {
    clearTimeout(timer);
    idleTimers.delete(guildId);
  }
}

export function scheduleIdleLeave(
  distube: DisTube,
  guildId: string,
  reason: string,
  textChannel?: GuildTextBasedChannel,
) {
  cancelIdleLeave(guildId);
  const timer = setTimeout(async () => {
    idleTimers.delete(guildId);
    const queue = distube.getQueue(guildId);
    const channel = queue?.textChannel ?? textChannel;
    try {
      if (queue) await queue.stop();
      if (!distube.voices.get(guildId)) return;
      distube.voices.leave(guildId);
      await channel?.send({ embeds: [infoEmbed(`Meraky đã rời kênh thoại vì ${reason}. Hẹn gặp lại!`)] });
    } catch (err) {
      console.error(`[player] Lỗi khi rời kênh ở guild ${guildId}:`, err);
    }
  }, config.idleTimeoutMs);
  idleTimers.set(guildId, timer);
}

async function clearNowPlayingControls(guildId: string) {
  const message = nowPlayingMessages.get(guildId);
  if (!message) return;
  nowPlayingMessages.delete(guildId);
  await message.edit({ components: [] }).catch(() => undefined);
}

export async function refreshNowPlayingControls(queue: Queue) {
  const message = nowPlayingMessages.get(queue.id);
  const song = queue.songs[0];
  if (!message || !song) return;
  await message
    .edit({ embeds: [nowPlayingEmbed(queue, song)], components: [controlRow(queue)] })
    .catch(() => undefined);
}

async function send(queue: Queue, payload: Parameters<NonNullable<Queue["textChannel"]>["send"]>[0]) {
  try {
    return await queue.textChannel?.send(payload);
  } catch (err) {
    console.warn(`[player] Không gửi được tin nhắn vào kênh ở guild ${queue.id}:`, err);
    return undefined;
  }
}

/** A throwing listener would otherwise become an unhandled rejection and fail silently. */
function guard<A extends unknown[]>(event: string, handler: (...args: A) => Promise<void>) {
  return async (...args: A) => {
    try {
      await handler(...args);
    } catch (err) {
      console.error(`[player] Lỗi trong sự kiện ${event}:`, err);
    }
  };
}

async function announceNowPlaying(queue: Queue, song: Song) {
  let message: Message | undefined;
  try {
    message = await send(queue, {
      embeds: [nowPlayingEmbed(queue, song)],
      components: [controlRow(queue)],
    });
  } catch (err) {
    console.error("[player] Không dựng được thẻ Đang phát, dùng bản rút gọn:", err);
    message = await send(queue, {
      embeds: [infoEmbed(`Đang phát **${songLink(song, 80)}**`)],
      components: [controlRow(queue)],
    });
  }
  if (message) nowPlayingMessages.set(queue.id, message);
}

function retryWithYtDlp(distube: DisTube, queue: Queue, song: Song): boolean {
  const key = `${queue.id}:${song.id}`;
  const voiceChannel = queue.voiceChannel;
  if (!voiceChannel || !song.url || retriedSongs.has(key)) return false;

  if (retriedSongs.size >= MAX_RETRY_MEMORY) retriedSongs.clear();
  retriedSongs.add(key);
  preferYtDlpFor.add(song.id);
  if (song.stream.playFromSource) delete song.stream.url;

  const guildId = queue.id;
  const textChannel = queue.textChannel;
  pendingRetries.add(guildId);
  setTimeout(async () => {
    pendingRetries.delete(guildId);
    try {
      await distube.play(voiceChannel, song, {
        member: song.member,
        textChannel,
        position: distube.getQueue(guildId)?.songs.length ? 1 : 0,
      });
    } catch (err) {
      console.error(`[player] Thử lại ${song.id} thất bại:`, err);
      await textChannel?.send({ embeds: [errorEmbed(describeError(err))] }).catch(() => undefined);
    }
  }, RETRY_DELAY_MS);
  return true;
}

async function handleSongFinished(distube: DisTube, queue: Queue, song: Song) {
  const tail = takeFfmpegTail(queue.id);
  const end = detectPrematureEnd(queue, song);
  if (!end) return;

  console.warn(
    `[player] Bài ${song.id} (${formatTime(song.duration)}) dừng sau ${end.playedSeconds.toFixed(1)}s, ffmpeg thoát với mã ${end.ffmpegExitCode}. Log ffmpeg cuối:\n  ${tail.join("\n  ") || "(trống)"}`,
  );

  if (retryWithYtDlp(distube, queue, song)) {
    await send(queue, {
      embeds: [infoEmbed(`Luồng âm thanh bị ngắt sau ${Math.round(end.playedSeconds)} giây. Meraky đang thử lại bằng cách khác...`)],
    });
    return;
  }

  if (queue.repeatMode === RepeatMode.SONG) queue.setRepeatMode(RepeatMode.DISABLED);
  await send(queue, {
    embeds: [
      errorEmbed(
        `YouTube cắt luồng âm thanh của **${songLink(song, 60)}** sau ${Math.round(end.playedSeconds)} giây. ` +
          "Thường do YouTube chặn máy chủ của bot. Chủ bot cần cấu hình `YOUTUBE_COOKIES` (xem README).",
      ),
    ],
  });
}

function registerPlayerEvents(distube: DisTube) {
  distube
    .on(Events.FFMPEG_DEBUG, recordFfmpegLine)
    .on(
      Events.FINISH_SONG,
      guard(Events.FINISH_SONG, (queue, song) => handleSongFinished(distube, queue, song)),
    )
    .on(
      Events.PLAY_SONG,
      guard(Events.PLAY_SONG, async (queue, song) => {
        cancelIdleLeave(queue.id);
        await clearNowPlayingControls(queue.id);
        await announceNowPlaying(queue, song);
      }),
    )
    .on(
      Events.FINISH,
      guard(Events.FINISH, async (queue) => {
        await clearNowPlayingControls(queue.id);
        if (pendingRetries.has(queue.id)) return;
        await send(queue, {
          embeds: [infoEmbed("Hết hàng đợi rồi. Dùng `/meraky play` để thêm bài mới nhé.")],
        });
        scheduleIdleLeave(distube, queue.id, "không còn bài nào để phát", queue.textChannel);
      }),
    )
    .on(
      Events.DELETE_QUEUE,
      guard(Events.DELETE_QUEUE, async (queue) => {
        await clearNowPlayingControls(queue.id);
        if (distube.voices.get(queue.id) && !idleTimers.has(queue.id)) {
          scheduleIdleLeave(distube, queue.id, "không còn bài nào để phát", queue.textChannel);
        }
      }),
    )
    .on(
      Events.DISCONNECT,
      guard(Events.DISCONNECT, async (queue) => {
        cancelIdleLeave(queue.id);
        await clearNowPlayingControls(queue.id);
        await send(queue, {
          embeds: [infoEmbed("Meraky đã bị ngắt khỏi kênh thoại nên hàng đợi đã được xóa.")],
        });
      }),
    )
    .on(
      Events.ERROR,
      guard(Events.ERROR, async (error, queue, song) => {
        console.error(`[player] Lỗi khi phát ${song?.url ?? "bài hát"}:`, error);
        await send(queue, { embeds: [errorEmbed(describeError(error))] });
      }),
    );

  if (process.env.DEBUG_DISTUBE) {
    distube.on(Events.DEBUG, (msg) => console.debug(`[distube] ${msg}`));
  }
}
