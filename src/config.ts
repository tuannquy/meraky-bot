import "dotenv/config";

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function parseCookies(raw: string | undefined) {
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as { name: string; value: string }[];
  } catch {
    // fall through to the warning below
  }
  console.warn("[config] YOUTUBE_COOKIES không phải JSON array hợp lệ, bỏ qua.");
  return undefined;
}

const token = optional("DISCORD_TOKEN");
if (!token) {
  console.error(
    "[config] Thiếu DISCORD_TOKEN. Sao chép .env.example thành .env và điền token của bot.",
  );
  process.exit(1);
}

const allowedUserId = optional("ALLOWED_USER_ID");
if (!allowedUserId || !/^\d{17,20}$/.test(allowedUserId)) {
  console.error(
    "[config] Thiếu hoặc sai ALLOWED_USER_ID. Đây phải là ID người dùng Discord (17-20 chữ số) của người duy nhất được dùng bot. " +
      "Bật Developer Mode, nhấp chuột phải vào tên bạn rồi chọn Copy User ID.",
  );
  process.exit(1);
}

const idleSeconds = Number(optional("IDLE_TIMEOUT_SECONDS") ?? 120);

export const config = {
  token,
  allowedUserId,
  guildId: optional("DISCORD_GUILD_ID"),
  geniusApiKey: optional("GENIUS_API_KEY"),
  youtubeCookies: parseCookies(optional("YOUTUBE_COOKIES")),
  ytdlpPath: optional("YTDLP_PATH") ?? "yt-dlp",
  idleTimeoutMs: (Number.isFinite(idleSeconds) && idleSeconds >= 0 ? idleSeconds : 120) * 1000,
} as const;
