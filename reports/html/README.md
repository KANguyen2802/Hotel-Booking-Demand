# Báo cáo SCQA — Hotel Booking Demand

Data storytelling tổng hợp dự án theo framework **SCQA** (Situation → Complication → Question → Answer).

**Live (Vercel):** [https://hotel-booking-demand-scqa.vercel.app](https://hotel-booking-demand-scqa.vercel.app)

## Local

```bash
cd reports/html
python -m http.server 8766
```

Mở: http://localhost:8766

## Deploy Vercel

Chỉ deploy thư mục `reports/html` (static). Không deploy toàn repo.

```bash
cd reports/html
npx vercel          # preview
npx vercel --prod   # production
```

Nếu đường dẫn OneDrive/Unicode khiến CLI bỏ sót file HTML, deploy từ bản copy tạm (đã hydrate đầy đủ) rồi giữ project link `.vercel/`.
