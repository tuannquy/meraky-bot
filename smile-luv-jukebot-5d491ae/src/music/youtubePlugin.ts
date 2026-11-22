import { YouTubePlugin, type YouTubeSong } from "@distube/youtube";
import { getStreamUrlWithYtDlp, isYtDlpAvailable } from "./ytdlp.js";

/**
 * YouTube plugin whose stream lookup falls back to yt-dlp when ytdl-core is blocked
 * or broken by a YouTube change, which happens regularly on server IPs.
 */
export class MerakyYouTubePlugin extends YouTubePlugin {
  override async getStreamURL<T = unknown>(song: YouTubeSong<T>): Promise<string> {
    try {
      return await super.getStreamURL(song);
    } catch (primaryError) {
      if (!song.url || !(await isYtDlpAvailable())) throw primaryError;
      const reason = primaryError instanceof Error ? primaryError.message : String(primaryError);
      console.warn(`[youtube] ytdl-core lỗi (${reason.slice(0, 120)}), chuyển sang yt-dlp.`);
      try {
        return await getStreamUrlWithYtDlp(song.url);
      } catch (fallbackError) {
        console.warn("[yt-dlp] Cũng thất bại:", fallbackError instanceof Error ? fallbackError.message.slice(0, 300) : fallbackError);
        throw primaryError;
      }
    }
  }
}
