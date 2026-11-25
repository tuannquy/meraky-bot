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

const SNOWFLAKE = /^\d{17,20}$/;

/** Splits ALLOWED_USER_ID on comma, semicolon or whitespace. One ID still works. */
export function parseAllowedUserIds(raw: string | undefined): { ids: string[]; invalid: string[] } {
  const parts = (raw ?? "").split(/[\s,;]+/).map((part) => part.trim()).filter(Boolean);
  const ids: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    if (!SNOWFLAKE.test(part)) invalid.push(part);
    else if (!seen.has(part)) {
      seen.add(part);
      ids.push(part);
    }
  }
  return { ids, invalid };
}

const allowed = parseAllowedUserIds(optional("ALLOWED_USER_ID"));
if (!allowed.ids.length || allowed.invalid.length) {
  const extra = allowed.invalid.length ? ` Giá trị không hợp lệ: ${allowed.invalid.join(", ")}.` : "";
  console.error(
    "[config] Thiếu hoặc sai ALLOWED_USER_ID. Điền một hoặc nhiều ID người dùng Discord (17-20 chữ số), " +
      "cách nhau bằng dấu phẩy. Ví dụ: 123456789012345678,234567890123456789." +
      extra +
      " Bật Developer Mode, nhấp chuột phải vào tên rồi chọn Copy User ID.",
  );
  process.exit(1);
}

const allowedUserIds = new Set(allowed.ids);
console.log(`[config] Cho phép ${allowedUserIds.size} người dùng.`);

const idleSeconds = Number(optional("IDLE_TIMEOUT_SECONDS") ?? 120);

export const config = {
  token,
  allowedUserIds,
  guildId: optional("DISCORD_GUILD_ID"),
  geniusApiKey: optional("GENIUS_API_KEY"),
  youtubeCookies: parseCookies(optional("YOUTUBE_COOKIES")),
  ytdlpPath: optional("YTDLP_PATH") ?? "yt-dlp",
  idleTimeoutMs: (Number.isFinite(idleSeconds) && idleSeconds >= 0 ? idleSeconds : 120) * 1000,
} as const;
