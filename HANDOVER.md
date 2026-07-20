# Tài liệu bàn giao

## 1. Bản đồ file

```
content/                        Nội dung học (import TĨNH vào bundle, không fetch)
  topics.json                   8 chủ đề: id, titleVi, emoji
  decks/<topic>.json            15 thẻ mỗi chủ đề (tên file = id chủ đề)
  dialogues/<id>.json           6 hội thoại: lines[] + questions[]
  scenarios/<id>.json           8 tình huống chat: thread, hints, modelAnswers, rubricVi, srsCards
  example-deck.csv              CSV mẫu cho script csv2deck

public/
  audio/vocab/<id>.mp3          Audio cho thẻ từ vựng (đọc cả câu ví dụ)
  audio/dialogues/<id>.mp3      Audio lời thoại (+ biến thể -slow.mp3)
  icons/                        Icon PWA (sinh bằng scripts/generate-icons.mjs)
  manifest.webmanifest
  sw.js                         Service worker viết tay

scripts/
  validate-content.mjs          Kiểm tra nội dung — CHẠY TỰ ĐỘNG trước build
  generate-audio.mjs            Sinh MP3 còn thiếu bằng Edge TTS (incremental)
  csv-to-deck.mjs               CSV -> deck JSON
  generate-icons.mjs            Sinh icon PWA (chạy tay khi đổi hình)

src/lib/                        LOGIC THUẦN + lớp dữ liệu
  content-schema.ts             Schema zod — DÙNG CHUNG cho app và script validate
  content.ts                    Điểm truy cập nội dung (import tĩnh)
  text.ts                       Chuẩn hoá chuỗi, bỏ dấu, tách từ cốt lõi
  grade.ts        + test        Chấm bài (thuần)
  plan.ts         + test        Sinh kế hoạch ngày + streak (thuần)
  stats.ts        + test        Thống kê từ vựng theo chế độ (thuần)
  date.ts         + test        Ngày theo giờ địa phương (thuần)
  backup.ts       + test        Xuất/nhập JSON khoan dung (thuần)
  groq.ts         + test        Client AI + parse + ánh xạ lỗi (phần thuần có test)
  db.ts                         IndexedDB qua idb-keyval
  store.ts                      zustand + persist (localStorage)
  audio.ts                      Phát MP3, tự fallback speechSynthesis
  recorder.ts                   Bọc MediaRecorder
  modes.ts                      Mô tả 3 cách học
  useDaily.ts                   Hook nối plan thuần với UI
  useStats.ts                   Hook thống kê, ghi ngay sau mỗi câu
  useMounted.ts                 Chống lệch hydration (useSyncExternalStore)
  basePath.ts                   withBase() cho mọi URL tuyệt đối tự viết

src/app/                        Các màn hình (App Router, xuất tĩnh)
  page.tsx                      1. Hôm nay
  vocab/…                       2. Từ vựng (danh sách → chọn cách học → buổi học)
  listen/…                      3. Nghe
  shadow/…                      4. Nói theo
  reply/…                       5. Trả lời tin nhắn
  chat/                         6. Chat với AI
  settings/                     7. Cài đặt

src/components/                 UI dùng chung, BottomNav, đăng ký service worker
```

**Quy ước:** logic thuần nằm ở `src/lib/*.ts` và có unit test; component chỉ lo
hiển thị và gọi vào đó. Trang có route động (`[topic]`, `[id]`) là server
component chỉ làm `generateStaticParams()` rồi render một client component cùng
thư mục — bắt buộc như vậy vì app xuất tĩnh.

## 2. Mô hình dữ liệu

### IndexedDB (idb-keyval) — dữ liệu nặng, ghi thường xuyên

**`wordStats: Record<key, { correct, wrong, lastSeen }>`**

Khoá **tách theo từng chế độ học**, vì cùng một thẻ nhưng nhớ nghĩa / dịch xuôi /
dịch ngược là ba kỹ năng khác nhau:

| Chế độ  | Khoá                  |
| ------- | --------------------- |
| `learn` | `greetings-01`        |
| `en2vi` | `en2vi:greetings-01`  |
| `vi2en` | `vi2en:greetings-01`  |

Khoá trần cho `learn` là cố ý (tương thích ngược). Coi là **"đã thuộc" khi
`correct >= 2`**.

**`sessions: Record<"<topic>:<mode>", SessionCheckpoint>`**

