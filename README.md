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
- **Admin panel** (chỉ hiện với role admin): Tổng quan, Người dùng (sửa role,
  cộng/trừ giờ đọc & linh thạch, xóa), Nguồn API (thêm/sửa/bật-tắt link
  openapi + nút Kiểm tra), Thumbnail (đổi URL hoặc **tạo bằng AI** vẽ tên
  truyện + tên tác giả lên bìa), Vật phẩm (tải khung/pháp bảo có xem trước
  và chỉnh scale/offset), Nhân vật mới (linh thạch/giờ tu luyện/vật phẩm
  tặng sẵn cho tài khoản mới), Hệ thống (trạng thái kết nối Supabase).

## 5. Cấu trúc thư mục

```
supabase/schema.sql      schema Postgres đầy đủ (bảng + RLS + trigger + storage)
src/lib/supabase.ts      khởi tạo Supabase client từ env
src/lib/novelApi.ts       client NovelFlow/OpenAPI (nhiều nguồn, gộp danh sách)
src/lib/tuvi.ts           thang 15 cảnh giới tu vi
src/context/             AuthContext (username/password), ThemeContext (light/dark)
src/components/          Navbar, AvatarWithFrame, NovelCard, ReaderView (cuộn vô hạn),
                         Leaderboard (realtime), Treasury, Inventory, CoverGenerator
src/pages/               Home, NovelDetail, Reader, Bookshelf, Profile, Admin, Auth
```
