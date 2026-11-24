import { randomBytes } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { ChildProcess } from "node:child_process";
import { spawnYtDlpStdout } from "./ytdlp.js";

const YOUTUBE_URL = /^https:\/\/(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be)\//i;

export type YtDlpSpawner = (youtubeUrl: string, client?: string) => ChildProcess;

let server: Server | undefined;
let port = 0;
let secret = "";
let spawner: YtDlpSpawner = spawnYtDlpStdout;
let starting: Promise<number> | undefined;

export function isYouTubeUrl(url: string) {
  return YOUTUBE_URL.test(url);
}

export function localStreamUrl(youtubeUrl: string, client?: string) {
  if (!server || !port) throw new Error("Proxy yt-dlp chưa chạy.");
  const params = new URLSearchParams({ u: youtubeUrl });
  if (client) params.set("c", client);
  return `http://127.0.0.1:${port}/${secret}?${params}`;
}

function deny(res: ServerResponse, status: number, message: string) {
  res.writeHead(status, { "Content-Type": "text/plain" });
  res.end(message);
}

function handle(req: IncomingMessage, res: ServerResponse) {
  const host = req.headers.host ?? "127.0.0.1";
  let parsed: URL;
  try {
    parsed = new URL(req.url ?? "/", `http://${host}`);
  } catch {
    deny(res, 400, "bad url");
    return;
  }

  if (parsed.pathname !== `/${secret}`) {
    deny(res, 403, "forbidden");
    return;
  }

  const youtubeUrl = parsed.searchParams.get("u") ?? "";
  const client = parsed.searchParams.get("c") || undefined;
  if (!isYouTubeUrl(youtubeUrl)) {
    deny(res, 400, "not a youtube url");
    return;
  }

  if (req.method === "HEAD") {
    res.writeHead(200, { "Content-Type": "application/octet-stream" });
    res.end();
    return;
  }
  if (req.method !== "GET") {
    deny(res, 405, "method not allowed");
    return;
  }

  const child = spawner(youtubeUrl, client);
  if (!child.stdout) {
    child.kill("SIGKILL");
    deny(res, 500, "yt-dlp has no stdout");
    return;
  }

  let started = false;
  const fail = (status: number, message: string) => {
    if (started || res.headersSent) return;
    deny(res, status, message);
  };

  child.stdout.once("data", (chunk: Buffer) => {
    if (res.headersSent) return;
    started = true;
    res.writeHead(200, {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.write(chunk);
    child.stdout!.pipe(res);
  });

  child.once("error", (err) => {
    console.warn(`[yt-dlp-proxy] Không chạy được yt-dlp: ${err.message}`);
    fail(502, "yt-dlp spawn failed");
  });

  child.once("exit", (code, signal) => {
    if (started) return;
    console.warn(`[yt-dlp-proxy] yt-dlp thoát trước khi có dữ liệu (code=${code} signal=${signal}).`);
    fail(502, "yt-dlp produced no audio");
  });

  const stop = () => {
    if (!child.killed) child.kill("SIGKILL");
  };
  req.on("close", stop);
  res.on("close", stop);
}

export function startYtDlpProxy(options?: { spawn?: YtDlpSpawner }): Promise<number> {
  if (options?.spawn) spawner = options.spawn;
  if (starting) return starting;
  if (server && port) return Promise.resolve(port);

  spawner = options?.spawn ?? spawnYtDlpStdout;
  secret = randomBytes(16).toString("hex");
  server = createServer(handle);
  server.listen(0, "127.0.0.1");

  starting = new Promise((resolve, reject) => {
    server!.once("listening", () => {
      const addr = server!.address();
      if (!addr || typeof addr === "string") {
        starting = undefined;
        reject(new Error("Proxy yt-dlp không lấy được cổng."));
        return;
      }
      port = addr.port;
      console.log(`[yt-dlp-proxy] Nghe tại 127.0.0.1:${port}`);
      resolve(port);
    });
    server!.once("error", (err) => {
      starting = undefined;
      reject(err);
    });
  });
  return starting;
}

export function stopYtDlpProxy() {
  server?.close();
  server = undefined;
  starting = undefined;
  port = 0;
  secret = "";
}
