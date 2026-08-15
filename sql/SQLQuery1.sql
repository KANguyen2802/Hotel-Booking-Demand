/* =============================================================================
   SQLQuery1.sql — Business questions trên FLAT SCHEMA (dbo.hotel_booking_db)
   Grain: 1 dòng = 1 booking. Không join dimension.

   BQ1 Overview · BQ4 Cancellation · BQ6 Customer type + insight bổ sung
   (BQ2 / BQ3 / BQ5 theo hotel → SQLQuery2.sql)

   Công thức KPI (khớp dashboard / SQLQuery2):
     revenue         = adr × (weekend + week nights) khi is_canceled = 0
     adr             = AVG(adr) WHERE is_canceled = 0 AND adr > 0
     occupancy_rate  = AVG(1 - is_canceled)          -- proxy, không có inventory
     revpar          = adr × occupancy_rate
   ============================================================================= */

USE [Hotel Booking Demand];
GO

SET NOCOUNT ON;
GO

/* -----------------------------------------------------------------------------
   Baseline — RevPAR / ADR / Occ / Revenue theo tháng (cả portfolio)
   ----------------------------------------------------------------------------- */
WITH base AS (
    SELECT
        arrival_date_year,
        arrival_date_month,
        MONTH(CONVERT(date, CONCAT(arrival_date_month, ' 1, ', arrival_date_year))) AS month_num,
        is_canceled,
        adr,
        stays_in_weekend_nights + stays_in_week_nights AS total_nights
    FROM dbo.hotel_booking_db
),
monthly AS (
    SELECT
        arrival_date_year,
        month_num,
        CONCAT(arrival_date_year, '-', RIGHT('0' + CAST(month_num AS varchar(2)), 2)) AS year_month,
        SUM(CASE WHEN is_canceled = 0 THEN adr * total_nights ELSE 0 END) AS revenue,
        AVG(CASE WHEN is_canceled = 0 AND adr > 0 THEN adr END) AS adr,
        AVG(1.0 - is_canceled) AS occupancy_rate,
        COUNT(*) AS total_bookings,
        SUM(CASE WHEN is_canceled = 0 THEN 1 ELSE 0 END) AS stay_bookings
    FROM base
    GROUP BY arrival_date_year, month_num
)
SELECT
    year_month,
    revenue,
    ROUND(adr, 2) AS adr,
    ROUND(occupancy_rate, 4) AS occupancy_rate,
    ROUND(adr * occupancy_rate, 2) AS revpar,
    total_bookings,
    stay_bookings
FROM monthly
ORDER BY arrival_date_year, month_num;
GO

/* =============================================================================
   BQ1 — Tăng trưởng đến từ đâu? Doanh thu phụ thuộc kênh/thị trường nào?
   Nếu 1 kênh / 1 quốc gia ≥ 50% revenue → rủi ro tập trung.
   ============================================================================= */

/* 1.1 KPI tổng — 6 thẻ Overview */
SELECT
    COUNT(*) AS bookings,
    CAST(SUM(CASE WHEN is_canceled = 0 THEN adr * (stays_in_weekend_nights + stays_in_week_nights) ELSE 0 END) AS DECIMAL(16, 2)) AS revenue,
    CAST(AVG(CASE WHEN is_canceled = 0 AND adr > 0 THEN adr END) AS DECIMAL(10, 2)) AS adr,
    CAST(AVG(1.0 - is_canceled) AS DECIMAL(8, 4)) AS occupancy_rate,
    CAST(
        AVG(CASE WHEN is_canceled = 0 AND adr > 0 THEN adr END) * AVG(1.0 - is_canceled)
        AS DECIMAL(10, 2)
    ) AS revpar,
    CAST(AVG(1.0 * is_canceled) AS DECIMAL(8, 4)) AS cancel_rate
FROM dbo.hotel_booking_db;

