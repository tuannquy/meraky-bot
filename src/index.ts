import { config } from "./config.js";
import { createBot } from "./bot.js";
import { refreshYtDlp } from "./music/ytdlp.js";
import { startYtDlpProxy } from "./music/ytdlpProxy.js";

async function main() {
  await refreshYtDlp();
  await startYtDlpProxy();
  const { client } = createBot();

  process.on("unhandledRejection", (reason) => {
    console.error("[process] Unhandled rejection:", reason);
  });

  async function shutdown(signal: string) {
    console.log(`[process] Nhận ${signal}, đang tắt Meraky...`);
    await client.destroy();
    process.exit(0);
  }
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await client.login(config.token);
  } catch (err) {
    console.error("[discord] Đăng nhập thất bại. Kiểm tra lại DISCORD_TOKEN.", err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[boot] Không khởi động được Meraky:", err);
  process.exit(1);
});
