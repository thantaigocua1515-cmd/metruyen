# Mê Truyện — Thư Các Tu Tiên 📚

Website đọc truyện tu tiên: truyện lấy trực tiếp từ API JSON (mặc định
[TruyenOK NovelFlow](https://truyenok.online/api/v1/openapi.json)), tài khoản
username/password, **tu vi tăng theo giờ đọc**, cuộn vô hạn nối chương, tủ
truyện, Tàng Bảo Các / linh thạch / túi trữ vật, khung avatar & pháp bảo,
bảng xếp hạng thời gian thực, admin panel đầy đủ.

Backend: **Supabase** (Postgres + Auth + Realtime + Storage).
Frontend: Vite 6 + React 18 + TypeScript + Tailwind CSS v4.

## 1. Chuẩn bị Supabase (làm 1 lần)

1. Tạo project tại [supabase.com](https://supabase.com) (free tier là đủ).
2. Vào **SQL Editor → New query**, dán toàn bộ nội dung file
   [`supabase/schema.sql`](supabase/schema.sql) rồi **Run**.
   Script sẽ tạo: 9 bảng dữ liệu, RLS policies, trigger
   (tài khoản đầu tiên → admin, quà tân thủ), 3 Storage bucket
   (`avatars`, `frames`, `covers`) và seed nguồn API TruyenOK.
3. **BẮT BUỘC — tắt xác thực email:** vào **Authentication → Sign In / Sign Up**,
   tắt **"Confirm email"**. Web đăng ký bằng *username* (email tổng hợp dạng
   `username@metruyen.local`), nếu bật confirm email thì không đăng nhập được.
4. Kiểm tra **Storage** đã có 3 bucket public: `avatars`, `frames`, `covers`
   (schema đã tự tạo; nếu thiếu thì tạo tay, bật *Public bucket*).
5. Vào **Project Settings → API**, copy **Project URL** và **anon public key**.

> 🔑 **anon key là public-by-design** — Supabase thiết kế để nhúng ở client.
> Quyền truy cập thật do Row Level Security (RLS) trong `schema.sql` bảo vệ:
> user chỉ đọc/ghi dữ liệu của mình, chỉ admin mới sửa cấu hình.

## 2. Chạy web ở máy local

```bash
cp .env.example .env
# mở .env điền VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY

npm install
npm run dev      # chạy thử ở http://localhost:5173
npm run build    # build production → thư mục dist/
```

Đăng ký **tài khoản đầu tiên** — nó sẽ tự được set role **admin**
(nhờ trigger `set_first_admin`).

## 3. Deploy public

`npm run build` tạo thư mục `dist/` là static site thuần túy, deploy ở đâu cũng được:

| Nơi | Cách |
|---|---|
| **Vercel** | Import repo GitHub → framework *Vite* → thêm 2 env `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| **Netlify** | Kéo thả thư mục `dist/` hoặc connect repo, build command `npm run build`, publish dir `dist` |
| **VPS** | `npm run build` rồi serve `dist/` bằng nginx/caddy |

Vì dùng HashRouter nên không cần cấu hình rewrite gì thêm — mở là chạy.

## 4. Tính năng chính

- **Đọc truyện:** danh sách từ nhiều nguồn API, tìm kiếm, chi tiết + mục lục
  chương, **cuộn vô hạn tự nối chương tiếp theo**, tải EPUB, lưu tiến độ đọc.
- **Tu vi:** 15 cảnh giới từ Phàm Nhân → Thánh Nhân, tăng theo tổng giờ đọc
  (đọc 60 giây thật mới cộng 60 giây — tab ẩn thì không tính).
- **Linh thạch:** đọc 5 phút được +1 linh thạch, dùng mua khung/pháp bảo ở
  **Tàng Bảo Các**, cất trong **Túi Trữ Vật**.
- **5 template giao diện** (xem mục 6): Thư Các Tu Tiên (mặc định), TruyenC Hiện
  Đại, Dạ Huyền Ảo, Cổ Phong, Tối Giản — đổi trong admin, áp dụng realtime.
- **Admin panel** (chỉ hiện với role admin): Tổng quan, Người dùng (sửa role,
  cộng/trừ giờ đọc & linh thạch, xóa), Nguồn API (thêm/sửa/bật-tắt link
  openapi + nút Kiểm tra), **Đồng bộ** (kéo truyện từ API về database của
  mình — xem mục 7), Thumbnail (đổi URL hoặc **tạo bằng AI** — chọn nguồn
  Pollinations (miễn phí) hoặc Gemini (dùng key ở tab 🤖 Gemini, tự xoay key khi
  hết quota; nguồn chính lỗi thì tự thử nguồn còn lại, rồi mới dùng bản vẽ
  canvas) vẽ tên truyện + tên tác giả lên bìa), Vật phẩm (tải khung/pháp bảo có xem trước
  và chỉnh scale/offset), Nhân vật mới (linh thạch/giờ tu luyện/vật phẩm
  tặng sẵn cho tài khoản mới), **Giao diện** (chọn template), Hệ thống
  (trạng thái kết nối Supabase).

## 5. Cấu trúc thư mục

```
supabase/schema.sql      schema Postgres đầy đủ (bảng + RLS + trigger + storage)
src/lib/supabase.ts      khởi tạo Supabase client từ env
src/lib/novelApi.ts       client NovelFlow/OpenAPI (nhiều nguồn, gộp danh sách)
src/lib/sync.ts           sync engine: kéo truyện/chương từ API về DB
src/lib/library.ts        đọc truyện đã đồng bộ từ DB (ưu tiên DB, fallback API)
src/lib/tuvi.ts           thang 15 cảnh giới tu vi
src/lib/genres.ts         đoán thể loại bằng keyword (heuristic — API chưa có trường này)
src/lib/useNovels.ts      hook tải truyện dùng chung (Home/Search/Genres) — ưu tiên DB
src/theme/templates.ts    registry 5 template giao diện
src/context/             AuthContext (username/password), ThemeContext (light/dark),
                         TemplateContext (template hiện tại, realtime qua site_settings)
src/components/          Navbar, BottomTabBar, AvatarWithFrame, NovelCard, ReaderView,
                         Leaderboard (realtime), Treasury, Inventory, CoverGenerator
src/pages/               Home, NovelDetail, Reader, Bookshelf, Profile, UserProfile,
                         Search, Genres, Admin, Auth
```

## 6. Template giao diện 🎨

Web có 5 bộ skin, đổi trong **Quản trị → tab 🎨 Giao diện** (chỉ admin).
Đổi là áp dụng **ngay lập tức cho toàn site** (lưu ở bảng `site_settings`,
realtime tới mọi máy đang mở web):

| ID | Tên | Phong cách |
|---|---|---|
| `thu-cac` | Thư Các Tu Tiên *(mặc định)* | Tông hổ phách thư các cổ điển |
| `truyenc` | TruyenC Hiện Đại | Trắng/tím hiện đại, bottom tab bar mobile, mục Truyện Hot |
| `da-huyen-ao` | Dạ Huyền Ảo | Dark fantasy nền đêm tím |
| `co-phong` | Cổ Phong | Giấy dó, đỏ son + vàng đồng, serif |
| `toi-gian` | Tối Giản | Minimal xám đá, tập trung nội dung |

- Nút Light/Dark vẫn hoạt động với mọi template.
- Template `truyenc` có thêm trang **Tìm kiếm** (`/search`) và **Thể loại**
  (`/genres`). Thể loại do web **tự đoán theo từ khóa** tiêu đề/mô tả
  (`src/lib/genres.ts`) vì API chưa trả trường thể loại — không bịa
  rating/lượt xem.
- **Thêm template mới:** (1) thêm 1 object vào `TEMPLATES` trong
  `src/theme/templates.ts`; (2) thêm block CSS vars `[data-template="<id>"]`
  (+ `.dark[data-template="<id>"]`) trong `src/theme.css`; (3) nếu cần layout
  riêng, rẽ nhánh theo `useTemplate()` trong component (xem `NovelCard`,
  `Navbar`, `Home` làm mẫu).

## 7. Module Đồng bộ truyện 🔄

Kéo truyện từ API nguồn về database Supabase của mình để web tự chủ dữ liệu
(đọc nhanh hơn, không phụ thuộc API, mục lục chính xác bằng tiêu đề chương
thật thay vì đoán).

**Luồng dùng (Quản trị → tab 🔄 Đồng bộ):**

1. **Lần đầu:** chọn nguồn API → "⬇ Đồng bộ danh sách truyện" (lưu metadata
   toàn bộ truyện) → bấm "Đồng bộ chương" từng truyện (lưu nội dung từng
   chương, có thanh tiến độ `X/Y`).
2. **Sau này:** "🔍 Kiểm tra cập nhật" → tự phát hiện truyện mới (lưu
   metadata) và chương mới (chỉ tải các chương mới, không tải lại).

**Tính chất:**

- **Resume:** chương nào đã có trong DB thì bỏ qua, chạy tiếp phần còn thiếu
  (tắt tab giữa chừng, mở lại bấm tiếp vẫn ổn).
- **Bỏ qua chương lỗi:** chương nào lỗi (404, timeout...) được ghi nhận và
  tiếp tục chương sau — không dừng cả quá trình. Kết quả báo số chương bỏ
  qua.
- **Lịch sự với API:** tải tuần tự từng chương, nghỉ ~150ms giữa các request.
- **Ưu tiên DB:** Home/Detail/Reader đọc từ DB trước, chưa đồng bộ thì tự
  fallback về API. Nút "⏹ Dừng" để ngắt giữa chừng.
- Truyện dài 1000+ chương có thể mất vài phút — cứ để tab mở.

**Bảng:** `synced_novels` (metadata, khóa `${source_id}:${api_id}`) và
`synced_chapters` (nội dung, khóa `(novel_id, chapter_number)`). Ai cũng đọc
được, chỉ admin ghi được (RLS + `is_admin()`).

## 8. Gemini API keys & Nhập truyện thủ công 🤖✍️

**Tab 🤖 Gemini — quản lý key dịch thuật:**
- Lấy key miễn phí tại Google AI Studio (aistudio.google.com) → nhập tên gợi nhớ
  + key → bấm "🔍 Kiểm tra & Lưu". Web gọi `GET /v1beta/models?key=...` kiểm tra;
  **chỉ key HTTP 200 mới được lưu** (kèm thời gian + kết quả test).
- Danh sách key: hiện che đi (`AIzaSyA…`), trạng thái bật/tắt, kết quả test gần
  nhất; có nút kiểm tra lại, bật/tắt, xóa.
- Key lưu trong bảng `gemini_keys` — **chỉ admin đọc/ghi** (không có policy
  public nào). Trình duyệt gọi thẳng API Gemini khi dịch.

**Dịch Trung → Việt** (`src/lib/translate.ts`):
- Model `gemini-2.0-flash`, prompt dịch giả truyện tu tiên/huyền huyễn, chia
  chunk ≤ 6000 ký tự (cắt ở ranh giới đoạn), mỗi request timeout 60s.
- **Xoay vòng key:** mỗi chunk thử lần lượt các key đang bật (lệch vòng để chia
  tải); key nào lỗi (401/403/429/quota/mạng) → tự thử key tiếp theo. Hết key →
  báo lỗi tiếng Việt rõ ràng.

**Tab ✍️ Nhập truyện — nhập tay nội dung bạn có quyền dùng:**
1. **Bước 1 — Tạo truyện:** tên (*), tác giả, mô tả, link bìa → lưu vào
   `synced_novels` với `source_id='manual'` (hiện trên web với tên nguồn
   "📝 Nhập tay").
2. **Bước 2 — Nhập chương:** dán nhiều chương theo format:
   ```
   === Chương 1: Tiêu đề chương ===
   Nội dung chương...
   === Chương 2: Tiêu đề ===
   ...
   ```
   Web tự nhận diện chương (hiện số chương + số ký tự). Nút "🤖 Dịch tất cả
   bằng Gemini" dịch từng chương (hiện tiến độ, chống bấm đúp), bản dịch hiện
   lại trong ô text để **kiểm tra/sửa trước khi lưu**. Nút "💾 Lưu vào database"
   upsert vào `synced_chapters` và cập nhật số chương của truyện.
3. Danh sách truyện đã nhập tay + nút xóa (xóa cascade cả chương).
- **Lưu ý:** chỉ nhập nội dung bạn có quyền sử dụng (tự sáng tác, bản dịch của
  bạn, tác phẩm miễn phí/không bản quyền). Không có chức năng cào web tự động.
- Truyện manual đọc được ngay trên web (Home/Detail/Reader đều đọc DB-first);
  `checkUpdates` bỏ qua nguồn manual.
