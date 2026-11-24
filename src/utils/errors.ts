import { DisTubeError } from "distube";
import { cookiesRejected, isCookieRejectedError } from "../music/cookieState.js";
import { truncate } from "./formatters.js";

/** An error whose message is safe and meant to be shown to the user as-is. */
export class UserError extends Error {}

const MESSAGES: Record<string, string> = {
  NOT_IN_VOICE: "Bạn cần vào một kênh thoại trước.",
  VOICE_FULL: "Kênh thoại đã đầy, Meraky không vào được.",
  VOICE_MISSING_PERMS: "Meraky không có quyền **Connect** / **Speak** ở kênh thoại này.",
  VOICE_CONNECT_FAILED: "Không kết nối được tới kênh thoại. Thử lại sau ít phút nhé.",
  VOICE_RECONNECT_FAILED: "Mất kết nối tới kênh thoại và không thể kết nối lại.",
  NO_QUEUE: "Hiện không có bài nào đang phát.",
  QUEUE_STOPPED: "Hàng đợi đã dừng.",
  PAUSED: "Nhạc đang tạm dừng sẵn rồi.",
  RESUMED: "Nhạc đang phát rồi.",
  NO_PREVIOUS: "Không có bài trước đó.",
  NO_UP_NEXT: "Không còn bài nào tiếp theo trong hàng đợi.",
  NO_SONG_POSITION: "Không có bài nào ở vị trí đó.",
  NO_PLAYING_SONG: "Hiện không có bài nào đang phát.",
  NO_RESULT: "Không tìm thấy bài nào phù hợp với từ khóa.",
  CANNOT_RESOLVE_SONG: "Không tìm thấy bài nào phù hợp.",
  NOT_SUPPORTED_URL: "Link này không được hỗ trợ.",
  NON_NSFW: "Video giới hạn độ tuổi chỉ phát được ở kênh NSFW.",
  UNAVAILABLE_VIDEO: "Video này không khả dụng (bị xóa, riêng tư hoặc chặn theo khu vực).",
  UNPLAYABLE_FORMATS: "Không tìm thấy định dạng âm thanh phát được cho video này.",
  EMPTY_PLAYLIST: "Playlist không có video hợp lệ nào.",
  EMPTY_FILTERED_PLAYLIST: "Playlist không có video phát được (video giới hạn độ tuổi đã bị lọc).",
  FFMPEG_NOT_INSTALLED: "Máy chủ chưa cài FFmpeg.",
  FFMPEG_EXITED: "Luồng âm thanh bị ngắt giữa chừng. Thử phát lại bài này nhé.",
  CANNOT_GET_STREAM_URL: "Không lấy được luồng âm thanh của bài này.",
  NO_STREAM_URL: "YouTube không cho máy chủ của Meraky mở luồng âm thanh. Thử lại, hoặc chủ bot cần cookie mới (xem README).",
};

export function describeError(error: unknown): string {
  if (error instanceof UserError) return error.message;
  if (isCookieRejectedError(error)) {
    return "Cookie YouTube của bot không còn hợp lệ (đã đăng xuất hoặc hết hạn). Chủ bot cần xuất cookie mới vào `YOUTUBE_COOKIES` (xem README).";
  }
  if (error instanceof Error && /sign in to confirm|not a bot/i.test(error.message)) {
    return cookiesRejected()
      ? "YouTube đang chặn máy chủ của Meraky và cookie hiện tại không còn hợp lệ. Chủ bot cần xuất cookie mới vào `YOUTUBE_COOKIES` (xem README)."
      : "YouTube đang chặn máy chủ của Meraky. Chủ bot cần cấu hình `YOUTUBE_COOKIES` (xem README).";
  }
  if (error instanceof DisTubeError) {
    const known = MESSAGES[error.errorCode];
    if (known) return known;
    return `Lỗi trình phát: \`${truncate(error.message, 300)}\``;
  }
  return "Đã có lỗi không mong muốn. Thử lại sau nhé.";
}
