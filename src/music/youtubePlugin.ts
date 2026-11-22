import { YouTubePlugin, type YouTubeSong } from "@distube/youtube";
import { getStreamUrlWithYtDlp, isYtDlpAvailable } from "./ytdlp.js";

/** Song ids whose next stream lookup should try yt-dlp first (set after a stream was cut short). */
export const preferYtDlpFor = new Set<string>();

function reasonOf(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 160);
}

/**
 * YouTube plugin whose stream lookup falls back to yt-dlp when ytdl-core is blocked
 * or broken by a YouTube change, which happens regularly on server IPs.
 */
export class MerakyYouTubePlugin extends YouTubePlugin {
  override async getStreamURL<T = unknown>(song: YouTubeSong<T>): Promise<string> {
    const canUseYtDlp = Boolean(song.url) && (await isYtDlpAvailable());

    if (canUseYtDlp && preferYtDlpFor.has(song.id)) {
      try {
        const url = await getStreamUrlWithYtDlp(song.url!);
        console.log(`[youtube] ${song.id}: dùng luồng từ yt-dlp (thử lại).`);
        return url;
      } catch (err) {
        console.warn(`[yt-dlp] Thử lại thất bại (${reasonOf(err)}), quay về ytdl-core.`);
      }
    }

    try {
      const url = await super.getStreamURL(song);
      console.log(`[youtube] ${song.id}: dùng luồng từ ytdl-core.`);
      return url;
    } catch (primaryError) {
      if (!canUseYtDlp) throw primaryError;
      console.warn(`[youtube] ytdl-core lỗi (${reasonOf(primaryError)}), chuyển sang yt-dlp.`);
      try {
        const url = await getStreamUrlWithYtDlp(song.url!);
        console.log(`[youtube] ${song.id}: dùng luồng từ yt-dlp (dự phòng).`);
        return url;
      } catch (fallbackError) {
        console.warn(`[yt-dlp] Cũng thất bại: ${reasonOf(fallbackError)}`);
        throw primaryError;
      }
    }
  }
}
