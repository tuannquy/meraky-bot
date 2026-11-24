import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import type { Song } from "distube";
import {
  detectPrematureEnd,
  playbackThreshold,
  probeStreamUrl,
  recordFfmpegLine,
  redactUrls,
  takeFfmpegTail,
} from "../src/music/streamHealth.ts";

const song = (over: Partial<Song> = {}) =>
  ({ isLive: false, duration: 192, ...over }) as Song;

test("bài 3 phút kết thúc ở 0s là kết thúc sớm, kể cả khi ffmpeg chưa có exitCode", () => {
  const end = detectPrematureEnd(song(), 0);
  assert.ok(end);
  assert.equal(end.playedSeconds, 0);
  assert.equal(end.threshold, playbackThreshold(192));
});

test("bài phát gần hết không phải kết thúc sớm", () => {
  assert.equal(detectPrematureEnd(song(), 180), null);
});

test("bài live và bài quá ngắn không bị coi là kết thúc sớm", () => {
  assert.equal(detectPrematureEnd(song({ isLive: true }), 0), null);
  assert.equal(detectPrematureEnd(song({ duration: 10 }), 0), null);
});

test("bài dừng dưới 20% thời lượng là kết thúc sớm", () => {
  assert.ok(detectPrematureEnd(song({ duration: 200 }), 10));
  assert.equal(detectPrematureEnd(song({ duration: 200 }), 40), null);
});

test("ffmpeg debug được gắn theo guild và che URL", () => {
  recordFfmpegLine("[123] [process] spawn: ffmpeg -i https://rr1.googlevideo.com/videoplayback?expire=1");
  recordFfmpegLine("[123] [process] exit: code=unknown signal=SIGKILL");
  recordFfmpegLine("not-a-match");
  const tail = takeFfmpegTail("123");
  assert.equal(tail.length, 2);
  assert.match(tail[0], /rr1\.googlevideo\.com\/…/);
  assert.doesNotMatch(tail[0], /expire=/);
  assert.equal(takeFfmpegTail("123").length, 0);
});

test("redactUrls giữ host", () => {
  assert.equal(redactUrls("x https://a.b/c?d=1 y"), "x https://a.b/… y");
});

test("probeStreamUrl coi 2xx/3xx là mở được, 403 là chết", async () => {
  const server = createServer((req, res) => {
    const url = req.url ?? "/";
    if (url === "/ok") {
      res.writeHead(206, { "Content-Type": "audio/webm" });
      res.end("abc");
    } else {
      res.writeHead(403, { "Content-Type": "text/plain" });
      res.end("denied");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as { port: number };
  try {
    const ok = await probeStreamUrl(`http://127.0.0.1:${port}/ok`);
    const bad = await probeStreamUrl(`http://127.0.0.1:${port}/no`);
    assert.deepEqual(ok, { ok: true, status: 206 });
    assert.deepEqual(bad, { ok: false, status: 403 });
  } finally {
    server.close();
  }
});
