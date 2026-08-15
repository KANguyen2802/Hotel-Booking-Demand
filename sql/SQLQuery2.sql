/* =============================================================================
   SQLQuery2.sql — Business questions trên FLAT SCHEMA (dbo.hotel_booking_db)
   Grain: 1 dòng = 1 booking. Không join dimension. Mọi query tách City vs Resort.

   BQ2 RevPAR City/Resort · BQ3 ADR×Occ headroom · BQ5 Pricing simulator
   (BQ1 / BQ4 / BQ6 portfolio → SQLQuery1.sql)

   Công thức KPI:
     revenue         = adr × (weekend + week nights) khi is_canceled = 0
     adr             = AVG(adr) WHERE is_canceled = 0 AND adr > 0
     occupancy_rate  = AVG(1 - is_canceled)
     revpar          = adr × occupancy_rate
     Season          = Peak 7–8 · Shoulder 4–6 & 9–10 · Low 11–3
   ============================================================================= */

USE [Hotel Booking Demand];
GO

SET NOCOUNT ON;
GO

/* -----------------------------------------------------------------------------
   Baseline — pivot City vs Resort theo tháng (query gốc)
   ----------------------------------------------------------------------------- */
WITH base AS (
    SELECT
        hotel,
        arrival_date_year,
        MONTH(CONVERT(date, CONCAT(arrival_date_month, ' 1, ', arrival_date_year))) AS month_num,
        is_canceled,
        adr,
        stays_in_weekend_nights + stays_in_week_nights AS total_nights
    FROM dbo.hotel_booking_db
),
monthly AS (
    SELECT
        hotel,
        arrival_date_year,
        month_num,
        CONCAT(arrival_date_year, '-', RIGHT('0' + CAST(month_num AS varchar(2)), 2)) AS year_month,
        SUM(CASE WHEN is_canceled = 0 THEN adr * total_nights ELSE 0 END) AS revenue,
        AVG(CASE WHEN is_canceled = 0 AND adr > 0 THEN adr END) AS adr,
        AVG(1.0 - is_canceled) AS occupancy_rate
    FROM base
    GROUP BY hotel, arrival_date_year, month_num
)
SELECT
    year_month,
    ROUND(MAX(CASE WHEN hotel = N'City Hotel'   THEN revenue END), 2) AS city_revenue,
    ROUND(MAX(CASE WHEN hotel = N'Resort Hotel' THEN revenue END), 2) AS resort_revenue,
    ROUND(MAX(CASE WHEN hotel = N'City Hotel'   THEN adr END), 2)     AS city_adr,
    ROUND(MAX(CASE WHEN hotel = N'Resort Hotel' THEN adr END), 2)     AS resort_adr,
    ROUND(MAX(CASE WHEN hotel = N'City Hotel'   THEN adr * occupancy_rate END), 2) AS city_revpar,
    ROUND(MAX(CASE WHEN hotel = N'Resort Hotel' THEN adr * occupancy_rate END), 2) AS resort_revpar
FROM monthly
GROUP BY year_month
ORDER BY year_month;
GO

/* =============================================================================
   BQ2 — City vs Resort khác nhau thế nào về RevPAR / ADR / Occupancy?
   City Peak harden BAR; Resort Peak HOLD, Low CUT — không cùng 1 playbook.
   ============================================================================= */

/* 2.1 Trend RevPAR / ADR / Occ theo hotel × tháng */
WITH base AS (
    SELECT
        hotel,
        arrival_date_year,
        MONTH(CONVERT(date, CONCAT(arrival_date_month, ' 1, ', arrival_date_year))) AS month_num,
        is_canceled,
        adr,
        stays_in_weekend_nights + stays_in_week_nights AS total_nights
    FROM dbo.hotel_booking_db
)
SELECT
    hotel,
    CONCAT(arrival_date_year, '-', RIGHT('0' + CAST(month_num AS varchar(2)), 2)) AS year_month,
    COUNT(*) AS total_bookings,
    CAST(AVG(CASE WHEN is_canceled = 0 AND adr > 0 THEN adr END) AS DECIMAL(10, 2)) AS adr,
    CAST(AVG(1.0 - is_canceled) AS DECIMAL(8, 4)) AS occupancy_rate,
    CAST(
        AVG(CASE WHEN is_canceled = 0 AND adr > 0 THEN adr END) * AVG(1.0 - is_canceled)
        AS DECIMAL(10, 2)
    ) AS revpar,
    CAST(SUM(CASE WHEN is_canceled = 0 THEN adr * total_nights ELSE 0 END) AS DECIMAL(16, 2)) AS total_revenue
