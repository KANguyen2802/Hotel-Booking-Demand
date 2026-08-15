/* =============================================================================
   03_business_questions.sql
   Truy vấn trả lời 6 business question của dashboard + insight vận hành.

   Chạy SAU 01 + 02. Highlight từng khối (từ comment BQ đến SELECT tiếp theo).

   Nguồn grain:
     Fact_RevPAR_Monthly  → Overview KPI, RevPAR, Simulator (hotel × tháng)
     Fact_Booking         → Cancellation, channel/segment/country/customer
     Fact_Daily_AdrOcc    → scatter ADR × Occupancy theo ngày

   Weighted average khi gộp nhiều tháng/hotel (KHÔNG dùng AVG cột tỷ lệ):
     ADR    = Σ(adr × successful_bookings) / Σ(successful_bookings)
     Occ    = Σ(occ  × total_bookings)     / Σ(total_bookings)
     RevPAR = Σ(revpar × total_bookings)   / Σ(total_bookings)
   ============================================================================= */

USE [Hotel Booking Demand];
GO

SET NOCOUNT ON;
GO

/* Nếu editor gạch đỏ r.total_bookings / month_start_date: đó là IntelliSense
   chưa refresh schema (Cursor/VS không kết nối SQL Server). Cột đã có sau 01+02.
   Chạy trong SSMS: chọn database [Hotel Booking Demand] → Ctrl+Shift+R
   → bôi MỘT query (ví dụ 1.1, dòng SELECT…FROM) rồi F5. */

/* =============================================================================
   BQ1 — Tăng trưởng đến từ đâu? Doanh thu phụ thuộc kênh/thị trường nào?
   Trang: Overview
   Quyết định: nếu 1 kênh / 1 quốc gia > 50% revenue → rủi ro tập trung.
   ============================================================================= */

/* 1.1 KPI tổng — khớp 6 thẻ Overview */
SELECT
    SUM(r.total_bookings) AS bookings,
    CAST(SUM(r.total_revenue) AS DECIMAL(16, 2)) AS revenue,
    CAST(
        SUM(r.adr * r.successful_bookings) / NULLIF(SUM(r.successful_bookings), 0)
        AS DECIMAL(10, 2)
    ) AS adr,
    CAST(
        SUM(r.occupancy_rate * r.total_bookings) / NULLIF(SUM(r.total_bookings), 0)
        AS DECIMAL(8, 4)
    ) AS occupancy_rate,
    CAST(
        SUM(r.revpar * r.total_bookings) / NULLIF(SUM(r.total_bookings), 0)
        AS DECIMAL(10, 2)
    ) AS revpar,
    CAST(
        SUM(r.canceled_bookings) * 1.0 / NULLIF(SUM(r.total_bookings), 0)
        AS DECIMAL(8, 4)
    ) AS cancel_rate
FROM dbo.Fact_RevPAR_Monthly AS r;

/* 1.2 Revenue & bookings theo tháng (dual-axis) + MoM */
WITH m AS (
    SELECT
        r.year_month,
        r.month_start_date,
        SUM(r.total_bookings) AS bookings,
        CAST(SUM(r.total_revenue) AS DECIMAL(16, 2)) AS revenue
    FROM dbo.Fact_RevPAR_Monthly AS r
    GROUP BY r.year_month, r.month_start_date
)
SELECT
    year_month,
    bookings,
    revenue,
    CAST(
        (revenue - LAG(revenue) OVER (ORDER BY month_start_date))
        * 100.0 / NULLIF(LAG(revenue) OVER (ORDER BY month_start_date), 0)
        AS DECIMAL(8, 2)
    ) AS revenue_mom_pct
FROM m
ORDER BY month_start_date;

/* 1.3 Revenue share by channel — Insight: TA/TO thường chiếm đa số */
SELECT
    c.distribution_channel,
    COUNT(*) AS bookings,
    CAST(SUM(f.revenue) AS DECIMAL(16, 2)) AS revenue,
    CAST(
        100.0 * SUM(f.revenue) / NULLIF(SUM(SUM(f.revenue)) OVER (), 0)
        AS DECIMAL(6, 2)
    ) AS revenue_share_pct,
    CASE
        WHEN 100.0 * SUM(f.revenue) / NULLIF(SUM(SUM(f.revenue)) OVER (), 0) >= 50
            THEN N'Rủi ro phụ thuộc kênh — ưu tiên tăng Direct / đa dạng hóa'
        ELSE N'Tỷ trọng chấp nhận được'
    END AS insight
FROM dbo.Fact_Booking AS f
INNER JOIN dbo.Dim_Channel AS c
    ON c.distribution_channel = f.distribution_channel
GROUP BY c.distribution_channel
ORDER BY revenue DESC;

/* 1.4 Market segment mix */
SELECT
    s.market_segment,
    COUNT(*) AS bookings,
    CAST(SUM(f.revenue) AS DECIMAL(16, 2)) AS revenue,
    CAST(AVG(CAST(f.is_canceled AS DECIMAL(12, 6))) AS DECIMAL(8, 4)) AS cancel_rate,
    CAST(
        100.0 * SUM(f.revenue) / NULLIF(SUM(SUM(f.revenue)) OVER (), 0)
        AS DECIMAL(6, 2)
    ) AS revenue_share_pct
FROM dbo.Fact_Booking AS f
INNER JOIN dbo.Dim_Segment AS s
    ON s.market_segment = f.market_segment
GROUP BY s.market_segment
ORDER BY revenue DESC;

