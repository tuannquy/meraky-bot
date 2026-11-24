import { execFile } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { config } from "../config.js";
import { cookiesRejected } from "./cookieState.js";

const run = promisify(execFile);

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

let available: Promise<boolean> | undefined;

export function isYtDlpAvailable(): Promise<boolean> {
  available ??= run(config.ytdlpPath, ["--version"], { timeout: 10_000 })
    .then(({ stdout }) => {
      console.log(`[yt-dlp] Sẵn sàng làm phương án dự phòng (phiên bản ${stdout.trim()}).`);
      return true;
    })
    .catch(() => {
      console.warn(
        `[yt-dlp] Không tìm thấy "${config.ytdlpPath}". Bot vẫn chạy nhưng không có phương án dự phòng khi YouTube chặn.`,
      );
      return false;
    });
  return available;
}

export async function getStreamUrlWithYtDlp(url: string): Promise<string> {
  const args = [
    "--format", "bestaudio/best",
    "--get-url",
    "--no-playlist",
    "--no-warnings",
    "--js-runtimes", "node",
    ...(cookieFile && !cookiesRejected() ? ["--cookies", cookieFile] : []),
    url,
  ];
  const { stdout } = await run(config.ytdlpPath, args, { timeout: 45_000, maxBuffer: 1024 * 1024 });
  const streamUrl = stdout.split("\n").find((line) => line.startsWith("http"));
  if (!streamUrl) throw new Error("yt-dlp không trả về link luồng âm thanh.");
  return streamUrl;
}
