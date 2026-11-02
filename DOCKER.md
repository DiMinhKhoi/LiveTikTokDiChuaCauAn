# Chạy bằng Docker

Trong thư mục dự án, chạy:

```sh
docker compose up --build -d
```

Mở màn hình live tại http://localhost:3000/index.html và trang quản trị tại http://localhost:3000/admin.html. Muốn đổi cổng trên máy chủ, đặt `APP_PORT` trước khi chạy Compose. Ví dụ trong PowerShell: `$env:APP_PORT=3001; docker compose up --build -d`.

```sh
docker compose logs -f app
docker compose down
```

Volume `audio_cache` giữ các tệp âm thanh đã tạo khi container khởi động lại. Tạo giọng đọc qua gTTS và kết nối TikTok cần Internet. Bảng xếp hạng và cấu hình quản trị hiện được lưu trong bộ nhớ, nên sẽ đặt lại khi container khởi động lại.