/* 1.5 Top 10 quốc gia theo revenue — Insight: PRT thường chiếm tỷ trọng lớn */
SELECT TOP (10)
    ISNULL(co.country_code, N'(blank)') AS country_code,
    COUNT(*) AS bookings,
    CAST(SUM(f.revenue) AS DECIMAL(16, 2)) AS revenue,
    CAST(AVG(CAST(f.is_canceled AS DECIMAL(12, 6))) AS DECIMAL(8, 4)) AS cancel_rate,
    CAST(
        100.0 * SUM(f.revenue) / NULLIF(SUM(SUM(f.revenue)) OVER (), 0)
        AS DECIMAL(6, 2)
    ) AS share_of_top10_pct
FROM dbo.Fact_Booking AS f
LEFT JOIN dbo.Dim_Country AS co
    ON co.country_code = f.country
GROUP BY ISNULL(co.country_code, N'(blank)')
ORDER BY revenue DESC;

/* 1.6 City vs Resort — đóng góp tăng trưởng */
SELECT
    h.hotel_name,
    SUM(r.total_bookings) AS bookings,
    CAST(SUM(r.total_revenue) AS DECIMAL(16, 2)) AS revenue,
    CAST(
        SUM(r.adr * r.successful_bookings) / NULLIF(SUM(r.successful_bookings), 0)
        AS DECIMAL(10, 2)
    ) AS adr,
    CAST(
        SUM(r.occupancy_rate * r.total_bookings) / NULLIF(SUM(r.total_bookings), 0)
        AS DECIMAL(8, 4)
    ) AS occupancy_rate,
    CAST(
        SUM(r.revpar * r.total_bookings) / NULLIF(SUM(r.total_bookings), 0)
        AS DECIMAL(10, 2)
    ) AS revpar,
    CAST(
        SUM(r.canceled_bookings) * 1.0 / NULLIF(SUM(r.total_bookings), 0)
        AS DECIMAL(8, 4)
    ) AS cancel_rate
FROM dbo.Fact_RevPAR_Monthly AS r
INNER JOIN dbo.Dim_Hotel AS h
    ON h.hotel_name = r.hotel
GROUP BY h.hotel_name
ORDER BY revenue DESC;
GO

USE [Hotel Booking Demand];
GO

/* =============================================================================
   BQ2 — City vs Resort khác nhau thế nào về RevPAR / ADR / Occupancy theo thời gian?
   Trang: RevPAR
   Quyết định: City Peak harden BAR; Resort Peak HOLD, Low CUT — không cùng 1 playbook.
   ============================================================================= */

/* 2.1 Trend RevPAR / ADR / Occ theo hotel × tháng */
SELECT
    h.hotel_name,
    r.year_month,
    r.total_bookings,
    CAST(r.adr AS DECIMAL(10, 2)) AS adr,
    CAST(r.occupancy_rate AS DECIMAL(8, 4)) AS occupancy_rate,
    CAST(r.revpar AS DECIMAL(10, 2)) AS revpar,
    CAST(r.total_revenue AS DECIMAL(16, 2)) AS total_revenue
FROM dbo.Fact_RevPAR_Monthly AS r
INNER JOIN dbo.Dim_Hotel AS h
    ON h.hotel_name = r.hotel
ORDER BY h.hotel_name, r.month_start_date;

/* 2.2 Pivot City vs Resort (cùng format SQLQuery2) */
SELECT
    year_month,
    ROUND(MAX(CASE WHEN hotel = N'City Hotel'   THEN total_revenue END), 2) AS city_revenue,
    ROUND(MAX(CASE WHEN hotel = N'Resort Hotel' THEN total_revenue END), 2) AS resort_revenue,
    ROUND(MAX(CASE WHEN hotel = N'City Hotel'   THEN adr END), 2)           AS city_adr,
    ROUND(MAX(CASE WHEN hotel = N'Resort Hotel' THEN adr END), 2)           AS resort_adr,
    ROUND(MAX(CASE WHEN hotel = N'City Hotel'   THEN revpar END), 2)        AS city_revpar,
    ROUND(MAX(CASE WHEN hotel = N'Resort Hotel' THEN revpar END), 2)        AS resort_revpar
FROM dbo.Fact_RevPAR_Monthly
GROUP BY year_month
ORDER BY year_month;

/* 2.3 Phân rã MoM RevPAR: ΔADR vs ΔOccupancy
      ΔADR = Occ(t-1) × (ADR(t) − ADR(t-1))
      ΔOcc = ADR(t)   × (Occ(t) − Occ(t-1)) */
WITH w AS (
    SELECT
        hotel,
        year_month,
        month_start_date,
        adr,
        occupancy_rate,
        revpar,
        LAG(adr) OVER (PARTITION BY hotel ORDER BY month_start_date) AS adr_pm,
        LAG(occupancy_rate) OVER (PARTITION BY hotel ORDER BY month_start_date) AS occ_pm,
        LAG(revpar) OVER (PARTITION BY hotel ORDER BY month_start_date) AS revpar_pm
    FROM dbo.Fact_RevPAR_Monthly
)
SELECT
    hotel,
    year_month,
    CAST(revpar_pm AS DECIMAL(10, 2)) AS revpar_prev,
    CAST(occ_pm * (adr - adr_pm) AS DECIMAL(10, 2)) AS delta_from_adr,
    CAST(adr * (occupancy_rate - occ_pm) AS DECIMAL(10, 2)) AS delta_from_occupancy,
    CAST(revpar AS DECIMAL(10, 2)) AS revpar_curr,
    CAST(
        revpar - (revpar_pm + occ_pm * (adr - adr_pm) + adr * (occupancy_rate - occ_pm))
        AS DECIMAL(10, 2)
    ) AS residual,
    CASE
        WHEN ABS(occ_pm * (adr - adr_pm)) >= ABS(adr * (occupancy_rate - occ_pm))
            THEN N'Tăng/giảm RevPAR chủ yếu do GIÁ (ADR)'
        ELSE N'Tăng/giảm RevPAR chủ yếu do CÔNG SUẤT (Occupancy)'
    END AS insight