FROM base
GROUP BY hotel, arrival_date_year, month_num
ORDER BY hotel, arrival_date_year, month_num;

/* 2.2 Phân rã MoM RevPAR: ΔADR vs ΔOccupancy
      ΔADR = Occ(t-1) × (ADR(t) − ADR(t-1))
      ΔOcc = ADR(t)   × (Occ(t) − Occ(t-1)) */
WITH base AS (
    SELECT
        hotel,
        arrival_date_year,
        MONTH(CONVERT(date, CONCAT(arrival_date_month, ' 1, ', arrival_date_year))) AS month_num,
        is_canceled,
        adr,
        stays_in_weekend_nights + stays_in_week_nights AS total_nights
    FROM dbo.hotel_booking_db
),
m AS (
    SELECT
        hotel,
        arrival_date_year,
        month_num,
        CONCAT(arrival_date_year, '-', RIGHT('0' + CAST(month_num AS varchar(2)), 2)) AS year_month,
        DATEFROMPARTS(arrival_date_year, month_num, 1) AS month_start,
        AVG(CASE WHEN is_canceled = 0 AND adr > 0 THEN adr END) AS adr,
        AVG(1.0 - is_canceled) AS occupancy_rate,
        AVG(CASE WHEN is_canceled = 0 AND adr > 0 THEN adr END) * AVG(1.0 - is_canceled) AS revpar
    FROM base
    GROUP BY hotel, arrival_date_year, month_num
),
w AS (
    SELECT
        hotel,
        year_month,
        month_start,
        adr,
        occupancy_rate,
        revpar,
        LAG(adr) OVER (PARTITION BY hotel ORDER BY month_start) AS adr_pm,
        LAG(occupancy_rate) OVER (PARTITION BY hotel ORDER BY month_start) AS occ_pm,
        LAG(revpar) OVER (PARTITION BY hotel ORDER BY month_start) AS revpar_pm
    FROM m
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
ORDER BY hotel, month_start;

/* 2.3 Heatmap mùa vụ: hotel × tháng trong năm */
WITH base AS (
    SELECT
        hotel,
        MONTH(CONVERT(date, CONCAT(arrival_date_month, ' 1, ', arrival_date_year))) AS month_num,
        is_canceled,
        adr
    FROM dbo.hotel_booking_db
)
SELECT
    hotel,
    month_num,
    DATENAME(month, DATEFROMPARTS(2000, month_num, 1)) AS month_name,
    CASE
        WHEN month_num IN (7, 8) THEN N'Peak'
        WHEN month_num IN (4, 5, 6, 9, 10) THEN N'Shoulder'
        ELSE N'Low'
    END AS season,
    COUNT(*) AS bookings,
    CAST(
        AVG(CASE WHEN is_canceled = 0 AND adr > 0 THEN adr END) * AVG(1.0 - is_canceled)
        AS DECIMAL(10, 2)
    ) AS revpar
FROM base
GROUP BY hotel, month_num
ORDER BY hotel, month_num;

/* 2.4 RevPAR theo mùa × hotel — playbook bất đối xứng */
WITH base AS (
    SELECT
        hotel,
        MONTH(CONVERT(date, CONCAT(arrival_date_month, ' 1, ', arrival_date_year))) AS month_num,
        is_canceled,
        adr,
        stays_in_weekend_nights + stays_in_week_nights AS total_nights
    FROM dbo.hotel_booking_db
),
s AS (
    SELECT
        hotel,
        CASE
            WHEN month_num IN (7, 8) THEN N'Peak'
            WHEN month_num IN (4, 5, 6, 9, 10) THEN N'Shoulder'
            ELSE N'Low'
        END AS season,
        is_canceled,
        adr,
        total_nights
    FROM base
)
SELECT
    hotel,
    season,
    COUNT(*) AS bookings,
    CAST(AVG(CASE WHEN is_canceled = 0 AND adr > 0 THEN adr END) AS DECIMAL(10, 2)) AS adr,
    CAST(AVG(1.0 - is_canceled) AS DECIMAL(8, 4)) AS occupancy_rate,
    CAST(
        AVG(CASE WHEN is_canceled = 0 AND adr > 0 THEN adr END) * AVG(1.0 - is_canceled)
        AS DECIMAL(10, 2)
    ) AS revpar,
    CASE
        WHEN hotel = N'City Hotel' AND season = N'Peak'
            THEN N'RAISE/PROTECT BAR trong band — City Peak kém co giãn'
        WHEN hotel = N'Resort Hotel' AND season = N'Peak'
            THEN N'HOLD — không shock +ADR Resort Peak (co giãn cao)'
        WHEN hotel = N'Resort Hotel' AND season = N'Low'
            THEN N'CUT ~−5% ADR — kích cầu Low season Resort'
        ELSE N'HOLD / tinh chỉnh nhẹ trong band'
    END AS playbook_goi_y
FROM s
GROUP BY hotel, season
ORDER BY hotel, CASE season WHEN N'Peak' THEN 1 WHEN N'Shoulder' THEN 2 ELSE 3 END;

/* 2.5 Tháng gần nhất — so sánh 2 hotel */
WITH base AS (
    SELECT
        hotel,
        arrival_date_year,
        MONTH(CONVERT(date, CONCAT(arrival_date_month, ' 1, ', arrival_date_year))) AS month_num,
        is_canceled,
        adr,
        stays_in_weekend_nights + stays_in_week_nights AS total_nights
    FROM dbo.hotel_booking_db
),
m AS (
    SELECT
        hotel,
        CONCAT(arrival_date_year, '-', RIGHT('0' + CAST(month_num AS varchar(2)), 2)) AS year_month,
        AVG(CASE WHEN is_canceled = 0 AND adr > 0 THEN adr END) AS adr,
        AVG(1.0 - is_canceled) AS occupancy_rate,
        SUM(CASE WHEN is_canceled = 0 THEN adr * total_nights ELSE 0 END) AS total_revenue
    FROM base
    GROUP BY hotel, arrival_date_year, month_num
),
latest AS (
    SELECT MAX(year_month) AS year_month FROM m
)
SELECT
    m.hotel,
    m.year_month,
    CAST(m.adr AS DECIMAL(10, 2)) AS adr,
    CAST(m.occupancy_rate AS DECIMAL(8, 4)) AS occupancy_rate,
    CAST(m.adr * m.occupancy_rate AS DECIMAL(10, 2)) AS revpar,
    CAST(m.total_revenue AS DECIMAL(16, 2)) AS total_revenue
FROM m
INNER JOIN latest AS l ON l.year_month = m.year_month
ORDER BY revpar DESC;

/* 2.6 YoY RevPAR (cùng tháng năm trước) */
WITH base AS (
    SELECT
        hotel,
        arrival_date_year,
        MONTH(CONVERT(date, CONCAT(arrival_date_month, ' 1, ', arrival_date_year))) AS month_num,
        is_canceled,
        adr
    FROM dbo.hotel_booking_db
),
m AS (
    SELECT
        hotel,
        arrival_date_year AS [year],
        month_num,
        CONCAT(arrival_date_year, '-', RIGHT('0' + CAST(month_num AS varchar(2)), 2)) AS year_month,
        AVG(CASE WHEN is_canceled = 0 AND adr > 0 THEN adr END) * AVG(1.0 - is_canceled) AS revpar
    FROM base
    GROUP BY hotel, arrival_date_year, month_num
)
SELECT
    cur.hotel,
    cur.year_month,
    CAST(cur.revpar AS DECIMAL(10, 2)) AS revpar,
    CAST(py.revpar AS DECIMAL(10, 2)) AS revpar_py,
    CAST((cur.revpar - py.revpar) * 100.0 / NULLIF(py.revpar, 0) AS DECIMAL(8, 2)) AS revpar_yoy_pct
FROM m AS cur
LEFT JOIN m AS py
    ON py.hotel = cur.hotel
   AND py.month_num = cur.month_num
   AND py.[year] = cur.[year] - 1
ORDER BY cur.hotel, cur.year_month;
GO

/* =============================================================================
   BQ3 — Còn dư địa tăng giá mà không mất occupancy không?
   Low ADR + High Occ = headroom; High ADR + Low Occ = quá giá / hủy.
   ============================================================================= */

/* 3.1 Quadrant ADR × Occupancy theo ngày */
WITH daily AS (
    SELECT
        hotel,
        DATEFROMPARTS(
            arrival_date_year,
            MONTH(CONVERT(date, CONCAT(arrival_date_month, ' 1, ', arrival_date_year))),
            arrival_date_day_of_month
        ) AS arrival_date,
        COUNT(*) AS bookings,
        AVG(CASE WHEN is_canceled = 0 AND adr > 0 THEN adr END) AS adr,
        AVG(1.0 - is_canceled) AS occupancy_rate
    FROM dbo.hotel_booking_db
    GROUP BY
        hotel,
        arrival_date_year,
        arrival_date_month,
        arrival_date_day_of_month
),
stats AS (
    SELECT AVG(adr) AS adr_avg, AVG(occupancy_rate) AS occ_avg
    FROM daily
    WHERE adr IS NOT NULL
)
SELECT
    d.hotel,
    d.arrival_date,
    CAST(d.adr AS DECIMAL(10, 2)) AS adr,
    CAST(d.occupancy_rate AS DECIMAL(8, 4)) AS occupancy_rate,
    CAST(d.adr * d.occupancy_rate AS DECIMAL(10, 2)) AS revpar,
    d.bookings,
    CASE
        WHEN d.adr >= s.adr_avg AND d.occupancy_rate >= s.occ_avg THEN N'High ADR + High Occ — giữ / RAISE nhẹ'
        WHEN d.adr <  s.adr_avg AND d.occupancy_rate >= s.occ_avg THEN N'Low ADR + High Occ — còn dư địa tăng giá'
        WHEN d.adr >= s.adr_avg AND d.occupancy_rate <  s.occ_avg THEN N'High ADR + Low Occ — xem lại giá / hủy'
        ELSE N'Low ADR + Low Occ — kích cầu (promo / CUT)'
    END AS quadrant
FROM daily AS d
CROSS JOIN stats AS s
WHERE d.adr IS NOT NULL
ORDER BY revpar DESC;

/* 3.2 Tóm tắt quadrant — tỷ trọng ngày */
WITH daily AS (
    SELECT
        hotel,
        AVG(CASE WHEN is_canceled = 0 AND adr > 0 THEN adr END) AS adr,
        AVG(1.0 - is_canceled) AS occupancy_rate
    FROM dbo.hotel_booking_db
    GROUP BY
        hotel,
        arrival_date_year,
        arrival_date_month,
        arrival_date_day_of_month
),
stats AS (
    SELECT AVG(adr) AS adr_avg, AVG(occupancy_rate) AS occ_avg
    FROM daily
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
        d.adr * d.occupancy_rate AS revpar
    FROM daily AS d
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

/* 3.3 RevPAR theo phòng ĐẶT (reserved) */
SELECT
    reserved_room_type AS room_type,
    COUNT(*) AS bookings,
    SUM(CASE WHEN is_canceled = 0 THEN stays_in_weekend_nights + stays_in_week_nights ELSE 0 END) AS room_nights_sold,
    CAST(SUM(CASE WHEN is_canceled = 0 THEN adr * (stays_in_weekend_nights + stays_in_week_nights) ELSE 0 END) AS DECIMAL(16, 2)) AS revenue,
    CAST(
        SUM(CASE WHEN is_canceled = 0 THEN adr * (stays_in_weekend_nights + stays_in_week_nights) ELSE 0 END)
        / NULLIF(SUM(CASE WHEN is_canceled = 0 THEN stays_in_weekend_nights + stays_in_week_nights ELSE 0 END), 0)
        AS DECIMAL(10, 2)
    ) AS revpar_reserved
FROM dbo.hotel_booking_db
GROUP BY reserved_room_type
ORDER BY reserved_room_type;

/* 3.4 RevPAR theo phòng ĐƯỢC GÁN (assigned) */
SELECT
    assigned_room_type AS room_type,
    COUNT(*) AS bookings,
    SUM(CASE WHEN is_canceled = 0 THEN stays_in_weekend_nights + stays_in_week_nights ELSE 0 END) AS room_nights_sold,
    CAST(SUM(CASE WHEN is_canceled = 0 THEN adr * (stays_in_weekend_nights + stays_in_week_nights) ELSE 0 END) AS DECIMAL(16, 2)) AS revenue,
    CAST(
        SUM(CASE WHEN is_canceled = 0 THEN adr * (stays_in_weekend_nights + stays_in_week_nights) ELSE 0 END)
        / NULLIF(SUM(CASE WHEN is_canceled = 0 THEN stays_in_weekend_nights + stays_in_week_nights ELSE 0 END), 0)
        AS DECIMAL(10, 2)
    ) AS revpar_assigned
FROM dbo.hotel_booking_db
GROUP BY assigned_room_type
ORDER BY assigned_room_type;

/* 3.5 Tỷ lệ bị đổi phòng (reserved ≠ assigned) */
SELECT
    hotel,
    COUNT(*) AS bookings,
    SUM(CASE WHEN reserved_room_type <> assigned_room_type THEN 1 ELSE 0 END) AS room_changed,
    CAST(AVG(CASE WHEN reserved_room_type <> assigned_room_type THEN 1.0 ELSE 0.0 END) AS DECIMAL(8, 4)) AS mismatch_rate,
    CAST(AVG(1.0 * is_canceled) AS DECIMAL(8, 4)) AS cancel_rate
FROM dbo.hotel_booking_db
GROUP BY hotel;
GO

/* =============================================================================
   BQ5 — RevPAR/doanh thu đổi thế nào nếu chỉnh ADR, Occ, cancel rate?
   Mặc định giống HTML: ADR +5%, Occ −2pp, Cancel 0pp, elasticity Off.
   Áp dụng TỪNG DÒNG hotel×tháng rồi mới gộp.
   Đổi 3 biến @adr_change_pct / @occ_change_pp / @cancel_change_pp rồi chạy cả khối.
   ============================================================================= */

DECLARE @adr_change_pct     DECIMAL(9, 4) = 5;
DECLARE @occ_change_pp      DECIMAL(9, 4) = -2;
DECLARE @cancel_change_pp   DECIMAL(9, 4) = 0;
DECLARE @elasticity_on      BIT           = 0;

DECLARE @adr_mult DECIMAL(12, 6) = 1 + @adr_change_pct / 100.0;
DECLARE @occ_pp   DECIMAL(12, 6) = @occ_change_pp / 100.0
    + CASE WHEN @elasticity_on = 1 THEN (@adr_change_pct / 100.0) * -0.25 ELSE 0 END;
DECLARE @cx_pp    DECIMAL(12, 6) = @cancel_change_pp / 100.0;

;WITH base AS (
    SELECT
        hotel,
        arrival_date_year,
        MONTH(CONVERT(date, CONCAT(arrival_date_month, ' 1, ', arrival_date_year))) AS month_num,
        is_canceled,
        adr,
        stays_in_weekend_nights + stays_in_week_nights AS total_nights
    FROM dbo.hotel_booking_db
),
monthly AS (
    SELECT
        hotel,
        CONCAT(arrival_date_year, '-', RIGHT('0' + CAST(month_num AS varchar(2)), 2)) AS year_month,
        DATEFROMPARTS(arrival_date_year, month_num, 1) AS month_start,
        COUNT(*) AS total_bookings,
        SUM(CASE WHEN is_canceled = 0 THEN adr * total_nights ELSE 0 END) AS total_revenue,
        AVG(CASE WHEN is_canceled = 0 AND adr > 0 THEN adr END) AS adr,
        AVG(1.0 - is_canceled) AS occupancy_rate
    FROM base
    GROUP BY hotel, arrival_date_year, month_num
),
sim AS (
    SELECT
        hotel,
        year_month,
        month_start,
        total_bookings,
        total_revenue,
        adr * occupancy_rate AS revpar_base,
        adr * @adr_mult AS adr_sim,
        CASE
            WHEN v.occ_sim < 0.05 THEN 0.05
            WHEN v.occ_sim > 0.99 THEN 0.99
            ELSE v.occ_sim
        END AS occ_sim
    FROM monthly
    CROSS APPLY (
        SELECT
            CASE
                WHEN x.occ_step1 < 0.05 THEN 0.05
                WHEN x.occ_step1 > 0.99 THEN 0.99
                ELSE x.occ_step1
            END - @cx_pp * 0.5 AS occ_sim
        FROM (SELECT occupancy_rate + @occ_pp AS occ_step1) AS x
    ) AS v
)
SELECT
    N'Portfolio' AS grain,
    CAST(SUM(revpar_base * total_bookings) / NULLIF(SUM(total_bookings), 0) AS DECIMAL(10, 2)) AS revpar_baseline,
    CAST(SUM(adr_sim * occ_sim * total_bookings) / NULLIF(SUM(total_bookings), 0) AS DECIMAL(10, 2)) AS revpar_scenario,
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
        SUM(total_revenue * CASE WHEN revpar_base = 0 THEN 1 ELSE (adr_sim * occ_sim) / revpar_base END)
        AS DECIMAL(16, 2)
    ) AS revenue_scenario
FROM sim;

/* 5.2 Baseline vs scenario theo tháng */
;WITH base AS (
    SELECT
        hotel,
        arrival_date_year,
        MONTH(CONVERT(date, CONCAT(arrival_date_month, ' 1, ', arrival_date_year))) AS month_num,
        is_canceled,
        adr,
        stays_in_weekend_nights + stays_in_week_nights AS total_nights
    FROM dbo.hotel_booking_db
),
monthly AS (
    SELECT
        CONCAT(arrival_date_year, '-', RIGHT('0' + CAST(month_num AS varchar(2)), 2)) AS year_month,
        DATEFROMPARTS(arrival_date_year, month_num, 1) AS month_start,
        COUNT(*) AS total_bookings,
        AVG(CASE WHEN is_canceled = 0 AND adr > 0 THEN adr END) AS adr,
        AVG(1.0 - is_canceled) AS occupancy_rate
    FROM base
    GROUP BY hotel, arrival_date_year, month_num
),
sim AS (
    SELECT
        year_month,
        month_start,
        total_bookings,
        adr * occupancy_rate AS revpar_base,
        adr * (1 + @adr_change_pct / 100.0) AS adr_sim,
        CASE
            WHEN occ2 < 0.05 THEN 0.05
            WHEN occ2 > 0.99 THEN 0.99
            ELSE occ2
        END AS occ_sim
    FROM monthly
    CROSS APPLY (
        SELECT
            CASE
                WHEN occ1 < 0.05 THEN 0.05
                WHEN occ1 > 0.99 THEN 0.99
                ELSE occ1
            END - (@cancel_change_pp / 100.0) * 0.5 AS occ2
        FROM (
            SELECT occupancy_rate
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
GROUP BY year_month, month_start
ORDER BY month_start;

/* 5.3 Sensitivity: Baseline / ADR only / Occ only / Combined */
;WITH base AS (
    SELECT
        hotel,
        arrival_date_year,
        MONTH(CONVERT(date, CONCAT(arrival_date_month, ' 1, ', arrival_date_year))) AS month_num,
        is_canceled,
        adr
    FROM dbo.hotel_booking_db
),
monthly AS (
    SELECT
        COUNT(*) AS total_bookings,
        AVG(CASE WHEN is_canceled = 0 AND adr > 0 THEN adr END) AS adr,
        AVG(1.0 - is_canceled) AS occupancy_rate
    FROM base
    GROUP BY hotel, arrival_date_year, month_num
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
            (m.adr * (1 + sc.adr_pct / 100.0))
            * CASE
                WHEN m.occupancy_rate + sc.occ_pp / 100.0 < 0.05 THEN 0.05
                WHEN m.occupancy_rate + sc.occ_pp / 100.0 > 0.99 THEN 0.99
                ELSE m.occupancy_rate + sc.occ_pp / 100.0
              END
            * m.total_bookings
        ) / NULLIF(SUM(m.total_bookings), 0)
        AS DECIMAL(10, 2)
    ) AS revpar
FROM monthly AS m
CROSS JOIN scen AS sc
GROUP BY sc.scenario
ORDER BY CASE sc.scenario
    WHEN N'Baseline' THEN 1 WHEN N'ADR only' THEN 2
    WHEN N'Occ only' THEN 3 ELSE 4 END;
GO
