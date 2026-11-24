import type { Song } from "distube";

const MAX_TAIL_LINES = 20;
const MIN_DURATION_SECONDS = 20;
const MAX_EXPECTED_PLAYED_SECONDS = 20;
const PROBE_TIMEOUT_MS = 5_000;
const PROBE_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const ffmpegTails = new Map<string, string[]>();

/** Stream URLs are signed and tied to the server's IP, so keep only the host in logs. */
export function redactUrls(text: string): string {
  return text.replace(/(https?:\/\/[^/\s?]+)[^\s]*/g, "$1/…");
}

/**
 * DisTube ignores ffmpeg exit codes 0 and 255, so a stream that is cut short ends
 * silently as a normal finish. Keeping ffmpeg's last output is the only way to learn why.
 */
export function recordFfmpegLine(debugLine: string) {
  const match = /^\[(\d+)\] (.*)$/s.exec(debugLine);
  if (!match) return;
  const [, guildId, line] = match;
  const lines = ffmpegTails.get(guildId) ?? [];
  lines.push(redactUrls(line.trim()));
  if (lines.length > MAX_TAIL_LINES) lines.shift();
  ffmpegTails.set(guildId, lines);
}

export function takeFfmpegTail(guildId: string): string[] {
  const lines = ffmpegTails.get(guildId) ?? [];
  ffmpegTails.delete(guildId);
  return lines;
}

export function playbackThreshold(durationSeconds: number) {
  return Math.min(MAX_EXPECTED_PLAYED_SECONDS, durationSeconds * 0.2);
}

export interface StreamEnd {
  playedSeconds: number;
  threshold: number;
}

/**
 * Detects a song whose audio stopped on its own long before its real end.
 *
 * User skip/jump never reaches this check: DisTube handles those via `_manualUpdate`
 * and does not emit `FINISH_SONG`. Do not require ffmpeg's exit code — when the
 * stream is empty YouTube 403, ffmpeg is often still running or has been SIGKILL'd
 * (`exitCode === null`) while AudioPlayer already went Idle.
 */
export function detectPrematureEnd(song: Song, playedSeconds: number): StreamEnd | null {
  if (song.isLive) return null;
  const duration = song.duration || 0;
  if (duration < MIN_DURATION_SECONDS) return null;

  const played = Number.isFinite(playedSeconds) ? Math.max(playedSeconds, 0) : 0;
  const threshold = playbackThreshold(duration);
  return played < threshold ? { playedSeconds: played, threshold } : null;
}

export interface StreamProbe {
  ok: boolean;
  status: number | null;
}

/**
 * Checks whether a signed media URL actually answers. ytdl-core can return a URL
 * that immediately 403s on datacenter IPs; ffmpeg then emits no PCM and the
 * queue looks like it finished normally.
 */
export async function probeStreamUrl(url: string): Promise<StreamProbe> {
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Range: "bytes=0-2047",
        Referer: "https://www.youtube.com/",
        "User-Agent": PROBE_USER_AGENT,
      },
      redirect: "follow",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    });
    try {
      await res.body?.cancel();
    } catch {
      // Node may have already consumed a tiny 403 body.
    }
    return { ok: res.status >= 200 && res.status < 400, status: res.status };
  } catch {
    return { ok: false, status: null };
  }
}
