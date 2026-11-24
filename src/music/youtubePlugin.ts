import { YouTubePlugin, type Cookie, type YouTubeSong } from "@distube/youtube";
import type { ResolveOptions, Song } from "distube";
import { isCookieRejectedError, markCookiesRejected } from "./cookieState.js";
import { isYtDlpAvailable } from "./ytdlp.js";
import { isYouTubeUrl, localStreamUrl } from "./ytdlpProxy.js";

/** Song ids whose next stream lookup should try a different yt-dlp client. */
export const ytDlpClientFor = new Map<string, string>();

export function setRetryClient(songId: string, client: string) {
  ytDlpClientFor.set(songId, client);
}

function reasonOf(error: unknown) {
  return (error instanceof Error ? error.message : String(error)).slice(0, 160);
}

/**
 * YouTube plugin with two safety nets for servers whose IP YouTube distrusts:
 * a stale or signed-out cookie is dropped instead of breaking every lookup, and
 * actual audio is pulled through yt-dlp (ffmpeg cannot speak SABR / throttled
 * googlevideo URLs that ytdl-core returns).
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
    const youtubeUrl = song.url;
    if (youtubeUrl && isYouTubeUrl(youtubeUrl) && (await isYtDlpAvailable())) {
      const client = ytDlpClientFor.get(song.id);
      const url = localStreamUrl(youtubeUrl, client);
      console.log(`[youtube] ${song.id}: dùng luồng yt-dlp pipe${client ? ` (client ${client})` : ""}.`);
      return url;
    }
    return this.withCookieFallback(() => super.getStreamURL(song));
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
