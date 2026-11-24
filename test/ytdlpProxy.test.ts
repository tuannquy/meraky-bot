import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { isYouTubeUrl, localStreamUrl, startYtDlpProxy, stopYtDlpProxy } from "../src/music/ytdlpProxy.ts";

test("isYouTubeUrl chỉ nhận link YouTube", () => {
  assert.equal(isYouTubeUrl("https://www.youtube.com/watch?v=aaaaaaaaaaa"), true);
  assert.equal(isYouTubeUrl("https://youtu.be/aaaaaaaaaaa"), true);
  assert.equal(isYouTubeUrl("https://music.youtube.com/watch?v=aaaaaaaaaaa"), true);
  assert.equal(isYouTubeUrl("https://evil.example/watch?v=aaaaaaaaaaa"), false);
});

test("proxy chuyển stdout của yt-dlp tới ffmpeg qua localhost", async () => {
  stopYtDlpProxy();
  await startYtDlpProxy({
    spawn: () => spawn(process.execPath, ["-e", "process.stdout.write('HELLO-AUDIO')"]),
  });
  const url = localStreamUrl("https://www.youtube.com/watch?v=aaaaaaaaaaa");
  assert.match(url, /^http:\/\/127\.0\.0\.1:\d+\//);
  const res = await fetch(url);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "HELLO-AUDIO");

  const forbidden = await fetch(url.replace(/\/[0-9a-f]+\?/, "/nope?"));
  assert.equal(forbidden.status, 403);

  const bad = new URL(url);
  bad.searchParams.set("u", "https://example.com/not-youtube");
  const rejected = await fetch(bad);
  assert.equal(rejected.status, 400);
  stopYtDlpProxy();
});
