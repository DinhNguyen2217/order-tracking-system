# Order Tracking System

Ứng dụng full-stack tối giản để theo dõi đơn hàng, đáp ứng yêu cầu đồ án:

- Frontend: React + Vite
- Backend API: Node.js + Express
- Database: SQLite
- Có endpoint bắt buộc: `GET /api/health`
- Có dữ liệu thật, thêm / sửa / xóa được
- Có trạng thái thay đổi và lịch sử trạng thái
- Có thể test nhiều lần, dễ debug, dễ deploy

## Chức năng chính

- Tạo đơn hàng
- Xem danh sách đơn hàng
- Cập nhật trạng thái đơn
- Xóa đơn hàng
- Lọc theo trạng thái
- Tìm kiếm đơn hàng
- Thống kê nhanh số lượng đơn theo trạng thái

## Trạng thái đơn hàng

- `pending`
- `confirmed`
- `shipping`
- `delivered`
- `cancelled`

## Cấu trúc thư mục

```bash
order-tracking-system/
├─ backend/
│  ├─ database.sqlite
│  ├─ db.js
│  ├─ package.json
│  └─ server.js
├─ frontend/
│  ├─ src/
│  │  ├─ App.jsx
│  │  ├─ main.jsx
│  │  └─ styles.css
│  ├─ index.html
│  ├─ package.json
│  └─ vite.config.js
├─ package.json
└─ README.md
```

## Cài đặt

Mở terminal tại thư mục gốc project:

```bash
npm install
```

## Chạy môi trường phát triển

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

## Test API health

```bash
GET http://localhost:5000/api/health
```

Ví dụ response:

```json
{
  "ok": true,
  "message": "Order Tracking API is running",
  "timestamp": "2026-04-23T00:00:00.000Z"
}
```

## Build frontend

```bash
npm run build
```

Sau khi build, backend sẽ tự phục vụ file React build trong `frontend/dist`.

## Chạy production

```bash
npm start
```

## API chính

### 1. Kiểm tra hệ thống

```http
GET /api/health
```

### 2. Lấy danh sách đơn hàng

```http
GET /api/orders
GET /api/orders?status=pending
GET /api/orders?search=an
```

### 3. Tạo đơn hàng

```http
POST /api/orders
Content-Type: application/json
```

Body mẫu:

```json
{
  "customer_name": "Nguyễn Văn A",
  "product_name": "Giày thể thao",
  "quantity": 2,
  "price": 850000,
  "shipping_address": "12 Lê Lợi, Quận 1, TP.HCM",
  "note": "Giao giờ hành chính"
}
```

### 4. Cập nhật trạng thái đơn

```http
PUT /api/orders/:id/status
Content-Type: application/json
```

Body mẫu:

```json
{
  "status": "shipping"
}
```

### 5. Xóa đơn hàng

```http
DELETE /api/orders/:id
```

### 6. Xem thống kê

```http
GET /api/orders/stats
```

## Điểm mạnh để trình bày với giảng viên

- Có đầy đủ frontend / backend / database
- Có API thật để test bằng Postman
- Có dữ liệu thay đổi thật trong SQLite
- Có lịch sử trạng thái đơn hàng
- Có endpoint `/api/health` để kiểm tra deploy
- Backend tự tạo database và seed dữ liệu mẫu lần đầu chạy

## Gợi ý deploy

### Cách dễ nhất
- Deploy backend Node.js lên Render / Railway
- Build frontend React
- Để backend phục vụ luôn frontend build

### Biến môi trường tùy chọn

- `PORT=5000`

## Debug nhanh

Nếu frontend không gọi được API:
1. Kiểm tra backend đang chạy cổng 5000
2. Kiểm tra terminal backend có lỗi không
3. Kiểm tra `vite.config.js` đã proxy `/api` sang `http://localhost:5000`
4. Gọi thử `http://localhost:5000/api/health`

## Gợi ý demo

1. Mở danh sách đơn hàng mẫu
2. Tạo đơn hàng mới
3. Đổi trạng thái từ `pending` → `confirmed` → `shipping` → `delivered`
4. Mở lịch sử trạng thái để chứng minh có state change
5. Xóa 1 đơn hàng để chứng minh có dữ liệu CRUD thật