FROM w
WHERE adr_pm IS NOT NULL
ORDER BY hotel, month_start_date;

/* 2.4 Heatmap mùa vụ: hotel × tháng trong năm (trung bình các năm) */
SELECT
    h.hotel_name,
    d.month_number,
    d.month_name,
    d.season,
    CAST(
        SUM(r.revpar * r.total_bookings) / NULLIF(SUM(r.total_bookings), 0)
        AS DECIMAL(10, 2)
    ) AS revpar_wtd
FROM dbo.Fact_RevPAR_Monthly AS r
INNER JOIN dbo.Dim_Hotel AS h ON h.hotel_name = r.hotel
INNER JOIN dbo.Dim_Date AS d ON d.full_date = r.month_start_date
GROUP BY h.hotel_name, d.month_number, d.month_name, d.season
ORDER BY h.hotel_name, d.month_number;

/* 2.5 RevPAR theo mùa × hotel — playbook bất đối xứng */
SELECT
    h.hotel_name,
    d.season,
    SUM(r.total_bookings) AS bookings,
    CAST(
        SUM(r.adr * r.successful_bookings) / NULLIF(SUM(r.successful_bookings), 0)
        AS DECIMAL(10, 2)
    ) AS adr,
    CAST(
        SUM(r.occupancy_rate * r.total_bookings) / NULLIF(SUM(r.total_bookings), 0)
        AS DECIMAL(8, 4)
    ) AS occupancy_rate,
    CAST(
        SUM(r.revpar * r.total_bookings) / NULLIF(SUM(r.total_bookings), 0)
        AS DECIMAL(10, 2)
    ) AS revpar,
    CASE
        WHEN h.hotel_name = N'City Hotel' AND d.season = N'Peak'
            THEN N'RAISE/PROTECT BAR trong band — City Peak kém co giãn'
        WHEN h.hotel_name = N'Resort Hotel' AND d.season = N'Peak'
            THEN N'HOLD — không shock +ADR Resort Peak (co giãn cao)'
        WHEN h.hotel_name = N'Resort Hotel' AND d.season = N'Low'
            THEN N'CUT ~−5% ADR — kích cầu Low season Resort'
        ELSE N'HOLD / tinh chỉnh nhẹ trong band'
    END AS playbook_goi_y
FROM dbo.Fact_RevPAR_Monthly AS r
INNER JOIN dbo.Dim_Hotel AS h ON h.hotel_name = r.hotel
INNER JOIN dbo.Dim_Date AS d ON d.full_date = r.month_start_date
GROUP BY h.hotel_name, d.season
ORDER BY h.hotel_name,
    CASE d.season WHEN N'Peak' THEN 1 WHEN N'Shoulder' THEN 2 ELSE 3 END;

/* 2.6 Tháng gần nhất — so sánh 2 hotel */
WITH latest AS (
    SELECT MAX(year_month) AS year_month FROM dbo.Fact_RevPAR_Monthly
)
SELECT
    r.hotel,
    r.year_month,
    CAST(r.adr AS DECIMAL(10, 2)) AS adr,
    CAST(r.occupancy_rate AS DECIMAL(8, 4)) AS occupancy_rate,
    CAST(r.revpar AS DECIMAL(10, 2)) AS revpar,
    CAST(r.total_revenue AS DECIMAL(16, 2)) AS total_revenue
FROM dbo.Fact_RevPAR_Monthly AS r
INNER JOIN latest AS l ON l.year_month = r.year_month
ORDER BY r.revpar DESC;

/* 2.7 YoY RevPAR (cùng tháng năm trước) */
WITH w AS (
    SELECT
        hotel, year_month, month_start_date, month_number, [year], revpar, total_bookings
    FROM dbo.Fact_RevPAR_Monthly
)
SELECT
    cur.hotel,
    cur.year_month,
    CAST(cur.revpar AS DECIMAL(10, 2)) AS revpar,
    CAST(py.revpar AS DECIMAL(10, 2)) AS revpar_py,
    CAST(
        (cur.revpar - py.revpar) * 100.0 / NULLIF(py.revpar, 0)
        AS DECIMAL(8, 2)
    ) AS revpar_yoy_pct
FROM w AS cur
LEFT JOIN w AS py
    ON py.hotel = cur.hotel
   AND py.month_number = cur.month_number
   AND py.[year] = cur.[year] - 1
ORDER BY cur.hotel, cur.month_start_date;
GO

/* =============================================================================
   BQ3 — Còn dư địa tăng giá mà không mất occupancy không?
   Trang: RevPAR (scatter ngày + RevPAR theo loại phòng)
   Quyết định: cụm ngày ADR cao + Occ vẫn cao = headroom tăng giá;
               ADR cao + Occ thấp = đã quá giá / sai mix.
   ============================================================================= */

