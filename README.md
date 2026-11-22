# Meraky — bot phát nhạc YouTube cho Discord

Meraky phát nhạc YouTube trong kênh thoại Discord. Mọi lệnh đều nằm dưới một slash command duy nhất: `/meraky`.

Viết bằng TypeScript, [discord.js](https://discord.js.org) v14 và [DisTube](https://distube.js.org) v5. Lời bài hát lấy từ [LRCLIB](https://lrclib.net), dự phòng bằng Genius.

## Tính năng

- Phát từ link video, link playlist hoặc tên bài hát
- Tìm kiếm rồi chọn bài từ menu
- Hàng đợi có phân trang, chèn bài lên đầu, nhảy tới vị trí bất kỳ
- Lặp bài / lặp hàng đợi, xáo trộn, chỉnh âm lượng
- Tin nhắn "Đang phát" có nút điều khiển nhanh (tạm dừng, bỏ qua, lặp, xáo trộn, dừng)
- Thanh tiến độ, lượt xem, lượt thích của bài đang phát
- Lời bài hát (hỗ trợ tốt cả nhạc Việt)
- Tự rời kênh thoại khi không còn ai nghe hoặc hết nhạc
- Thông báo lỗi bằng tiếng Việt, rõ ràng

## Danh sách lệnh

| Lệnh | Mô tả |
|------|-------|
| `/meraky play <query> [next]` | Phát từ link YouTube hoặc tên bài. `next:True` để chèn lên đầu hàng đợi |
| `/meraky search <query> [limit]` | Tìm trên YouTube và chọn bài trong menu |
| `/meraky playlist <url> [shuffle]` | Thêm cả playlist YouTube, có thể xáo trộn trước |
| `/meraky pause` | Tạm dừng |
| `/meraky resume` | Phát tiếp |
| `/meraky skip [to]` | Bỏ qua bài hiện tại, hoặc nhảy tới vị trí `to` |
| `/meraky stop` | Dừng, xóa hàng đợi và rời kênh |
| `/meraky queue [page]` | Xem hàng đợi |
| `/meraky nowplaying` | Bài đang phát và tiến độ |
| `/meraky loop [mode]` | Tắt / lặp bài / lặp hàng đợi (bỏ trống để chuyển vòng) |
| `/meraky shuffle` | Xáo trộn bài đang chờ |
| `/meraky volume [level]` | Xem hoặc chỉnh âm lượng 0-100 |
| `/meraky lyrics [query]` | Lời bài đang phát hoặc của bài bất kỳ |
| `/meraky help` | Hướng dẫn nhanh |

## 1. Tạo bot trên Discord

1. Vào [Discord Developer Portal](https://discord.com/developers/applications), bấm **New Application** và đặt tên (ví dụ `Meraky`).
2. Mở tab **Bot**, bấm **Reset Token** và lưu token lại. Đây là giá trị của `DISCORD_TOKEN`.
   Meraky chỉ dùng slash command, nên **không cần** bật Privileged Gateway Intents nào.
3. Mở tab **OAuth2 > URL Generator**:
   - Scopes: `bot`, `applications.commands`
   - Bot Permissions: `View Channels`, `Send Messages`, `Embed Links`, `Connect`, `Speak`
4. Mở URL vừa tạo để mời bot vào server.

Hoặc dùng link sau, thay `CLIENT_ID` bằng Application ID của bạn:

```
https://discord.com/oauth2/authorize?client_id=CLIENT_ID&scope=bot+applications.commands&permissions=3165184
```

## 2. Chạy trên máy cá nhân

Yêu cầu:

- Node.js 20 trở lên
- [FFmpeg](https://ffmpeg.org/download.html) có trong `PATH`
- (Khuyến nghị) [yt-dlp](https://github.com/yt-dlp/yt-dlp#installation) có trong `PATH`, dùng làm phương án dự phòng khi YouTube chặn

```bash
npm install
cp .env.example .env      # rồi điền DISCORD_TOKEN
npm run dev               # chạy với tự reload khi sửa code
```

Bản production:

```bash
npm run build
npm start
```

Khi test, nên đặt `DISCORD_GUILD_ID` là ID server của bạn. Lệnh `/meraky` sẽ hiện ngay lập tức. Nếu bỏ trống, lệnh được đăng ký toàn cục và có thể mất vài phút mới hiện.

### Biến môi trường

| Biến | Bắt buộc | Mô tả |
|------|----------|-------|
| `DISCORD_TOKEN` | Có | Token của bot |
| `ALLOWED_USER_ID` | Có | ID người dùng Discord duy nhất được dùng bot (xem phần "Giới hạn người dùng") |
| `DISCORD_GUILD_ID` | Không | Đăng ký lệnh riêng cho một server (hiện ngay) |
| `GENIUS_API_KEY` | Không | Token Genius, giúp nguồn lời dự phòng ổn định hơn |
| `YOUTUBE_COOKIES` | Không* | Cookie YouTube dạng JSON array (xem bên dưới) |
| `YTDLP_PATH` | Không | Đường dẫn yt-dlp nếu không nằm trong `PATH` |
| `IDLE_TIMEOUT_SECONDS` | Không | Số giây chờ trước khi tự rời kênh (mặc định 120) |

\* Gần như bắt buộc khi chạy trên cloud như Railway, xem phần tiếp theo.

### Giới hạn người dùng

Meraky là bot riêng: chỉ người có ID trong `ALLOWED_USER_ID` dùng được lệnh `/meraky` và các nút điều khiển. Người khác sẽ nhận thông báo "Bot này là bot riêng" chỉ họ nhìn thấy. Thiếu hoặc sai biến này thì bot không khởi động.

Lấy ID của bạn: Discord > **Cài đặt > Nâng cao** > bật **Chế độ nhà phát triển**, rồi nhấp chuột phải vào tên bạn và chọn **Sao chép ID người dùng**.

Nên tắt thêm **Public Bot** trong Developer Portal (tab **Bot**) để người lạ không mời được bot vào server của họ.

### Cookie YouTube (quan trọng khi chạy trên server)

YouTube thường chặn việc lấy luồng âm thanh từ IP của các nhà cung cấp cloud. Khi bị chặn, bot báo *"YouTube đang chặn máy chủ của Meraky"*. Tìm kiếm vẫn chạy nhưng bài không phát được. Cách khắc phục:

1. Dùng một tài khoản Google **phụ**, đừng dùng tài khoản chính.
2. Cài extension [Cookie-Editor](https://cookie-editor.com) hoặc EditThisCookie, đăng nhập youtube.com, rồi export cookie dạng **JSON**.
3. Dán toàn bộ JSON (một dòng) vào biến `YOUTUBE_COOKIES`.

Meraky dùng cookie này cho cả ytdl-core và yt-dlp. Nếu ytdl-core không lấy được luồng, bot tự động thử lại bằng yt-dlp.

## 3. Deploy lên Railway

Repo có sẵn `Dockerfile` (cài FFmpeg và yt-dlp) và `railway.toml`, nên Railway tự build bằng Docker.

**Cách 1: Railway CLI (không cần GitHub)**

```bash
npm i -g @railway/cli
railway login
cd jukebot          # PHẢI đứng trong thư mục có Dockerfile
railway init        # lần đầu: tạo project mới
railway up
```

`railway up` upload thư mục hiện tại. Nếu chạy ở thư mục cha, Railway chỉ thấy một folder con, không tìm được `Dockerfile` và báo lỗi *"Railpack could not determine how to build the app"*.

**Cách 2: Deploy từ GitHub**

1. Đưa code lên GitHub, sao cho `Dockerfile` nằm ở thư mục gốc của repo.
2. Trên [Railway](https://railway.com), chọn **New Project > Deploy from GitHub repo** và chọn repo đó.

**Sau khi deploy (cả hai cách):**

1. Vào tab **Variables** của service và thêm `DISCORD_TOKEN` và `ALLOWED_USER_ID`. Nên thêm cả `YOUTUBE_COOKIES`, và `GENIUS_API_KEY` nếu có. Railway tự deploy lại khi biến thay đổi.
2. Xem tab **Deployments > Logs**. Build đúng sẽ hiện `Using Dockerfile`, không phải Railpack. Khi thấy dòng `Đã đăng nhập: Meraky#xxxx` là bot đã chạy.

Ghi chú:

- Bot là một worker, không mở cổng HTTP, nên không cần tạo domain hay healthcheck.
- Mỗi server đang phát nhạc chạy thêm một tiến trình FFmpeg. Theo dõi RAM và CPU ở tab **Metrics**, và kiểm tra hạn mức gói Railway của bạn vì Railway tính phí theo mức dùng.
- `railway.toml` đặt chế độ tự khởi động lại khi bot crash.

Có thể build và chạy thử image trên máy:

```bash
docker build -t meraky .
docker run --rm --env-file .env meraky
```

## Cấu trúc thư mục

```
src/
├── index.ts                 # Entry point: đăng nhập, tắt bot gọn gàng
├── bot.ts                   # Tạo Discord client + DisTube, gắn events
├── config.ts                # Đọc và kiểm tra biến môi trường
├── types.ts
├── commands/meraky.ts       # Định nghĩa /meraky và gộp các subcommand
├── handlers/                # Mỗi file là một subcommand (play, queue, lyrics, ...)
├── events/
│   ├── ready.ts             # Đăng ký slash command khi bot online
│   ├── interactionCreate.ts # Điều hướng lệnh + nút điều khiển, bắt lỗi
│   └── voiceStateUpdate.ts  # Tự rời kênh khi không còn ai
├── music/
│   ├── player.ts            # Cấu hình DisTube, tin nhắn "Đang phát", tự rời kênh
│   ├── youtubePlugin.ts     # Plugin YouTube có dự phòng bằng yt-dlp
│   ├── ytdlp.ts             # Gọi yt-dlp, chuyển cookie sang định dạng Netscape
│   └── lyricsService.ts     # Tìm lời bài hát (LRCLIB rồi đến Genius)
└── utils/                   # Embed, định dạng thời gian, lỗi, kiểm tra kênh thoại
```

## Xử lý sự cố

| Hiện tượng | Cách xử lý |
|------------|------------|
| Không thấy lệnh `/meraky` | Đặt `DISCORD_GUILD_ID` để lệnh hiện ngay, hoặc đợi vài phút với lệnh toàn cục. Kiểm tra bot được mời với scope `applications.commands` |
| "YouTube đang chặn máy chủ" | Cấu hình `YOUTUBE_COOKIES` |
| Bot vào kênh nhưng không có tiếng | Kiểm tra FFmpeg đã cài (`ffmpeg -version`), bot có quyền **Speak** |
| "Meraky cần quyền Connect và Speak" | Cấp quyền cho role của bot ở kênh thoại đó |
| Kênh thoại tạm (VoiceMaster, ...) bị xóa khi bạn thoát | Meraky tự dọn hàng đợi và rời đi ngay khi kênh bị xóa. Nếu có gì còn sót, mọi lệnh `/meraky` cũng tự dọn phiên hỏng trước khi chạy |
| Muốn xem log chi tiết của DisTube | Đặt biến `DEBUG_DISTUBE=1` |