/* 1.2 Revenue & bookings theo tháng + MoM */
WITH base AS (
    SELECT
        MONTH(CONVERT(date, CONCAT(arrival_date_month, ' 1, ', arrival_date_year))) AS month_num,
        arrival_date_year,
        is_canceled,
        adr,
        stays_in_weekend_nights + stays_in_week_nights AS total_nights
    FROM dbo.hotel_booking_db
),
m AS (
    SELECT
        CONCAT(arrival_date_year, '-', RIGHT('0' + CAST(month_num AS varchar(2)), 2)) AS year_month,
        DATEFROMPARTS(arrival_date_year, month_num, 1) AS month_start,
        COUNT(*) AS bookings,
        CAST(SUM(CASE WHEN is_canceled = 0 THEN adr * total_nights ELSE 0 END) AS DECIMAL(16, 2)) AS revenue
    FROM base
    GROUP BY arrival_date_year, month_num
)
SELECT
    year_month,
    bookings,
    revenue,
    CAST(
        (revenue - LAG(revenue) OVER (ORDER BY month_start))
        * 100.0 / NULLIF(LAG(revenue) OVER (ORDER BY month_start), 0)
        AS DECIMAL(8, 2)
    ) AS revenue_mom_pct
FROM m
ORDER BY month_start;

/* 1.3 Revenue share by channel */
SELECT
    distribution_channel,
    COUNT(*) AS bookings,
    CAST(SUM(CASE WHEN is_canceled = 0 THEN adr * (stays_in_weekend_nights + stays_in_week_nights) ELSE 0 END) AS DECIMAL(16, 2)) AS revenue,
    CAST(
        100.0 * SUM(CASE WHEN is_canceled = 0 THEN adr * (stays_in_weekend_nights + stays_in_week_nights) ELSE 0 END)
        / NULLIF(SUM(SUM(CASE WHEN is_canceled = 0 THEN adr * (stays_in_weekend_nights + stays_in_week_nights) ELSE 0 END)) OVER (), 0)
        AS DECIMAL(6, 2)
    ) AS revenue_share_pct,
    CASE
        WHEN 100.0 * SUM(CASE WHEN is_canceled = 0 THEN adr * (stays_in_weekend_nights + stays_in_week_nights) ELSE 0 END)
             / NULLIF(SUM(SUM(CASE WHEN is_canceled = 0 THEN adr * (stays_in_weekend_nights + stays_in_week_nights) ELSE 0 END)) OVER (), 0) >= 50
            THEN N'Rủi ro phụ thuộc kênh — ưu tiên tăng Direct / đa dạng hóa'
        ELSE N'Tỷ trọng chấp nhận được'
    END AS insight
FROM dbo.hotel_booking_db
GROUP BY distribution_channel
ORDER BY revenue DESC;

/* 1.4 Market segment mix */
SELECT
    market_segment,
    COUNT(*) AS bookings,
    CAST(SUM(CASE WHEN is_canceled = 0 THEN adr * (stays_in_weekend_nights + stays_in_week_nights) ELSE 0 END) AS DECIMAL(16, 2)) AS revenue,
    CAST(AVG(1.0 * is_canceled) AS DECIMAL(8, 4)) AS cancel_rate,
    CAST(
        100.0 * SUM(CASE WHEN is_canceled = 0 THEN adr * (stays_in_weekend_nights + stays_in_week_nights) ELSE 0 END)
        / NULLIF(SUM(SUM(CASE WHEN is_canceled = 0 THEN adr * (stays_in_weekend_nights + stays_in_week_nights) ELSE 0 END)) OVER (), 0)
        AS DECIMAL(6, 2)
    ) AS revenue_share_pct
FROM dbo.hotel_booking_db
GROUP BY market_segment
ORDER BY revenue DESC;

/* 1.5 Top 10 quốc gia theo revenue */
SELECT TOP (10)
    ISNULL(NULLIF(LTRIM(RTRIM(country)), N''), N'(blank)') AS country_code,
    COUNT(*) AS bookings,
    CAST(SUM(CASE WHEN is_canceled = 0 THEN adr * (stays_in_weekend_nights + stays_in_week_nights) ELSE 0 END) AS DECIMAL(16, 2)) AS revenue,
    CAST(AVG(1.0 * is_canceled) AS DECIMAL(8, 4)) AS cancel_rate
FROM dbo.hotel_booking_db
GROUP BY ISNULL(NULLIF(LTRIM(RTRIM(country)), N''), N'(blank)')
ORDER BY revenue DESC;

/* 1.6 City vs Resort — đóng góp tăng trưởng */
SELECT
    hotel,
    COUNT(*) AS bookings,
    CAST(SUM(CASE WHEN is_canceled = 0 THEN adr * (stays_in_weekend_nights + stays_in_week_nights) ELSE 0 END) AS DECIMAL(16, 2)) AS revenue,
    CAST(AVG(CASE WHEN is_canceled = 0 AND adr > 0 THEN adr END) AS DECIMAL(10, 2)) AS adr,
    CAST(AVG(1.0 - is_canceled) AS DECIMAL(8, 4)) AS occupancy_rate,
    CAST(
        AVG(CASE WHEN is_canceled = 0 AND adr > 0 THEN adr END) * AVG(1.0 - is_canceled)
        AS DECIMAL(10, 2)
    ) AS revpar,
    CAST(AVG(1.0 * is_canceled) AS DECIMAL(8, 4)) AS cancel_rate
