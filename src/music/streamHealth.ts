import type { Queue, Song } from "distube";

const MAX_TAIL_LINES = 20;
const MIN_DURATION_SECONDS = 60;
const MAX_EXPECTED_PLAYED_SECONDS = 20;

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

export interface StreamEnd {
  playedSeconds: number;
  ffmpegExitCode: number | null;
}

/**
 * Detects a song whose audio stopped on its own long before its real end. A user
 * stopping playback never matches: ffmpeg is still running at that moment.
 */
export function detectPrematureEnd(queue: Queue, song: Song): StreamEnd | null {
  if (song.isLive || song.duration < MIN_DURATION_SECONDS) return null;

  const ffmpeg = queue.voice.stream?.process;
  const ffmpegExitCode = ffmpeg?.exitCode ?? null;
  if (ffmpegExitCode === null) return null;

  const playedSeconds = queue.currentTime;
  const threshold = Math.min(MAX_EXPECTED_PLAYED_SECONDS, song.duration * 0.2);
  return playedSeconds < threshold ? { playedSeconds, ffmpegExitCode } : null;
}