/* 3.1 Quadrant ADR × Occupancy theo ngày */
WITH stats AS (
    SELECT
        AVG(adr) AS adr_avg,
        AVG(occupancy_rate) AS occ_avg
    FROM dbo.Fact_Daily_AdrOcc
    WHERE adr IS NOT NULL
)
SELECT
    d.hotel,
    d.arrival_date,
    CAST(d.adr AS DECIMAL(10, 2)) AS adr,
    CAST(d.occupancy_rate AS DECIMAL(8, 4)) AS occupancy_rate,
    CAST(d.revpar AS DECIMAL(10, 2)) AS revpar,
    d.bookings,
    CASE
        WHEN d.adr >= s.adr_avg AND d.occupancy_rate >= s.occ_avg
            THEN N'High ADR + High Occ — giữ / RAISE nhẹ'
        WHEN d.adr <  s.adr_avg AND d.occupancy_rate >= s.occ_avg
            THEN N'Low ADR + High Occ — còn dư địa tăng giá'
        WHEN d.adr >= s.adr_avg AND d.occupancy_rate <  s.occ_avg
            THEN N'High ADR + Low Occ — xem lại giá / hủy'
        ELSE N'Low ADR + Low Occ — kích cầu (promo / CUT)'
    END AS quadrant
FROM dbo.Fact_Daily_AdrOcc AS d
CROSS JOIN stats AS s
WHERE d.adr IS NOT NULL
ORDER BY d.revpar DESC;

/* 3.2 Tóm tắt quadrant — tỷ trọng ngày */
WITH stats AS (
    SELECT AVG(adr) AS adr_avg, AVG(occupancy_rate) AS occ_avg
    FROM dbo.Fact_Daily_AdrOcc
    WHERE adr IS NOT NULL
),
q AS (
    SELECT
        d.hotel,
        CASE
            WHEN d.adr >= s.adr_avg AND d.occupancy_rate >= s.occ_avg THEN N'High-High'
            WHEN d.adr <  s.adr_avg AND d.occupancy_rate >= s.occ_avg THEN N'LowADR-HighOcc (headroom)'
            WHEN d.adr >= s.adr_avg AND d.occupancy_rate <  s.occ_avg THEN N'HighADR-LowOcc (risk)'
            ELSE N'Low-Low'
        END AS quadrant,
        d.revpar
    FROM dbo.Fact_Daily_AdrOcc AS d
    CROSS JOIN stats AS s
    WHERE d.adr IS NOT NULL
)
SELECT
    hotel,
    quadrant,
    COUNT(*) AS days,
    CAST(AVG(revpar) AS DECIMAL(10, 2)) AS avg_revpar,
    CAST(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY hotel) AS DECIMAL(6, 2)) AS day_share_pct
FROM q
GROUP BY hotel, quadrant
ORDER BY hotel, avg_revpar DESC;

/* 3.3 RevPAR theo phòng ĐẶT (reserved) — quan hệ active */
SELECT
    rt.room_type,
    COUNT(*) AS bookings,
    SUM(CASE WHEN f.is_canceled = 0 THEN f.total_nights ELSE 0 END) AS room_nights_sold,
    CAST(SUM(f.revenue) AS DECIMAL(16, 2)) AS revenue,
    CAST(
        SUM(f.revenue) / NULLIF(SUM(CASE WHEN f.is_canceled = 0 THEN f.total_nights END), 0)
        AS DECIMAL(10, 2)
    ) AS revpar_reserved
FROM dbo.Fact_Booking AS f
INNER JOIN dbo.Dim_RoomType AS rt
    ON rt.room_type = f.reserved_room_type
GROUP BY rt.room_type
ORDER BY rt.room_type;

/* 3.4 RevPAR theo phòng ĐƯỢC GÁN (assigned) — join role-playing thứ 2 */
SELECT
    rt.room_type,
    COUNT(*) AS bookings,
    SUM(CASE WHEN f.is_canceled = 0 THEN f.total_nights ELSE 0 END) AS room_nights_sold,
    CAST(SUM(f.revenue) AS DECIMAL(16, 2)) AS revenue,
    CAST(
        SUM(f.revenue) / NULLIF(SUM(CASE WHEN f.is_canceled = 0 THEN f.total_nights END), 0)
        AS DECIMAL(10, 2)
    ) AS revpar_assigned
FROM dbo.Fact_Booking AS f
INNER JOIN dbo.Dim_RoomType AS rt
    ON rt.room_type = f.assigned_room_type
GROUP BY rt.room_type
ORDER BY rt.room_type;

/* 3.5 Tỷ lệ bị đổi phòng (reserved ≠ assigned) — tín hiệu overbooking / ops */
SELECT
    f.hotel,
    COUNT(*) AS bookings,
    SUM(f.room_mismatch_flag) AS room_changed,
    CAST(AVG(CAST(f.room_mismatch_flag AS DECIMAL(12, 6))) AS DECIMAL(8, 4)) AS mismatch_rate,
    CAST(AVG(CAST(f.is_canceled AS DECIMAL(12, 6))) AS DECIMAL(8, 4)) AS cancel_rate
FROM dbo.Fact_Booking AS f
GROUP BY f.hotel;
GO

/* =============================================================================
   BQ4 — Rủi ro hủy tập trung ở đâu (lead time, deposit, kênh, segment)?
   Trang: Cancellation
   Quyết định: High-tier → buffer + refill Direct; Non Refund cần audit chất lượng;
               lead time dài = friction / deposit / CRM confirm.
   ============================================================================= */

/* 4.1 KPI hủy + lost revenue proxy (không phải số kế toán)
      lost_est = revenue × (cx / max(1 − cx, 0.01)) × 0.35 */