FROM dbo.hotel_booking_db
GROUP BY hotel
ORDER BY revenue DESC;
GO

/* =============================================================================
   BQ4 — Rủi ro hủy tập trung ở đâu (lead time, deposit, kênh, segment)?
   High-tier → buffer + refill Direct. Non Refund cancel cao → audit, không kết luận deposit đang chặn hủy.
   ============================================================================= */

/* 4.1 KPI hủy + lost revenue proxy (không phải số kế toán)
      lost_est = revenue × (cx / max(1 − cx, 0.01)) × 0.35 */
WITH k AS (
    SELECT
        COUNT(*) AS bookings,
        SUM(CASE WHEN is_canceled = 1 THEN 1 ELSE 0 END) AS canceled,
        SUM(CASE WHEN reservation_status = N'No-Show' THEN 1 ELSE 0 END) AS no_show,
        SUM(CASE WHEN reservation_status = N'Check-Out' THEN 1 ELSE 0 END) AS check_out,
        CAST(SUM(CASE WHEN is_canceled = 0 THEN adr * (stays_in_weekend_nights + stays_in_week_nights) ELSE 0 END) AS DECIMAL(16, 2)) AS revenue
    FROM dbo.hotel_booking_db
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

/* 4.2 Status mix */
SELECT
    reservation_status,
    COUNT(*) AS bookings,
    CAST(100.0 * COUNT(*) / SUM(COUNT(*)) OVER () AS DECIMAL(6, 2)) AS share_pct
FROM dbo.hotel_booking_db
GROUP BY reservation_status
ORDER BY bookings DESC;

/* 4.3 Trend cancel & no-show theo tháng */
WITH base AS (
    SELECT
        arrival_date_year,
        MONTH(CONVERT(date, CONCAT(arrival_date_month, ' 1, ', arrival_date_year))) AS month_num,
        is_canceled,
        reservation_status
    FROM dbo.hotel_booking_db
)
SELECT
    CONCAT(arrival_date_year, '-', RIGHT('0' + CAST(month_num AS varchar(2)), 2)) AS year_month,
    COUNT(*) AS bookings,
    CAST(AVG(1.0 * is_canceled) AS DECIMAL(8, 4)) AS cancel_rate,
    CAST(AVG(CASE WHEN reservation_status = N'No-Show' THEN 1.0 ELSE 0.0 END) AS DECIMAL(8, 4)) AS no_show_rate
FROM base
GROUP BY arrival_date_year, month_num
ORDER BY arrival_date_year, month_num;

/* 4.4 Cancel rate theo lead-time bin */
SELECT
    CASE
        WHEN lead_time <= 7   THEN N'0-7d'
        WHEN lead_time <= 30  THEN N'8-30d'
        WHEN lead_time <= 90  THEN N'31-90d'
        WHEN lead_time <= 180 THEN N'91-180d'
        ELSE N'180d+'
    END AS lead_time_bin,
    CASE
        WHEN lead_time <= 7   THEN 0
        WHEN lead_time <= 30  THEN 1
        WHEN lead_time <= 90  THEN 2
        WHEN lead_time <= 180 THEN 3
        ELSE 4
    END AS lead_time_bin_order,
    COUNT(*) AS bookings,
    SUM(CASE WHEN is_canceled = 1 THEN 1 ELSE 0 END) AS canceled,
    CAST(AVG(1.0 * is_canceled) AS DECIMAL(8, 4)) AS cancel_rate,
    CAST(AVG(CASE WHEN is_canceled = 0 AND adr > 0 THEN adr END) AS DECIMAL(10, 2)) AS adr_stay
FROM dbo.hotel_booking_db
GROUP BY
    CASE
        WHEN lead_time <= 7   THEN N'0-7d'
        WHEN lead_time <= 30  THEN N'8-30d'
        WHEN lead_time <= 90  THEN N'31-90d'
        WHEN lead_time <= 180 THEN N'91-180d'
        ELSE N'180d+'
    END,
    CASE
        WHEN lead_time <= 7   THEN 0
        WHEN lead_time <= 30  THEN 1
        WHEN lead_time <= 90  THEN 2
        WHEN lead_time <= 180 THEN 3
        ELSE 4
    END
ORDER BY lead_time_bin_order;

/* 4.5 Cancel rate theo deposit */
SELECT
    deposit_type,
    COUNT(*) AS bookings,
    CAST(AVG(1.0 * is_canceled) AS DECIMAL(8, 4)) AS cancel_rate,
    CAST(SUM(CASE WHEN is_canceled = 0 THEN adr * (stays_in_weekend_nights + stays_in_week_nights) ELSE 0 END) AS DECIMAL(16, 2)) AS realized_revenue,
    CASE
        WHEN deposit_type = N'Non Refund'
            THEN N'Audit Non Refund — cancel cao bất thường, đừng kết luận deposit đang chặn hủy'
        WHEN deposit_type = N'No Deposit'
            THEN N'Nhóm lớn nhất — dùng lead-time + CRM, không siết deposit hàng loạt'
        ELSE N'Refundable: mẫu nhỏ, đọc kèm số bookings'
    END AS insight
FROM dbo.hotel_booking_db
GROUP BY deposit_type
ORDER BY cancel_rate DESC;

/* 4.6 Cancel rate theo channel */
SELECT
    distribution_channel,
    COUNT(*) AS bookings,
    CAST(AVG(1.0 * is_canceled) AS DECIMAL(8, 4)) AS cancel_rate,
    CAST(SUM(CASE WHEN is_canceled = 0 THEN adr * (stays_in_weekend_nights + stays_in_week_nights) ELSE 0 END) AS DECIMAL(16, 2)) AS revenue
FROM dbo.hotel_booking_db
GROUP BY distribution_channel
ORDER BY cancel_rate DESC;

/* 4.7 Cancel rate theo segment — ẩn nhóm < 50 booking */
SELECT
    market_segment,
    COUNT(*) AS bookings,
    CAST(AVG(1.0 * is_canceled) AS DECIMAL(8, 4)) AS cancel_rate,
    CAST(SUM(CASE WHEN is_canceled = 0 THEN adr * (stays_in_weekend_nights + stays_in_week_nights) ELSE 0 END) AS DECIMAL(16, 2)) AS revenue,
    CASE
        WHEN market_segment = N'Groups' THEN N'Groups ít co giãn — harden hợp đồng, không dump block'
        WHEN market_segment LIKE N'Offline%' THEN N'Resort Offline thường elastic — promo Offline trước Online'
        ELSE N'Theo dõi mix vs Direct'
    END AS insight
FROM dbo.hotel_booking_db
GROUP BY market_segment
HAVING COUNT(*) >= 50
ORDER BY cancel_rate DESC;

/* 4.8 Booking funnel — khoảng hụt = gợi ý buffer overbooking */
SELECT
    v.stage_order,
    v.stage,
    v.n,
    CAST(100.0 * v.n / FIRST_VALUE(v.n) OVER (ORDER BY v.stage_order) AS DECIMAL(6, 2)) AS vs_top_pct
FROM (
    SELECT 1 AS stage_order, N'Bookings' AS stage, COUNT(*) AS n FROM dbo.hotel_booking_db
    UNION ALL
    SELECT 2, N'After cancel leak', SUM(CASE WHEN is_canceled = 0 THEN 1 ELSE 0 END) FROM dbo.hotel_booking_db
    UNION ALL
    SELECT 3, N'Check-Out', SUM(CASE WHEN reservation_status = N'Check-Out' THEN 1 ELSE 0 END) FROM dbo.hotel_booking_db
) AS v
ORDER BY v.stage_order;

/* 4.9 ADR canceled vs not canceled */
SELECT
    CASE WHEN is_canceled = 1 THEN N'Canceled' ELSE N'Not canceled' END AS cancel_label,
    COUNT(*) AS bookings,
    CAST(AVG(adr) AS DECIMAL(10, 2)) AS adr_mean,
    CAST(MIN(adr) AS DECIMAL(10, 2)) AS adr_min,
    CAST(MAX(adr) AS DECIMAL(10, 2)) AS adr_max
FROM dbo.hotel_booking_db
WHERE adr > 0
GROUP BY CASE WHEN is_canceled = 1 THEN N'Canceled' ELSE N'Not canceled' END;

/* 4.10 Lead time × deposit */
SELECT
    CASE
        WHEN lead_time <= 7   THEN N'0-7d'
        WHEN lead_time <= 30  THEN N'8-30d'
        WHEN lead_time <= 90  THEN N'31-90d'
        WHEN lead_time <= 180 THEN N'91-180d'
        ELSE N'180d+'
    END AS lead_time_bin,
    CASE
        WHEN lead_time <= 7   THEN 0
        WHEN lead_time <= 30  THEN 1
        WHEN lead_time <= 90  THEN 2
        WHEN lead_time <= 180 THEN 3
        ELSE 4
    END AS lead_time_bin_order,
    deposit_type,
    COUNT(*) AS bookings,
    CAST(AVG(1.0 * is_canceled) AS DECIMAL(8, 4)) AS cancel_rate
FROM dbo.hotel_booking_db
GROUP BY
    CASE
        WHEN lead_time <= 7   THEN N'0-7d'
        WHEN lead_time <= 30  THEN N'8-30d'
        WHEN lead_time <= 90  THEN N'31-90d'
        WHEN lead_time <= 180 THEN N'91-180d'
        ELSE N'180d+'
    END,
    CASE
        WHEN lead_time <= 7   THEN 0
        WHEN lead_time <= 30  THEN 1
        WHEN lead_time <= 90  THEN 2
        WHEN lead_time <= 180 THEN 3
        ELSE 4
    END,
    deposit_type
HAVING COUNT(*) >= 30
ORDER BY lead_time_bin_order, cancel_rate DESC;
GO

/* =============================================================================
   BQ6 — Customer type nào gánh nền doanh thu theo tháng?
   Transient = xương sống; Contract nhỏ nhưng ổn định; Transient-Party nhạy mùa.
   ============================================================================= */

/* 6.1 Revenue + room-nights theo customer type × tháng */
WITH base AS (
    SELECT
        arrival_date_year,
        MONTH(CONVERT(date, CONCAT(arrival_date_month, ' 1, ', arrival_date_year))) AS month_num,
        customer_type,
        is_canceled,
        adr,
        stays_in_weekend_nights + stays_in_week_nights AS total_nights
    FROM dbo.hotel_booking_db
)
SELECT
    CONCAT(arrival_date_year, '-', RIGHT('0' + CAST(month_num AS varchar(2)), 2)) AS year_month,
    customer_type,
    COUNT(*) AS bookings,
    SUM(CASE WHEN is_canceled = 0 THEN total_nights ELSE 0 END) AS room_nights,
    CAST(SUM(CASE WHEN is_canceled = 0 THEN adr * total_nights ELSE 0 END) AS DECIMAL(16, 2)) AS revenue,
    CAST(AVG(1.0 * is_canceled) AS DECIMAL(8, 4)) AS cancel_rate
FROM base
GROUP BY arrival_date_year, month_num, customer_type
ORDER BY arrival_date_year, month_num, revenue DESC;

/* 6.2 Tỷ trọng cả kỳ */
SELECT
    customer_type,
    COUNT(*) AS bookings,
    CAST(SUM(CASE WHEN is_canceled = 0 THEN adr * (stays_in_weekend_nights + stays_in_week_nights) ELSE 0 END) AS DECIMAL(16, 2)) AS revenue,
    CAST(
        100.0 * SUM(CASE WHEN is_canceled = 0 THEN adr * (stays_in_weekend_nights + stays_in_week_nights) ELSE 0 END)
        / NULLIF(SUM(SUM(CASE WHEN is_canceled = 0 THEN adr * (stays_in_weekend_nights + stays_in_week_nights) ELSE 0 END)) OVER (), 0)
        AS DECIMAL(6, 2)
    ) AS revenue_share_pct,
    CAST(AVG(1.0 * is_canceled) AS DECIMAL(8, 4)) AS cancel_rate,
    CAST(AVG(CASE WHEN is_canceled = 0 AND adr > 0 THEN adr END) AS DECIMAL(10, 2)) AS adr
FROM dbo.hotel_booking_db
GROUP BY customer_type
ORDER BY revenue DESC;

/* 6.3 Repeat guest vs new */
SELECT
    hotel,
    CASE WHEN is_repeated_guest = 1 THEN N'Repeat' ELSE N'New' END AS guest_type,
    COUNT(*) AS bookings,
    CAST(AVG(1.0 * is_canceled) AS DECIMAL(8, 4)) AS cancel_rate,
    CAST(SUM(CASE WHEN is_canceled = 0 THEN adr * (stays_in_weekend_nights + stays_in_week_nights) ELSE 0 END) AS DECIMAL(16, 2)) AS revenue
FROM dbo.hotel_booking_db
GROUP BY hotel, CASE WHEN is_repeated_guest = 1 THEN N'Repeat' ELSE N'New' END
ORDER BY hotel, guest_type;
GO

/* =============================================================================
   Insight bổ sung
   ============================================================================= */

/* I1. Special requests vs cancel — nhiều request → hủy thường thấp hơn */
SELECT
    CASE
        WHEN total_of_special_requests = 0 THEN N'0'
        WHEN total_of_special_requests = 1 THEN N'1'
        WHEN total_of_special_requests = 2 THEN N'2'
        ELSE N'3+'
    END AS special_requests,
    COUNT(*) AS bookings,
    CAST(AVG(1.0 * is_canceled) AS DECIMAL(8, 4)) AS cancel_rate,
    CAST(AVG(CASE WHEN is_canceled = 0 AND adr > 0 THEN adr END) AS DECIMAL(10, 2)) AS adr
FROM dbo.hotel_booking_db
GROUP BY
    CASE
        WHEN total_of_special_requests = 0 THEN N'0'
        WHEN total_of_special_requests = 1 THEN N'1'
        WHEN total_of_special_requests = 2 THEN N'2'
        ELSE N'3+'
    END
ORDER BY special_requests;

/* I2. Previous cancellations */
SELECT
    CASE
        WHEN previous_cancellations = 0 THEN N'Chưa từng hủy'
        WHEN previous_cancellations = 1 THEN N'Đã hủy 1 lần'
        ELSE N'Đã hủy 2+ lần'
    END AS prev_cancel_band,
    COUNT(*) AS bookings,
    CAST(AVG(1.0 * is_canceled) AS DECIMAL(8, 4)) AS cancel_rate
FROM dbo.hotel_booking_db
GROUP BY
    CASE
        WHEN previous_cancellations = 0 THEN N'Chưa từng hủy'
        WHEN previous_cancellations = 1 THEN N'Đã hủy 1 lần'
        ELSE N'Đã hủy 2+ lần'
    END
ORDER BY cancel_rate DESC;

/* I3. Direct vs Non-Direct */
SELECT
    hotel,
    CASE WHEN distribution_channel = N'Direct' THEN N'Direct' ELSE N'Non-Direct' END AS channel_group,
    COUNT(*) AS bookings,
    CAST(SUM(CASE WHEN is_canceled = 0 THEN adr * (stays_in_weekend_nights + stays_in_week_nights) ELSE 0 END) AS DECIMAL(16, 2)) AS revenue,
    CAST(AVG(1.0 * is_canceled) AS DECIMAL(8, 4)) AS cancel_rate,
    CAST(AVG(CASE WHEN is_canceled = 0 AND adr > 0 THEN adr END) AS DECIMAL(10, 2)) AS adr
FROM dbo.hotel_booking_db
GROUP BY hotel, CASE WHEN distribution_channel = N'Direct' THEN N'Direct' ELSE N'Non-Direct' END
ORDER BY hotel, channel_group;

/* I4. Weekend vs weekday — gợi ý package */
SELECT
    hotel,
    CASE
        WHEN stays_in_weekend_nights > 0 AND stays_in_week_nights = 0 THEN N'Weekend only'
        WHEN stays_in_weekend_nights = 0 AND stays_in_week_nights > 0 THEN N'Weekday only'
        ELSE N'Mixed'
    END AS stay_pattern,
    COUNT(*) AS bookings,
    CAST(AVG(1.0 * (stays_in_weekend_nights + stays_in_week_nights)) AS DECIMAL(8, 2)) AS avg_nights,
    CAST(AVG(CASE WHEN is_canceled = 0 AND adr > 0 THEN adr END) AS DECIMAL(10, 2)) AS adr,
    CAST(AVG(1.0 * is_canceled) AS DECIMAL(8, 4)) AS cancel_rate
FROM dbo.hotel_booking_db
GROUP BY hotel,
    CASE
        WHEN stays_in_weekend_nights > 0 AND stays_in_week_nights = 0 THEN N'Weekend only'
        WHEN stays_in_weekend_nights = 0 AND stays_in_week_nights > 0 THEN N'Weekday only'
        ELSE N'Mixed'
    END
ORDER BY hotel, stay_pattern;
GO
