# Tiếng Anh Công Sở

PWA học tiếng Anh giao tiếp nơi công sở cho nhân viên văn phòng người Việt
(trình độ pre-intermediate). Giao diện 100% tiếng Việt, tiếng Anh chỉ xuất hiện
trong nội dung học.

**Không backend, không đăng nhập.** Toàn bộ dữ liệu học nằm trên thiết bị của
người dùng, có xuất/nhập JSON để sao lưu. Dùng được offline và cài được như một
ứng dụng trên điện thoại.

## Chạy nhanh

```bash
npm install
npm run dev          # http://localhost:3000
```

## Các lệnh

| Lệnh                | Việc gì                                                        |
| ------------------- | -------------------------------------------------------------- |
| `npm run dev`       | Chạy server phát triển                                          |
| `npm run validate`  | Kiểm tra nội dung (zod, trùng id, tham chiếu chéo)              |
| `npm test`          | Chạy unit test cho toàn bộ logic thuần                          |
| `npm run lint`      | ESLint, không cho phép cảnh báo                                 |
| `npm run build`     | Build tĩnh ra `out/` (tự chạy `validate` trước)                 |
| `npm run audio`     | Sinh MP3 còn thiếu bằng Edge TTS (incremental)                  |
| `npm run csv2deck`  | Chuyển CSV thành deck JSON                                      |

## Deploy

Push lên nhánh `main` là GitHub Actions tự build và đẩy lên GitHub Pages.
`NEXT_PUBLIC_BASE_PATH` được lấy từ **tên repo**, nên đổi tên repo vẫn chạy đúng.

Bật Pages trong repo: **Settings → Pages → Source: GitHub Actions**.

## Thêm nội dung

1. Sửa/thêm file trong `content/` (hoặc soạn CSV rồi chạy `npm run csv2deck`).
2. `npm run validate` để kiểm tra.
3. `npm run audio` để sinh MP3 cho phần mới (file đã có sẽ được bỏ qua).

> **`id` là bất biến.** Tên file audio bám theo `id`, và các phần khác tham
> chiếu chéo qua `id`. Đổi `id` là làm hỏng liên kết và biến audio cũ thành rác.

## Chat với AI

Phần này gọi thẳng Groq API từ trình duyệt và cần **API key miễn phí do người
dùng tự dán** trong Cài đặt (lấy ở [console.groq.com/keys](https://console.groq.com/keys)).

Key **không bao giờ** được nhúng vào repo: đây là web tĩnh, mọi thứ nhúng vào
đều lộ với người xem trang. Các phần học khác không cần key và chạy offline.

Xem thêm [HANDOVER.md](HANDOVER.md) để biết bản đồ file, mô hình dữ liệu và các
quyết định thiết kế.