WITH k AS (
    SELECT
        COUNT(*) AS bookings,
        SUM(CASE WHEN is_canceled = 1 THEN 1 ELSE 0 END) AS canceled,
        SUM(CASE WHEN reservation_status = N'No-Show' THEN 1 ELSE 0 END) AS no_show,
        SUM(CASE WHEN reservation_status = N'Check-Out' THEN 1 ELSE 0 END) AS check_out,
        CAST(SUM(revenue) AS DECIMAL(16, 2)) AS revenue
    FROM dbo.Fact_Booking
)
SELECT
    bookings,
    canceled,
    no_show,
    CAST(canceled * 1.0 / bookings AS DECIMAL(8, 4)) AS cancel_rate,
    CAST(no_show * 1.0 / bookings AS DECIMAL(8, 4)) AS no_show_rate,
    revenue,
    CAST(
        revenue
        * ((canceled * 1.0 / bookings) / CASE WHEN 1 - (canceled * 1.0 / bookings) < 0.01 THEN 0.01 ELSE 1 - (canceled * 1.0 / bookings) END)
        * 0.35
        AS DECIMAL(16, 2)
    ) AS lost_revenue_est
FROM k;

/* 4.2 Status mix (donut) */
SELECT
    st.reservation_status,
    COUNT(*) AS bookings,
    CAST(100.0 * COUNT(*) / SUM(COUNT(*)) OVER () AS DECIMAL(6, 2)) AS share_pct
FROM dbo.Fact_Booking AS f
INNER JOIN dbo.Dim_Status AS st
    ON st.reservation_status = f.reservation_status
GROUP BY st.reservation_status
ORDER BY bookings DESC;

/* 4.3 Trend cancel & no-show theo tháng */
SELECT
    d.year_month,
    f.hotel,
    COUNT(*) AS bookings,
    CAST(AVG(CAST(f.is_canceled AS DECIMAL(12, 6))) AS DECIMAL(8, 4)) AS cancel_rate,
    CAST(
        AVG(CASE WHEN f.reservation_status = N'No-Show' THEN 1.0 ELSE 0.0 END)
        AS DECIMAL(8, 4)
    ) AS no_show_rate
FROM dbo.Fact_Booking AS f
INNER JOIN dbo.Dim_Date AS d
    ON d.full_date = f.arrival_date
GROUP BY d.year_month, f.hotel
ORDER BY f.hotel, d.year_month;

/* 4.4 Cancel rate theo lead-time bin — càng đặt sớm càng dễ hủy */
SELECT
    f.lead_time_bin,
    f.lead_time_bin_order,
    COUNT(*) AS bookings,
    SUM(CASE WHEN f.is_canceled = 1 THEN 1 ELSE 0 END) AS canceled,
    CAST(AVG(CAST(f.is_canceled AS DECIMAL(12, 6))) AS DECIMAL(8, 4)) AS cancel_rate,
    CAST(AVG(CASE WHEN f.is_canceled = 0 AND f.adr > 0 THEN f.adr END) AS DECIMAL(10, 2)) AS adr_stay
FROM dbo.Fact_Booking AS f
GROUP BY f.lead_time_bin, f.lead_time_bin_order
ORDER BY f.lead_time_bin_order;

/* 4.5 Cancel rate theo deposit
      Insight điển hình dataset này: Non Refund có cancel rất cao → không phải
      “đặt cọc hiệu quả”, mà tín hiệu kênh/OTA / data quality cần audit. */
SELECT
    dep.deposit_type,
    COUNT(*) AS bookings,
    CAST(AVG(CAST(f.is_canceled AS DECIMAL(12, 6))) AS DECIMAL(8, 4)) AS cancel_rate,
    CAST(SUM(f.revenue) AS DECIMAL(16, 2)) AS realized_revenue,
    CASE
        WHEN dep.deposit_type = N'Non Refund'
            THEN N'Audit Non Refund — cancel cao bất thường, đừng kết luận deposit đang chặn hủy'
        WHEN dep.deposit_type = N'No Deposit'
            THEN N'Nhóm lớn nhất — dùng lead-time + CRM, không siết deposit hàng loạt'
        ELSE N'Refundable: mẫu nhỏ, đọc kèm số bookings'
    END AS insight
FROM dbo.Fact_Booking AS f
INNER JOIN dbo.Dim_Deposit AS dep
    ON dep.deposit_type = f.deposit_type
GROUP BY dep.deposit_type
ORDER BY cancel_rate DESC;

/* 4.6 Cancel rate theo channel */
SELECT
    c.distribution_channel,
    COUNT(*) AS bookings,
    CAST(AVG(CAST(f.is_canceled AS DECIMAL(12, 6))) AS DECIMAL(8, 4)) AS cancel_rate,
    CAST(SUM(f.revenue) AS DECIMAL(16, 2)) AS revenue
FROM dbo.Fact_Booking AS f
INNER JOIN dbo.Dim_Channel AS c
    ON c.distribution_channel = f.distribution_channel
GROUP BY c.distribution_channel
ORDER BY cancel_rate DESC;

/* 4.7 Cancel rate theo segment — ẩn nhóm < 50 booking (minBookings dashboard) */
SELECT
    s.market_segment,
    COUNT(*) AS bookings,
    CAST(AVG(CAST(f.is_canceled AS DECIMAL(12, 6))) AS DECIMAL(8, 4)) AS cancel_rate,
    CAST(SUM(f.revenue) AS DECIMAL(16, 2)) AS revenue,
    CASE
        WHEN s.market_segment = N'Groups'
            THEN N'Groups ít co giãn — harden hợp đồng, không dump block'
        WHEN s.market_segment LIKE N'Offline%'
            THEN N'Resort Offline thường elastic — promo Offline trước Online'
        ELSE N'Theo dõi mix vs Direct'
    END AS insight