Checkpoint của buổi học đang làm dở: `{ cardIds, index, correctCount, date,
updatedAt }`. `cardIds` giữ nguyên bộ thẻ đã chốt của buổi để lúc quay lại không
bị đổi đề. Xoá khi buổi học hoàn tất.

**`activityLog: { date, type, refId?, count?, at }[]`**

`date` là `YYYY-MM-DD` theo **giờ địa phương**. Giữ 2000 dòng gần nhất. Đây cũng
là nguồn để biết chủ đề nào lâu chưa học (dùng cho việc xoay vòng chủ đề).

### localStorage (zustand persist, key `tacs-app-state`)

`learnerName`, `level` (20/40/60), `wordsPerSession`, `streak`, `bestStreak`,
`lastCompletedDate`, `currentDate`, `doneToday[]`, `todayPlanKey`, `apiKey`.

### Sao lưu

Một file JSON gồm: `store` + `wordStats` + `activityLog` + `sessions`.
File sao lưu từ bản cũ (chưa có `sessions`) vẫn nhập được bình thường.

## 3. Quyết định thiết kế

**Nội dung import tĩnh, không fetch.** Nội dung nằm trong bundle nên chạy được
offline ngay lần đầu và TypeScript kiểm tra được kiểu. Đổi lại bundle to hơn —
chấp nhận được với khối lượng nội dung này.

**Một schema zod duy nhất cho cả app lẫn script.** `scripts/validate-content.mjs`
import thẳng `src/lib/content-schema.ts` (Node 24 đọc được `.ts`), nên schema
không bao giờ lệch giữa hai nơi. Vì thế file đó không được dùng alias `@/…` hay
cú pháp TS cần biên dịch thật.

**`id` là bất biến.** Tên file audio bám theo `id` và các phần tham chiếu chéo
nhau qua `id`. Script validate ép `audio === "vocab/<id>.mp3"` để không ai vô ý
làm lệch.

**Service worker viết tay.** Trang dùng *network-first* (luôn ưu tiên bản mới,
mất mạng thì lấy cache); audio và static asset dùng *cache-first* (file có hash
hoặc gần như không đổi). Request khác gốc — đặc biệt là API Groq — không đụng
tới. SW tự suy ra basePath từ vị trí của chính nó nên deploy ở `/` hay
`/english-learn/` đều chạy. **Chỉ đăng ký ở production** vì SW cache code cũ gây
rối khi phát triển.

**API key do người dùng tự dán.** Web tĩnh không giấu được key. Key nằm trong
localStorage trên máy người dùng, không bao giờ vào repo.

**Tuân thủ React Compiler nghiêm ngặt.** Không gọi `Date.now()` và không đọc ref
trong lúc render — tất cả nằm trong effect hoặc event handler. `useMounted()`
dùng `useSyncExternalStore` (không phải `useState` + `useEffect`) để vừa chống
lệch hydration vừa không vi phạm quy tắc "không setState đồng bộ trong effect".

## 4. Các hành vi CỐ Ý

Đây là những chỗ dễ bị tưởng nhầm là lỗi:

**Chấm bài thoáng tay.** Bỏ qua hoa/thường, dấu câu, và **không phân biệt dấu
tiếng Việt** (`"cam on"` = `"cảm ơn"`). Chỉ tính **tỉ lệ từ cốt lõi trùng khớp**
sau khi loại từ phụ, nên thiếu vài từ đệm vẫn được tính đúng. Người học
pre-intermediate dễ nản nếu bị chấm gắt; mục tiêu là "có nhớ ý chính không".

**Ngưỡng khác nhau theo chế độ.** Dịch sang tiếng Anh (`vi2en`) chặt hơn hẳn
(đúng ≥ 0.75) so với hai chế độ gõ tiếng Việt (đúng ≥ 0.6), vì sản sinh ngoại
ngữ cần chắc chắn hơn.

**Luôn hiện đáp án mẫu + cho tự chấm lại.** Máy chấm offline chắc chắn có lúc
sai, nên sau mỗi câu đều hiện đáp án đầy đủ và có nút để người học tự sửa
verdict. Tự chấm lại **không** cộng thêm lượt trả lời, chỉ chuyển đúng↔sai.

**Chế độ "Học từ vựng" không kiểm tra.** Đây là bước làm quen: xem cụm từ,
nghĩa, câu ví dụ, nghe, rồi sang từ tiếp theo. Không gõ gì cả. Mỗi lần xem một
thẻ được tính là **một lượt đúng**, nên xem đủ 2 lần là thẻ đó "đã thuộc" ở chế
độ này. Muốn thực sự kiểm tra thì dùng hai chế độ dịch câu — ở đó mới có chấm
bài và ngưỡng chặt.

