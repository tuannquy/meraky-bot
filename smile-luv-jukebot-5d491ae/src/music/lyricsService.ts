import { Client as GeniusClient } from "genius-lyrics";
import { config } from "../config.js";

export interface LyricsResult {
  title: string;
  artist: string;
  lyrics: string;
  source: "LRCLIB" | "Genius";
  url?: string;
  thumbnail?: string;
}

const genius = new GeniusClient(config.geniusApiKey);

const NOISE_WORDS =
  "official|lyrics?|audio|video|mv|m\\/v|visuali[sz]er|hd|4k|remaster(ed)?|live|karaoke|vietsub|engsub";
const NOISE = [
  new RegExp(`\\([^)]*\\b(${NOISE_WORDS})\\b[^)]*\\)`, "gi"),
  new RegExp(`\\[[^\\]]*\\b(${NOISE_WORDS})\\b[^\\]]*\\]`, "gi"),
  /\b(official\s+(music\s+)?video|lyrics?\s+video|official\s+audio|music\s+video|official\s+mv)\b/gi,
  /#\S+/g,
];

export interface ParsedTitle {
  artist?: string;
  track: string;
}

function stripNoise(text: string): string {
  let cleaned = text;
  for (const pattern of NOISE) cleaned = cleaned.replace(pattern, " ");
  return cleaned.replace(/\s{2,}/g, " ").trim();
}

/**
 * Turns a YouTube title such as "ARTIST | SONG | OFFICIAL MV" or
 * "Artist - Song (Official Video)" into artist and track for lyric lookup.
 */
export function parseTitle(title: string): ParsedTitle {
  const segments = title.split(/\s[|｜]\s|\s-\s|\s–\s/).map(stripNoise).filter(Boolean);
  if (segments.length >= 2) return { artist: segments[0], track: segments[1] };
  return { track: segments[0] || title.trim() };
}

export function cleanTitle(title: string): string {
  const { artist, track } = parseTitle(title);
  return artist ? `${artist} ${track}` : track;
}

interface LrclibTrack {
  trackName: string;
  artistName: string;
  plainLyrics: string | null;
  instrumental: boolean;
}

async function lrclibSearch(params: Record<string, string>): Promise<LrclibTrack | undefined> {
  const res = await fetch(`https://lrclib.net/api/search?${new URLSearchParams(params)}`, {
    headers: { "User-Agent": "Meraky Discord Music Bot" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return undefined;
  const tracks = (await res.json()) as LrclibTrack[];
  return tracks.find((t) => t.plainLyrics && !t.instrumental);
}

async function fromLrclib(parsed: ParsedTitle): Promise<LyricsResult | null> {
  const hit =
    (parsed.artist &&
      ((await lrclibSearch({ track_name: parsed.track, artist_name: parsed.artist })) ??
        (await lrclibSearch({ track_name: parsed.artist, artist_name: parsed.track })))) ||
    (await lrclibSearch({ q: parsed.artist ? `${parsed.artist} ${parsed.track}` : parsed.track }));
  if (!hit?.plainLyrics) return null;
  return { title: hit.trackName, artist: hit.artistName, lyrics: hit.plainLyrics.trim(), source: "LRCLIB" };
}

async function fromGenius(parsed: ParsedTitle): Promise<LyricsResult | null> {
  const query = parsed.artist ? `${parsed.track} ${parsed.artist}` : parsed.track;
  const [song] = await genius.songs.search(query);
  if (!song) return null;
  const lyrics = (await song.lyrics()).trim();
  if (!lyrics) return null;
  return {
    title: song.title,
    artist: song.artist.name,
    lyrics,
    source: "Genius",
    url: song.url,
    thumbnail: song.thumbnail,
  };
}

export async function findLyrics(query: string): Promise<LyricsResult | null> {
  const parsed = parseTitle(query);
  for (const provider of [fromLrclib, fromGenius]) {
    try {
      const result = await provider(parsed);
      if (result) return result;
    } catch (err) {
      console.warn(`[lyrics] ${provider.name} lỗi với "${query}":`, err instanceof Error ? err.message : err);
    }
  }
  return null;
}