FROM dbo.Fact_Booking AS f
INNER JOIN dbo.Dim_Segment AS s
    ON s.market_segment = f.market_segment
GROUP BY s.market_segment
HAVING COUNT(*) >= 50
ORDER BY cancel_rate DESC;

/* 4.8 Booking funnel — khoảng hụt Bookings → After cancel = buffer overbooking */
SELECT
    v.stage_order,
    v.stage,
    v.n,
    CAST(100.0 * v.n / FIRST_VALUE(v.n) OVER (ORDER BY v.stage_order) AS DECIMAL(6, 2)) AS vs_top_pct
FROM (
    SELECT 1 AS stage_order, N'Bookings' AS stage, COUNT(*) AS n FROM dbo.Fact_Booking
    UNION ALL
    SELECT 2, N'After cancel leak', SUM(CASE WHEN is_canceled = 0 THEN 1 ELSE 0 END) FROM dbo.Fact_Booking
    UNION ALL
    SELECT 3, N'Check-Out', SUM(CASE WHEN reservation_status = N'Check-Out' THEN 1 ELSE 0 END) FROM dbo.Fact_Booking
) AS v
ORDER BY v.stage_order;

/* 4.9 ADR canceled vs not canceled (thay boxplot) */
SELECT
    f.cancel_label,
    COUNT(*) AS bookings,
    CAST(AVG(f.adr) AS DECIMAL(10, 2)) AS adr_mean,
    CAST(MIN(f.adr) AS DECIMAL(10, 2)) AS adr_min,
    CAST(MAX(f.adr) AS DECIMAL(10, 2)) AS adr_max
FROM dbo.Fact_Booking AS f
WHERE f.adr > 0
GROUP BY f.cancel_label;

/* 4.10 Lead time × deposit — nơi rủi ro chồng chất */
SELECT
    f.lead_time_bin,
    f.lead_time_bin_order,
    f.deposit_type,
    COUNT(*) AS bookings,
    CAST(AVG(CAST(f.is_canceled AS DECIMAL(12, 6))) AS DECIMAL(8, 4)) AS cancel_rate
FROM dbo.Fact_Booking AS f
GROUP BY f.lead_time_bin, f.lead_time_bin_order, f.deposit_type
HAVING COUNT(*) >= 30
ORDER BY f.lead_time_bin_order, cancel_rate DESC;
GO

/* =============================================================================
   BQ5 — RevPAR/doanh thu đổi thế nào nếu chỉnh ADR, Occ, cancel rate?
   Trang: Pricing Simulator
   Mặc định lever giống HTML: ADR +5%, Occ −2pp, Cancel 0pp, elasticity Off.
   Công thức áp dụng TỪNG DÒNG hotel×tháng rồi mới gộp (không gộp rồi mới clamp).
   ============================================================================= */

DECLARE @adr_change_pct     DECIMAL(9, 4) = 5;      -- %
DECLARE @occ_change_pp      DECIMAL(9, 4) = -2;     -- điểm %
DECLARE @cancel_change_pp   DECIMAL(9, 4) = 0;      -- điểm %
DECLARE @elasticity_on      BIT           = 0;      -- 1 = bật soft elasticity −0.25

DECLARE @adr_mult DECIMAL(12, 6) = 1 + @adr_change_pct / 100.0;
DECLARE @occ_pp   DECIMAL(12, 6) = @occ_change_pp / 100.0
    + CASE WHEN @elasticity_on = 1 THEN (@adr_change_pct / 100.0) * -0.25 ELSE 0 END;
DECLARE @cx_pp    DECIMAL(12, 6) = @cancel_change_pp / 100.0;

;WITH sim AS (
    SELECT
        r.hotel,
        r.year_month,
        r.month_start_date,
        r.total_bookings,
        r.total_revenue,
        r.adr,
        r.occupancy_rate,
        r.adr * r.occupancy_rate AS revpar_base,
        r.adr * @adr_mult AS adr_sim,
        CASE
            WHEN v.occ_sim < 0.05 THEN 0.05
            WHEN v.occ_sim > 0.99 THEN 0.99
            ELSE v.occ_sim
        END AS occ_sim
    FROM dbo.Fact_RevPAR_Monthly AS r
    CROSS APPLY (
        SELECT
            CASE
                WHEN x.occ_step1 < 0.05 THEN 0.05
                WHEN x.occ_step1 > 0.99 THEN 0.99
                ELSE x.occ_step1
            END - @cx_pp * 0.5 AS occ_sim
        FROM (
            SELECT r.occupancy_rate + @occ_pp AS occ_step1
        ) AS x
    ) AS v
)
SELECT
    N'Portfolio' AS grain,
    CAST(
        SUM(revpar_base * total_bookings) / NULLIF(SUM(total_bookings), 0)
        AS DECIMAL(10, 2)
    ) AS revpar_baseline,
    CAST(
        SUM(adr_sim * occ_sim * total_bookings) / NULLIF(SUM(total_bookings), 0)
        AS DECIMAL(10, 2)
    ) AS revpar_scenario,
    CAST(
        (
            SUM(adr_sim * occ_sim * total_bookings) / NULLIF(SUM(total_bookings), 0)
            - SUM(revpar_base * total_bookings) / NULLIF(SUM(total_bookings), 0)
        ) * 100.0
        / NULLIF(SUM(revpar_base * total_bookings) / NULLIF(SUM(total_bookings), 0), 0)
        AS DECIMAL(8, 2)
    ) AS delta_revpar_pct,
    CAST(SUM(total_revenue) AS DECIMAL(16, 2)) AS revenue_baseline,
    CAST(
        SUM(
            total_revenue * CASE
                WHEN revpar_base = 0 THEN 1
                ELSE (adr_sim * occ_sim) / revpar_base
            END
        ) AS DECIMAL(16, 2)
    ) AS revenue_scenario
