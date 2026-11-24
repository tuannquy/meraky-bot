import { YouTubePlugin, type Cookie, type YouTubeSong } from "@distube/youtube";
import { DisTubeError, type ResolveOptions, type Song } from "distube";
import { isCookieRejectedError, markCookiesRejected } from "./cookieState.js";
import { probeStreamUrl } from "./streamHealth.js";
import { getStreamUrlWithYtDlp, isYtDlpAvailable } from "./ytdlp.js";

/** Song ids whose next stream lookup should try yt-dlp first (set after a stream was cut short). */
export const preferYtDlpFor = new Set<string>();

/** After the first dead ytdl-core stream, skip it for everyone until restart. */
let preferYtDlpDefault = false;

export function enableYtDlpPreference() {
  if (!preferYtDlpDefault) {
    preferYtDlpDefault = true;
    console.warn("[youtube] Chuyển sang lấy luồng bằng yt-dlp cho các bài tiếp theo.");
  }
}

function reasonOf(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 160);
}

function logStream(songId: string, source: string, extra?: string) {
  console.log(`[youtube] ${songId}: dùng luồng từ ${source}${extra ? ` (${extra})` : ""}.`);
}

/**
 * YouTube plugin with two safety nets for servers whose IP YouTube distrusts:
 * a stale or signed-out cookie is dropped instead of breaking every lookup, and
 * stream lookup falls back to yt-dlp when ytdl-core is blocked or broken.
 */
export class MerakyYouTubePlugin extends YouTubePlugin {
  /** Retries once without cookies when YouTube rejects them; ytdl-core then fails every call. */
  private async withCookieFallback<R>(run: () => Promise<R>): Promise<R> {
    try {
      return await run();
    } catch (error) {
      if (!this.cookies?.length || !isCookieRejectedError(error)) throw error;
      console.error(
        "[youtube] YouTube từ chối cookie (đã đăng xuất, hết hạn hoặc bị xoay). Bot tạm tắt cookie và thử lại. Hãy xuất cookie mới và cập nhật YOUTUBE_COOKIES.",
      );
      this.cookies = undefined;
      markCookiesRejected();
      return run();
    }
  }

  override resolve<T>(url: string, options: ResolveOptions<T>) {
    return this.withCookieFallback(() => super.resolve(url, options));
  }

  override searchSong<T>(query: string, options: ResolveOptions<T>): Promise<Song<T> | null> {
    return this.withCookieFallback(() => super.searchSong(query, options));
  }

  // The base class overloads this by result type; the wrapper is type-agnostic.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override search(query: string, options?: any): Promise<any> {
    return this.withCookieFallback(() => super.search(query, options));
  }

  override async getStreamURL<T = unknown>(song: YouTubeSong<T>): Promise<string> {
    const canUseYtDlp = Boolean(song.url) && (await isYtDlpAvailable());
    const preferYtDlp = canUseYtDlp && (preferYtDlpFor.has(song.id) || preferYtDlpDefault);

    if (preferYtDlp) {
      try {
        const url = await getStreamUrlWithYtDlp(song.url!);
        logStream(song.id, "yt-dlp", preferYtDlpFor.has(song.id) ? "thử lại" : "ưu tiên");
        return url;
      } catch (err) {
        console.warn(`[yt-dlp] Ưu tiên thất bại (${reasonOf(err)}), quay về ytdl-core.`);
      }
    }

    try {
      const url = await this.withCookieFallback(() => super.getStreamURL(song));
      const probe = await probeStreamUrl(url);
      if (probe.ok) {
        logStream(song.id, "ytdl-core", `HTTP ${probe.status}`);
        return url;
      }

      console.warn(
        `[youtube] ${song.id}: ytdl-core trả URL nhưng máy chủ media trả HTTP ${probe.status ?? "lỗi mạng"}.`,
      );
      if (!canUseYtDlp) {
        logStream(song.id, "ytdl-core", "không kiểm tra được, không có yt-dlp");
        return url;
      }

      try {
        const fallback = await getStreamUrlWithYtDlp(song.url!);
        enableYtDlpPreference();
        logStream(song.id, "yt-dlp", "ytdl-core không mở được");
        return fallback;
      } catch (fallbackError) {
        console.warn(`[yt-dlp] Cũng thất bại: ${reasonOf(fallbackError)}`);
        throw new DisTubeError("NO_STREAM_URL", song.id);
      }
    } catch (primaryError) {
      if (!canUseYtDlp) throw primaryError;
      if (preferYtDlp) throw primaryError;
      console.warn(`[youtube] ytdl-core lỗi (${reasonOf(primaryError)}), chuyển sang yt-dlp.`);
      try {
        const url = await getStreamUrlWithYtDlp(song.url!);
        logStream(song.id, "yt-dlp", "dự phòng");
        return url;
      } catch (fallbackError) {
        console.warn(`[yt-dlp] Cũng thất bại: ${reasonOf(fallbackError)}`);
        throw primaryError;
      }
    }
  }
}

/** ytdl-core refuses some cookies at construction (e.g. no SAPISID); that must not stop the bot. */
export function createYouTubePlugin(cookies: Cookie[] | undefined): MerakyYouTubePlugin {
  if (!cookies?.length) return new MerakyYouTubePlugin();
  try {
    const plugin = new MerakyYouTubePlugin({ cookies });
    console.log(`[youtube] Đã nạp ${cookies.length} cookie YouTube.`);
    return plugin;
  } catch (error) {
    console.error(`[youtube] Cookie không dùng được (${reasonOf(error)}). Bot chạy không cookie.`);
    markCookiesRejected();
    return new MerakyYouTubePlugin();
  }
}
