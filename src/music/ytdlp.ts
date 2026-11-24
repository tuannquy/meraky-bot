import { spawn, type ChildProcess, execFile } from "node:child_process";
import { chmodSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { config } from "../config.js";
import { cookiesRejected } from "./cookieState.js";

const run = promisify(execFile);
const YTDLP_RELEASE = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";

interface JsonCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  expirationDate?: number;
}

/** yt-dlp only reads Netscape cookie files, while the YouTube plugin takes JSON. */
function writeNetscapeCookies(cookies: readonly JsonCookie[]): string {
  const lines = ["# Netscape HTTP Cookie File"];
  for (const c of cookies) {
    const domain = c.domain ?? ".youtube.com";
    lines.push(
      [
        domain,
        domain.startsWith(".") ? "TRUE" : "FALSE",
        c.path ?? "/",
        c.secure ? "TRUE" : "FALSE",
        Math.floor(c.expirationDate ?? 0),
        c.name,
        c.value,
      ].join("\t"),
    );
  }
  const file = join(tmpdir(), "meraky-youtube-cookies.txt");
  writeFileSync(file, `${lines.join("\n")}\n`, { mode: 0o600 });
  return file;
}

const cookieFile = config.youtubeCookies?.length
  ? writeNetscapeCookies(config.youtubeCookies)
  : undefined;

let ytdlpPath = config.ytdlpPath;
let available: Promise<boolean> | undefined;

export function getYtDlpPath() {
  return ytdlpPath;
}

function cookieArgs() {
  return cookieFile && !cookiesRejected() ? ["--cookies", cookieFile] : [];
}

function formatArgs() {
  // Prefer a progressive HTTPS audio URL. SABR/DASH-only formats make ffmpeg exit 1.
  return [
    "--format",
    "bestaudio[protocol^=http][vcodec=none]/bestaudio[vcodec=none]/bestaudio/best",
  ];
}

function commonArgs(client?: string) {
  return [
    ...formatArgs(),
    "--no-playlist",
    "--no-warnings",
    "--js-runtimes", "node",
    "--force-ipv4",
    ...(client ? ["--extractor-args", `youtube:player_client=${client}`] : []),
    ...cookieArgs(),
  ];
}

/** Download a fresh yt-dlp into tmp so a cached Docker layer cannot freeze an old extractor. */
export async function refreshYtDlp() {
  const dest = join(tmpdir(), "meraky-yt-dlp");
  try {
    const res = await fetch(YTDLP_RELEASE, {
      redirect: "follow",
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1_000_000) throw new Error(`file too small (${buf.length} bytes)`);
    writeFileSync(dest, buf);
    chmodSync(dest, 0o755);
    ytdlpPath = dest;
    available = undefined;
    const { stdout } = await run(dest, ["--version"], { timeout: 15_000 });
    console.log(`[yt-dlp] Dùng bản ${stdout.trim()} (tải lúc khởi động).`);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`[yt-dlp] Không tải được bản mới (${reason.slice(0, 120)}). Dùng "${ytdlpPath}".`);
  }
}

export function isYtDlpAvailable(): Promise<boolean> {
  available ??= run(ytdlpPath, ["--version"], { timeout: 10_000 })
    .then(({ stdout }) => {
      console.log(`[yt-dlp] Sẵn sàng (phiên bản ${stdout.trim()}).`);
      return true;
    })
    .catch(() => {
      console.warn(
        `[yt-dlp] Không tìm thấy "${ytdlpPath}". Bot vẫn chạy nhưng không có phương án dự phòng khi YouTube chặn.`,
      );
      return false;
    });
  return available;
}

/** yt-dlp writes only media bytes to stdout; ffmpeg reads them via the local proxy. */
export function spawnYtDlpStdout(youtubeUrl: string, client?: string): ChildProcess {
  const args = [
    ...commonArgs(client),
    "--output", "-",
    "--quiet",
    "--no-progress",
    "--",
    youtubeUrl,
  ];
  console.log(`[yt-dlp] Tải luồng${client ? ` (client ${client})` : ""}: ${youtubeUrl}`);
  const child = spawn(ytdlpPath, args, { stdio: ["ignore", "pipe", "pipe"] });
  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", (chunk: string) => {
    const text = chunk.trim();
    if (text) console.warn(`[yt-dlp] ${text.slice(0, 400)}`);
  });
  return child;
}

export async function getStreamUrlWithYtDlp(url: string, client?: string): Promise<string> {
  const args = [...commonArgs(client), "--get-url", "--", url];
  const { stdout } = await run(ytdlpPath, args, { timeout: 45_000, maxBuffer: 1024 * 1024 });
  const streamUrl = stdout
    .split("\n")
    .map((line) => line.trim())
    .find((line) => /^https?:\/\//.test(line));
  if (!streamUrl) throw new Error("yt-dlp không trả về link luồng âm thanh.");
  return streamUrl;
}