FROM sim;

/* 5.2 Baseline vs scenario theo tháng (line chart) */
;WITH sim AS (
    SELECT
        r.hotel,
        r.year_month,
        r.month_start_date,
        r.total_bookings,
        r.total_revenue,
        r.adr * r.occupancy_rate AS revpar_base,
        r.adr * (1 + @adr_change_pct / 100.0) AS adr_sim,
        CASE
            WHEN occ2 < 0.05 THEN 0.05
            WHEN occ2 > 0.99 THEN 0.99
            ELSE occ2
        END AS occ_sim
    FROM dbo.Fact_RevPAR_Monthly AS r
    CROSS APPLY (
        SELECT
            CASE
                WHEN occ1 < 0.05 THEN 0.05
                WHEN occ1 > 0.99 THEN 0.99
                ELSE occ1
            END - (@cancel_change_pp / 100.0) * 0.5 AS occ2
        FROM (
            SELECT r.occupancy_rate
                + @occ_change_pp / 100.0
                + CASE WHEN @elasticity_on = 1 THEN (@adr_change_pct / 100.0) * -0.25 ELSE 0 END
                AS occ1
        ) AS s1
    ) AS s2
)
SELECT
    year_month,
    CAST(SUM(revpar_base * total_bookings) / NULLIF(SUM(total_bookings), 0) AS DECIMAL(10, 2)) AS revpar_baseline,
    CAST(SUM(adr_sim * occ_sim * total_bookings) / NULLIF(SUM(total_bookings), 0) AS DECIMAL(10, 2)) AS revpar_scenario,
    CAST(
        (
            SUM(adr_sim * occ_sim * total_bookings) / NULLIF(SUM(total_bookings), 0)
            - SUM(revpar_base * total_bookings) / NULLIF(SUM(total_bookings), 0)
        ) * 100.0
        / NULLIF(SUM(revpar_base * total_bookings) / NULLIF(SUM(total_bookings), 0), 0)
        AS DECIMAL(8, 2)
    ) AS delta_revpar_pct
FROM sim
GROUP BY year_month, month_start_date
ORDER BY month_start_date;

/* 5.3 Sensitivity 4 cột: Baseline / ADR only / Occ only / Combined */
;WITH base AS (
    SELECT hotel, year_month, total_bookings, adr, occupancy_rate, total_revenue
    FROM dbo.Fact_RevPAR_Monthly
),
scen AS (
    SELECT * FROM (VALUES
        (N'Baseline',  0.0,  0.0),
        (N'ADR only',  5.0,  0.0),
        (N'Occ only',  0.0, -2.0),
        (N'Combined',  5.0, -2.0)
    ) AS v(scenario, adr_pct, occ_pp)
)
SELECT
    sc.scenario,
    CAST(
        SUM(
            (b.adr * (1 + sc.adr_pct / 100.0))
            * CASE
                WHEN b.occupancy_rate + sc.occ_pp / 100.0 < 0.05 THEN 0.05
                WHEN b.occupancy_rate + sc.occ_pp / 100.0 > 0.99 THEN 0.99
                ELSE b.occupancy_rate + sc.occ_pp / 100.0
              END
            * b.total_bookings
        ) / NULLIF(SUM(b.total_bookings), 0)
        AS DECIMAL(10, 2)
    ) AS revpar
FROM base AS b
CROSS JOIN scen AS sc
GROUP BY sc.scenario
ORDER BY CASE sc.scenario
    WHEN N'Baseline' THEN 1 WHEN N'ADR only' THEN 2
    WHEN N'Occ only' THEN 3 ELSE 4 END;
GO

/* =============================================================================
   BQ6 — Customer type nào gánh nền doanh thu theo tháng?
   Trang: Overview small multiples
   Quyết định: Transient là xương sống; Contract ổn định hơn nhưng nhỏ;
               Transient-Party nhạy mùa / nhóm.
   ============================================================================= */

/* 6.1 Revenue + room-nights theo customer type × tháng */
SELECT
    d.year_month,
    ct.customer_type,
    COUNT(*) AS bookings,
    SUM(CASE WHEN f.is_canceled = 0 THEN f.total_nights ELSE 0 END) AS room_nights,
    CAST(SUM(f.revenue) AS DECIMAL(16, 2)) AS revenue,
    CAST(AVG(CAST(f.is_canceled AS DECIMAL(12, 6))) AS DECIMAL(8, 4)) AS cancel_rate
FROM dbo.Fact_Booking AS f
INNER JOIN dbo.Dim_Date AS d
    ON d.full_date = f.arrival_date
INNER JOIN dbo.Dim_CustomerType AS ct
    ON ct.customer_type = f.customer_type
GROUP BY d.year_month, ct.customer_type
ORDER BY d.year_month, revenue DESC;

/* 6.2 Tỷ trọng cả kỳ */
SELECT
    ct.customer_type,
    COUNT(*) AS bookings,
    CAST(SUM(f.revenue) AS DECIMAL(16, 2)) AS revenue,
    CAST(100.0 * SUM(f.revenue) / NULLIF(SUM(SUM(f.revenue)) OVER (), 0) AS DECIMAL(6, 2)) AS revenue_share_pct,
    CAST(AVG(CAST(f.is_canceled AS DECIMAL(12, 6))) AS DECIMAL(8, 4)) AS cancel_rate,
    CAST(AVG(CASE WHEN f.is_canceled = 0 AND f.adr > 0 THEN f.adr END) AS DECIMAL(10, 2)) AS adr
