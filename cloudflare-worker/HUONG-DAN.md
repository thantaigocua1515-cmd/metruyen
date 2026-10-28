# Hướng dẫn: Cloudflare Workers AI làm nguồn ảnh dự phòng cho thumbnail

Web Mê Truyện bấm **✨ Tạo bằng AI** sẽ thử **Gemini trước** — nếu Gemini lỗi
hoặc hết quota thì tự chuyển sang **Cloudflare Workers AI** vẽ tiếp (miễn phí).
Worker dưới đây là proxy giữ API token của bạn an toàn (không lộ ra trình duyệt).

## Bước 1 — Tài khoản Cloudflare (miễn phí, KHÔNG cần thẻ tín dụng)

1. Vào https://dash.cloudflare.com/sign-up → đăng ký / đăng nhập.
2. Ở trang tổng quan, nhìn cột bên phải → copy **Account ID**.

## Bước 2 — Tạo API Token

1. Dashboard → bấm avatar góc trên phải → **My Profile** → **API Tokens**
   (hoặc **Manage API Tokens**).
2. **Create Token** → chọn mẫu **Workers AI** nếu có; nếu không, chọn
   **Get started** ở mục Custom token:
   - **Permissions**: `Account` → `Workers AI` → **Read**
     (nếu khi chạy báo lỗi quyền thì sửa lại thành **Edit** rồi thử lại)
   - **Continue to summary** → **Create Token**
3. **Copy token ngay** — nó chỉ hiện một lần duy nhất.

## Bước 3 — Tạo Worker

1. Dashboard → **Workers & Pages** → **Create** → **Create Worker**
   → bấm **Deploy** (giữ tên mặc định cũng được).
2. Bấm **Edit code** → xóa hết code mẫu → paste toàn bộ nội dung file
   `worker.js` trong thư mục này → **Save and deploy**.
3. Copy **URL của worker** (dạng `https://ten-worker.ten-tai-khoan.workers.dev`).

## Bước 4 — Cấu hình secret cho Worker

1. Trong trang worker → **Settings** → **Variables and Secrets** → **Add**:
   - `CF_ACCOUNT_ID` = Account ID ở Bước 1 (đánh dấu **Secret**)
   - `CF_API_TOKEN` = token ở Bước 2 (đánh dấu **Secret**)
   - `WORKER_SECRET` = tự đặt một chuỗi ngẫu nhiên dài (ví dụ 32 ký tự,
     đánh dấu **Secret**) — web sẽ gửi chuỗi này kèm mỗi request để chống
     người lạ gọi chùa làm hết quota của bạn.
2. **Save**. Nếu nó yêu cầu redeploy thì bấm redeploy.

## Bước 5 — Nối vào web Mê Truyện

1. Chạy đoạn SQL migration `cloudflare_config` (mình gửi trong chat) một lần
   trong Supabase.
2. Vào web → **Quản trị** → tab **🖼️ Thumbnails** → mục
   **☁️ Cloudflare Workers AI**:
   - Dán **Worker URL** (Bước 3) và **Worker Secret** (Bước 4)
   - Bật công tắc → **Lưu** → **Kiểm tra kết nối**.
3. Xong! Từ giờ nút **✨ Tạo bằng AI** thử Gemini trước, lỗi thì tự dùng
   Cloudflare.

## Quota miễn phí

- **10.000 Neurons/ngày**, reset lúc 0h UTC. Với cỡ ảnh bìa truyện thì được
  vài chục ảnh mỗi ngày — đủ dùng thoải mái.
- Xem mức đã dùng tại Dashboard → **AI** → **Workers AI**.
- Hết quota trong ngày thì worker trả lỗi, web báo lại — hôm sau tự reset.

## Xử lý sự cố

| Lỗi | Cách sửa |
|---|---|
| Worker trả 403 | Sai `WORKER_SECRET` — kiểm tra secret trong worker và web phải giống nhau |
| Worker trả 500 thiếu cấu hình | Chưa set `CF_ACCOUNT_ID` / `CF_API_TOKEN` ở Bước 4 |
| Workers AI lỗi 4xx | Token thiếu quyền — sửa token thành quyền Edit rồi thử lại |
| Web báo "Worker không trả về ảnh" | Workers AI đang bận — đợi chút rồi thử lại |
