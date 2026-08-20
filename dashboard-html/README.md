# Hotel Booking Demand — HTML Dashboard (local web)

Bản **dashboard điều hành** local HTML / CSS / JS (teal + cognac), filter hotel + year, light/dark, brush/cross-filter.

**Live (Vercel):** [https://hotel-booking-demand-dashboard.vercel.app](https://hotel-booking-demand-dashboard.vercel.app)

## Chạy local

```bash
cd dashboard-html
python -m http.server 8765
```

Mở: http://localhost:8765

## Refresh data từ star-schema CSV

```bash
python dashboard-html/_export_data.py
```

Nguồn: `data/star schema/revpar_monthly.csv` + `hotel_bookings_normalized.csv`.  
`_export_data.py` **không** được deploy lên Vercel (xem `.vercelignore`).

## Deploy Vercel (an toàn)

Chỉ deploy thư mục `dashboard-html` (static). Không deploy toàn repo.

Production URL ổn định:

```text
https://hotel-booking-demand-dashboard.vercel.app
```

```bash
cd dashboard-html
npx vercel          # preview
npx vercel --prod   # production
```

### Bảo mật đã cấu hình

| Biện pháp | Chi tiết |
|-----------|----------|
| Phạm vi deploy | Chỉ static assets + JSON aggregate; không ship CSV nguồn / export script |
| Security headers | CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer` |
| Data cache | `/data/*` → `Cache-Control: private, no-store` |
| SEO | `robots.txt` Disallow + `noindex` meta |
| Không secret | JSON không chứa API key / credential |

### Bắt buộc nếu data không công khai

JSON trong `/data` vẫn **đọc được** nếu biết URL (static hosting). Để khóa truy cập:

1. Vercel Dashboard → Project → **Settings → Deployment Protection**
2. Bật **Vercel Authentication** (login Vercel) hoặc Password Protection (Pro)

Không dùng “password giả” trong JavaScript — không an toàn.

## Views

| View | Nội dung |
|------|----------|
| Overview | 6 thẻ KPI spark (vs PY / YoY / PY\|CY / sparkline), revenue/bookings, channel share, segment, countries |
| RevPAR | 4 thẻ KPI spark + rating, ADR × Occ, seasonality heatmap, latest month by hotel |
| Cancellation | 4 thẻ KPI spark (metric thất thoát, đảo màu) + driver hủy + brush/cross-filter |
| Pricing Simulator | What-if trên panel RevPAR tháng; 4 thẻ KPI compact (Δ so với baseline, không spark) |

## Bản dashboard khác

| Bản | Thư mục |
|-----|---------|
| Power BI | [`../dashboard-powerbi/`](../dashboard-powerbi/) — mở `Power BI/Hotel Booking Demand v2.pbip` |