FROM dbo.Fact_Booking AS f
INNER JOIN dbo.Dim_CustomerType AS ct
    ON ct.customer_type = f.customer_type
GROUP BY ct.customer_type
ORDER BY revenue DESC;

/* 6.3 Repeat guest vs new — giữ chân có đỡ hủy không? */
SELECT
    CASE WHEN f.is_repeated_guest = 1 THEN N'Repeat' ELSE N'New' END AS guest_type,
    f.hotel,
    COUNT(*) AS bookings,
    CAST(AVG(CAST(f.is_canceled AS DECIMAL(12, 6))) AS DECIMAL(8, 4)) AS cancel_rate,
    CAST(SUM(f.revenue) AS DECIMAL(16, 2)) AS revenue
FROM dbo.Fact_Booking AS f
GROUP BY CASE WHEN f.is_repeated_guest = 1 THEN N'Repeat' ELSE N'New' END, f.hotel
ORDER BY f.hotel, guest_type;
GO

/* =============================================================================
   INSIGHT BỔ SUNG — ưu tiên hành động (không nằm trên 1 chart cố định)
   ============================================================================= */

/* I1. Special requests vs cancel — nhiều request → hủy thấp hơn (cam kết cao hơn) */
SELECT
    CASE
        WHEN total_of_special_requests = 0 THEN N'0'
        WHEN total_of_special_requests = 1 THEN N'1'
        WHEN total_of_special_requests = 2 THEN N'2'
        ELSE N'3+'
    END AS special_requests,
    COUNT(*) AS bookings,
    CAST(AVG(CAST(is_canceled AS DECIMAL(12, 6))) AS DECIMAL(8, 4)) AS cancel_rate,
    CAST(AVG(CASE WHEN is_canceled = 0 AND adr > 0 THEN adr END) AS DECIMAL(10, 2)) AS adr
FROM dbo.Fact_Booking
GROUP BY
    CASE
        WHEN total_of_special_requests = 0 THEN N'0'
        WHEN total_of_special_requests = 1 THEN N'1'
        WHEN total_of_special_requests = 2 THEN N'2'
        ELSE N'3+'
    END
ORDER BY special_requests;

/* I2. Previous cancellations — khách đã từng hủy */
SELECT
    CASE WHEN previous_cancellations = 0 THEN N'Chưa từng hủy'
         WHEN previous_cancellations = 1 THEN N'Đã hủy 1 lần'
         ELSE N'Đã hủy 2+ lần'
    END AS prev_cancel_band,
    COUNT(*) AS bookings,
    CAST(AVG(CAST(is_canceled AS DECIMAL(12, 6))) AS DECIMAL(8, 4)) AS cancel_rate
FROM dbo.Fact_Booking
GROUP BY
    CASE WHEN previous_cancellations = 0 THEN N'Chưa từng hủy'
         WHEN previous_cancellations = 1 THEN N'Đã hủy 1 lần'
         ELSE N'Đã hủy 2+ lần'
    END
ORDER BY cancel_rate DESC;

/* I3. Direct vs TA/TO — commission + kiểm soát giá */
SELECT
    f.hotel,
    CASE
        WHEN f.distribution_channel = N'Direct' THEN N'Direct'
        ELSE N'Non-Direct'
    END AS channel_group,
    COUNT(*) AS bookings,
    CAST(SUM(f.revenue) AS DECIMAL(16, 2)) AS revenue,
    CAST(AVG(CAST(f.is_canceled AS DECIMAL(12, 6))) AS DECIMAL(8, 4)) AS cancel_rate,
    CAST(AVG(CASE WHEN f.is_canceled = 0 AND f.adr > 0 THEN f.adr END) AS DECIMAL(10, 2)) AS adr
FROM dbo.Fact_Booking AS f
GROUP BY f.hotel,
    CASE WHEN f.distribution_channel = N'Direct' THEN N'Direct' ELSE N'Non-Direct' END
ORDER BY f.hotel, channel_group;

/* I4. Weekend vs weekday stay length — gợi ý package */
SELECT
    f.hotel,
    CASE
        WHEN f.stays_in_weekend_nights > 0 AND f.stays_in_week_nights = 0 THEN N'Weekend only'
        WHEN f.stays_in_weekend_nights = 0 AND f.stays_in_week_nights > 0 THEN N'Weekday only'
        ELSE N'Mixed'
    END AS stay_pattern,
    COUNT(*) AS bookings,
    CAST(AVG(CAST(f.total_nights AS DECIMAL(12, 4))) AS DECIMAL(8, 2)) AS avg_nights,
    CAST(AVG(CASE WHEN f.is_canceled = 0 AND f.adr > 0 THEN f.adr END) AS DECIMAL(10, 2)) AS adr,
    CAST(AVG(CAST(f.is_canceled AS DECIMAL(12, 6))) AS DECIMAL(8, 4)) AS cancel_rate
FROM dbo.Fact_Booking AS f
GROUP BY f.hotel,
    CASE
        WHEN f.stays_in_weekend_nights > 0 AND f.stays_in_week_nights = 0 THEN N'Weekend only'
        WHEN f.stays_in_weekend_nights = 0 AND f.stays_in_week_nights > 0 THEN N'Weekday only'
        ELSE N'Mixed'
    END
ORDER BY f.hotel, stay_pattern;
GO
