import type { Song } from "distube";

export function formatTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "0:00";
  const s = Math.floor(totalSeconds % 60);
  const m = Math.floor((totalSeconds / 60) % 60);
  const h = Math.floor(totalSeconds / 3600);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function formatNumber(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function escapeMarkdown(text: string): string {
  return text.replace(/([\\*_`~|[\]])/g, "\\$1");
}

export function songLink(song: Song, max = 60): string {
  const name = escapeMarkdown(truncate(song.name ?? "Không rõ tên", max));
  return song.url ? `[${name}](${song.url})` : name;
}

export function progressBar(current: number, total: number, size = 18): string {
  if (!total || total <= 0) return "● LIVE";
  const ratio = Math.min(Math.max(current / total, 0), 1);
  const pos = Math.round(ratio * size);
  return `${"━".repeat(pos)}●${"─".repeat(size - pos)}`;
}

export function chunkText(text: string, max: number): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const line of text.split("\n")) {
    if (line.length > max) {
      if (current) chunks.push(current);
      for (let i = 0; i < line.length; i += max) chunks.push(line.slice(i, i + max));
      current = "";
      continue;
    }
    if (current.length + line.length + 1 > max) {
      chunks.push(current);
      current = line;
    } else {
      current = current ? `${current}\n${line}` : line;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function isUrl(text: string): boolean {
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isYouTubePlaylistUrl(text: string): boolean {
  if (!isUrl(text)) return false;
  const url = new URL(text);
  return /(^|\.)youtube\.com$|(^|\.)youtu\.be$/.test(url.hostname) && url.searchParams.has("list");
}