**Thoát giữa chừng vẫn lưu tiến độ, nhưng chưa ghi công ngày.** Sau **mỗi câu**
app ghi hai thứ: `wordStats` và một **checkpoint** của buổi
(`sessions[<topic>:<mode>]` trong IndexedDB). Nhờ checkpoint:

- quay lại là học tiếp đúng câu đang dở, với **đúng bộ thẻ cũ** (không bị đổi đề);
- trang Hôm nay và menu Từ vựng hiện ngay `↩️ đang dở 4/10`, không phải học hết
  buổi mới thấy số;
- buổi dở từ hôm trước vẫn nối tiếp được — cố ý không xét ngày, vì mất công đã
  làm mới là điều khó chịu nhất.

Checkpoint bị xoá khi buổi học hoàn tất. Còn "đã học hôm nay" (dòng trong
`activityLog`, dấu ✅ trong kế hoạch, streak) **vẫn chỉ** được ghi khi hoàn tất
cả buổi — làm dở thì thấy được tiến độ nhưng chưa được tính là xong mục đó.

**Lời thoại ở phần Nghe ẩn mặc định.** Nhìn chữ ngay từ đầu thì thành bài đọc,
không còn là bài nghe. Có nút *Hiện lời thoại* để mở ra đối chiếu; nút nghe từng
câu vẫn dùng được khi đang ẩn.

**Phát cả bài phải chờ từng câu phát xong.** `HTMLAudioElement.play()` trả về
Promise resolve ngay khi âm thanh *bắt đầu*, không phải khi phát xong — dùng
thẳng nó trong vòng lặp thì mỗi câu chỉ kịp kêu một tiếng rồi bị câu sau cắt.
Vì vậy có riêng `playAudioUntilEnd()` chờ sự kiện `ended`, và luôn resolve kể cả
khi bị dừng giữa chừng để vòng lặp không treo.

**Chat tự do** là một mục riêng trong phần Chat AI, không có bối cảnh cố định —
system prompt yêu cầu AI đi theo chủ đề người học chọn thay vì lái về một tình
huống định sẵn.

**Kế hoạch được ghim trong ngày.** Danh sách hoạt động chỉ phụ thuộc
`planKey = ngày|mức|số từ`. Làm xong một mục giữa ngày không làm kế hoạch xáo
lại. Đổi mức học hoặc số từ trong Cài đặt **sẽ** sinh kế hoạch mới và xoá dấu đã
làm của ngày hôm đó.

**Kế hoạch luôn mở đầu bằng từ vựng**, của chủ đề **lâu chưa học nhất** (chủ đề
chưa từng học được ưu tiên trước hết).

**Chat với AI không tính vào kế hoạch và không cộng streak.** Đây là phần luyện
thêm. Có ghi dòng nhật ký `type: "chat"` để xem lại, nhưng cố ý không đi qua
`useCompleteActivity()`.

**Nhập sao lưu thì bỏ qua trường sai kiểu.** Từng trường của `store`, từng mục
của `wordStats`, từng dòng của `activityLog` được kiểm riêng; phần hỏng bị bỏ và
liệt kê cho người dùng, phần còn lại vẫn vào. File sao lưu có thể đến từ bản app
cũ hơn — thà mất một trường còn hơn hỏng cả tiến độ.

**Thiếu file MP3 chỉ là cảnh báo, không chặn build.** App tự chuyển sang
`speechSynthesis` của trình duyệt khi thiếu file, nên nội dung mới thêm vẫn nghe
được ngay trước khi kịp chạy `npm run audio`.

**Nói theo và Trả lời tin nhắn là tự chấm.** Không có cách nào chấm phát âm hay
chấm câu trả lời tự do một cách tử tế khi offline, nên hai phần này cho nghe/đọc
mẫu rồi để người học tự đánh giá theo tiêu chí.

## 5. Còn có thể làm thêm

- Ôn tập theo lịch (spaced repetition) dựa trên `lastSeen` — hiện mới chỉ ưu
  tiên thẻ chưa thuộc và lâu chưa gặp.
- Màn thống kê lịch sử học dựa trên `activityLog` (dữ liệu đã có sẵn).
- Cho người dùng chọn giọng đọc trong Cài đặt.
