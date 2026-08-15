/* =============================================================================
   02_populate_star_schema.sql
   Nạp dimension + fact từ dbo.hotel_booking_db (bảng nguồn đã import).

   Công thức KPI (khớp notebook 01 / SQLQuery2 / dashboard):
     occupancy_rate = AVG(1 - is_canceled)           = successful / total
     adr            = AVG(adr) WHERE is_canceled = 0 AND adr > 0
     revpar         = adr × occupancy_rate
     revenue        = adr × total_nights  (chỉ stay thành công)

   Chạy SAU 01_create_star_schema.sql.
   ============================================================================= */

USE [Hotel Booking Demand];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* Tắt FK khi nạp hàng loạt, bật lại + kiểm tra ở cuối */
IF OBJECT_ID(N'dbo.hotel_booking_db', N'U') IS NULL
    THROW 50001, N'Không tìm thấy dbo.hotel_booking_db. Import CSV nguồn trước khi chạy 02.', 1;
IF OBJECT_ID(N'dbo.Fact_Booking', N'U') IS NULL
    THROW 50002, N'Chưa có star schema. Chạy 01_create_star_schema.sql trước.', 1;

ALTER TABLE dbo.Fact_Booking        NOCHECK CONSTRAINT ALL;
ALTER TABLE dbo.Fact_RevPAR_Monthly NOCHECK CONSTRAINT ALL;
ALTER TABLE dbo.Fact_Daily_AdrOcc   NOCHECK CONSTRAINT ALL;

TRUNCATE TABLE dbo.Fact_Daily_AdrOcc;
TRUNCATE TABLE dbo.Fact_RevPAR_Monthly;
DELETE FROM dbo.Fact_Booking;
DELETE FROM dbo.Dim_RoomType;
DELETE FROM dbo.Dim_CustomerType;
DELETE FROM dbo.Dim_Channel;
DELETE FROM dbo.Dim_Segment;
DELETE FROM dbo.Dim_Country;
DELETE FROM dbo.Dim_Deposit;
DELETE FROM dbo.Dim_Status;
DELETE FROM dbo.Dim_Hotel;
DELETE FROM dbo.Dim_Date;

DBCC CHECKIDENT (N'dbo.Fact_Booking', RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT (N'dbo.Dim_Hotel', RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT (N'dbo.Dim_Status', RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT (N'dbo.Dim_Deposit', RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT (N'dbo.Dim_Country', RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT (N'dbo.Dim_Segment', RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT (N'dbo.Dim_Channel', RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT (N'dbo.Dim_CustomerType', RESEED, 0) WITH NO_INFOMSGS;
DBCC CHECKIDENT (N'dbo.Dim_RoomType', RESEED, 0) WITH NO_INFOMSGS;
GO

/* ----- Staging chuẩn hóa từ nguồn ----- */
IF OBJECT_ID(N'tempdb..#src') IS NOT NULL DROP TABLE #src;

SELECT
    ISNULL(NULLIF(LTRIM(RTRIM(s.hotel)), N''), N'Unknown') AS hotel,
    CAST(ISNULL(s.is_canceled, 0) AS INT) AS is_canceled,
    CAST(ISNULL(s.lead_time, 0) AS INT) AS lead_time,
    CAST(s.arrival_date_year AS INT) AS arrival_date_year,
    LTRIM(RTRIM(s.arrival_date_month)) AS arrival_date_month,
    CAST(
        CASE LTRIM(RTRIM(s.arrival_date_month))
            WHEN N'January'   THEN 1  WHEN N'February' THEN 2
            WHEN N'March'     THEN 3  WHEN N'April'    THEN 4
            WHEN N'May'       THEN 5  WHEN N'June'     THEN 6
            WHEN N'July'      THEN 7  WHEN N'August'   THEN 8
            WHEN N'September' THEN 9  WHEN N'October'  THEN 10
            WHEN N'November'  THEN 11 WHEN N'December' THEN 12
        END AS TINYINT
    ) AS arrival_month_number,
    CAST(ISNULL(s.arrival_date_week_number, 0) AS TINYINT) AS arrival_date_week_number,
    CAST(s.arrival_date_day_of_month AS TINYINT) AS arrival_date_day_of_month,
    CAST(ISNULL(s.stays_in_weekend_nights, 0) AS INT) AS stays_in_weekend_nights,
    CAST(ISNULL(s.stays_in_week_nights, 0) AS INT) AS stays_in_week_nights,
    CAST(ISNULL(s.stays_in_weekend_nights, 0) AS INT)
        + CAST(ISNULL(s.stays_in_week_nights, 0) AS INT) AS total_nights,
    CAST(ISNULL(s.adults, 0) AS INT) AS adults,
    CAST(ISNULL(s.children, 0) AS INT) AS children,
    CAST(ISNULL(s.babies, 0) AS INT) AS babies,
    ISNULL(NULLIF(LTRIM(RTRIM(s.meal)), N''), N'Unknown') AS meal,
    NULLIF(LTRIM(RTRIM(s.country)), N'') AS country,
    ISNULL(NULLIF(LTRIM(RTRIM(s.market_segment)), N''), N'Unknown') AS market_segment,
    ISNULL(NULLIF(LTRIM(RTRIM(s.distribution_channel)), N''), N'Unknown') AS distribution_channel,
    CAST(ISNULL(s.is_repeated_guest, 0) AS INT) AS is_repeated_guest,
    CAST(ISNULL(s.previous_cancellations, 0) AS INT) AS previous_cancellations,
    CAST(ISNULL(s.previous_bookings_not_canceled, 0) AS INT) AS previous_bookings_not_canceled,
    ISNULL(NULLIF(LTRIM(RTRIM(s.reserved_room_type)), N''), N'?') AS reserved_room_type,
    ISNULL(NULLIF(LTRIM(RTRIM(s.assigned_room_type)), N''), N'?') AS assigned_room_type,
    CAST(ISNULL(s.booking_changes, 0) AS INT) AS booking_changes,
    ISNULL(NULLIF(LTRIM(RTRIM(s.deposit_type)), N''), N'No Deposit') AS deposit_type,
    NULLIF(LTRIM(RTRIM(CAST(s.agent AS NVARCHAR(20)))), N'') AS agent,
    CAST(ISNULL(s.days_in_waiting_list, 0) AS INT) AS days_in_waiting_list,
    ISNULL(NULLIF(LTRIM(RTRIM(s.customer_type)), N''), N'Unknown') AS customer_type,
    CAST(ISNULL(s.adr, 0) AS DECIMAL(12, 4)) AS adr,
    CAST(ISNULL(s.required_car_parking_spaces, 0) AS INT) AS required_car_parking_spaces,
    CAST(ISNULL(s.total_of_special_requests, 0) AS INT) AS total_of_special_requests,
    ISNULL(NULLIF(LTRIM(RTRIM(s.reservation_status)), N''), N'Unknown') AS reservation_status,
    COALESCE(
        TRY_CONVERT(date, s.reservation_status_date, 103),
        TRY_CONVERT(date, s.reservation_status_date, 101),
        TRY_CONVERT(date, s.reservation_status_date)
    ) AS reservation_status_date
INTO #src
FROM dbo.hotel_booking_db AS s;

ALTER TABLE #src ADD arrival_date DATE NULL;
ALTER TABLE #src ADD year_month CHAR(7) NULL;
ALTER TABLE #src ADD day_of_week NVARCHAR(20) NULL;
ALTER TABLE #src ADD revenue DECIMAL(14, 4) NULL;

UPDATE #src
SET
    arrival_date = DATEFROMPARTS(arrival_date_year, arrival_month_number, arrival_date_day_of_month),
    year_month = CONCAT(
        arrival_date_year, N'-',
        RIGHT(N'0' + CAST(arrival_month_number AS VARCHAR(2)), 2)
    ),
    day_of_week = DATENAME(weekday, DATEFROMPARTS(arrival_date_year, arrival_month_number, arrival_date_day_of_month)),
    revenue = CASE
        WHEN is_canceled = 0
            THEN CAST(ISNULL(adr, 0) AS DECIMAL(14, 4)) * CAST(ISNULL(total_nights, 0) AS DECIMAL(14, 4))
        ELSE 0
    END;

CREATE CLUSTERED INDEX IX_src_hotel_date ON #src (hotel, arrival_date);
GO

/* ----- Dim_Hotel ----- */
INSERT INTO dbo.Dim_Hotel (hotel_name)
SELECT DISTINCT hotel
FROM #src
WHERE hotel IS NOT NULL
ORDER BY hotel;

/* ----- Dim_Date: lịch đủ ngày 2015-07-01 → 2017-09-30 (guide Power BI)
         + mọi arrival_date / month_start thực tế nếu lệch ----- */
DECLARE @MinDate date = '2015-07-01';
DECLARE @MaxDate date = '2017-09-30';

SELECT
    @MinDate = CASE WHEN MIN(arrival_date) < @MinDate THEN MIN(arrival_date) ELSE @MinDate END,
    @MaxDate = CASE WHEN MAX(arrival_date) > @MaxDate THEN MAX(arrival_date) ELSE @MaxDate END
FROM #src;

;WITH n AS (
    SELECT 0 AS i
    UNION ALL
    SELECT i + 1 FROM n WHERE i < DATEDIFF(day, @MinDate, @MaxDate)
),
cal AS (
    SELECT DATEADD(day, i, @MinDate) AS full_date
    FROM n
)
INSERT INTO dbo.Dim_Date (
    date_key, full_date, [year], month_number, month_name, year_month,
    [quarter], week_number, day_of_month, day_of_week, season
)
SELECT
    YEAR(c.full_date) * 10000 + MONTH(c.full_date) * 100 + DAY(c.full_date),
    c.full_date,
    YEAR(c.full_date),
    MONTH(c.full_date),
    DATENAME(month, c.full_date),
    CONCAT(YEAR(c.full_date), N'-', RIGHT(N'0' + CAST(MONTH(c.full_date) AS VARCHAR(2)), 2)),
    CONCAT(N'Q', DATEPART(quarter, c.full_date)),
    DATEPART(iso_week, c.full_date),
    DAY(c.full_date),
    DATENAME(weekday, c.full_date),
    CASE
        WHEN MONTH(c.full_date) IN (7, 8) THEN N'Peak'
        WHEN MONTH(c.full_date) IN (4, 5, 6, 9, 10) THEN N'Shoulder'
        ELSE N'Low'
    END
FROM cal AS c
OPTION (MAXRECURSION 0);

/* ----- Dim mô tả ----- */
INSERT INTO dbo.Dim_Status (reservation_status)
SELECT DISTINCT reservation_status FROM #src WHERE reservation_status IS NOT NULL
ORDER BY reservation_status;

INSERT INTO dbo.Dim_Deposit (deposit_type)
SELECT DISTINCT deposit_type FROM #src WHERE deposit_type IS NOT NULL
ORDER BY deposit_type;

INSERT INTO dbo.Dim_Country (country_code)
SELECT DISTINCT country FROM #src WHERE country IS NOT NULL
ORDER BY country;

INSERT INTO dbo.Dim_Segment (market_segment)
SELECT DISTINCT market_segment FROM #src WHERE market_segment IS NOT NULL
ORDER BY market_segment;

INSERT INTO dbo.Dim_Channel (distribution_channel)
SELECT DISTINCT distribution_channel FROM #src WHERE distribution_channel IS NOT NULL
ORDER BY distribution_channel;

INSERT INTO dbo.Dim_CustomerType (customer_type)
SELECT DISTINCT customer_type FROM #src WHERE customer_type IS NOT NULL
ORDER BY customer_type;

INSERT INTO dbo.Dim_RoomType (room_type)
SELECT room_type
FROM (
    SELECT reserved_room_type AS room_type FROM #src
    UNION
    SELECT assigned_room_type FROM #src
) AS u
WHERE room_type IS NOT NULL
ORDER BY room_type;
GO

/* ----- Fact_Booking ----- */
INSERT INTO dbo.Fact_Booking (
    hotel, arrival_date, arrival_date_year, arrival_date_month, arrival_month_number,
    year_month, arrival_date_week_number, arrival_date_day_of_month, day_of_week,
    country, market_segment, distribution_channel, customer_type, is_repeated_guest,
    reserved_room_type, assigned_room_type, meal, deposit_type, reservation_status, agent,
    is_canceled, lead_time, stays_in_weekend_nights, stays_in_week_nights, total_nights,
    adults, children, babies, previous_cancellations, previous_bookings_not_canceled,
    booking_changes, days_in_waiting_list, required_car_parking_spaces,
    total_of_special_requests, adr, revenue, reservation_status_date
)
SELECT
    hotel, arrival_date, arrival_date_year, arrival_date_month, arrival_month_number,
    year_month, arrival_date_week_number, arrival_date_day_of_month, day_of_week,
    country, market_segment, distribution_channel, customer_type, is_repeated_guest,
    reserved_room_type, assigned_room_type, meal, deposit_type, reservation_status, agent,
    is_canceled, lead_time, stays_in_weekend_nights, stays_in_week_nights, total_nights,
    adults, children, babies, previous_cancellations, previous_bookings_not_canceled,
    booking_changes, days_in_waiting_list, required_car_parking_spaces,
    total_of_special_requests, adr, ISNULL(revenue, 0), reservation_status_date
FROM #src
WHERE arrival_date IS NOT NULL
ORDER BY arrival_date, hotel;
GO

/* ----- Fact_RevPAR_Monthly (grain: hotel × year_month) ----- */
INSERT INTO dbo.Fact_RevPAR_Monthly (
    hotel, year_month, [year], month_number, month_start_date,
    total_bookings, successful_bookings, canceled_bookings,
    occupancy_rate, adr, revpar, total_revenue, avg_lead_time, avg_total_nights
)
SELECT
    s.hotel,
    s.year_month,
    s.arrival_date_year,
    s.arrival_month_number,
    DATEFROMPARTS(s.arrival_date_year, s.arrival_month_number, 1),
    COUNT(*) AS total_bookings,
    SUM(CASE WHEN s.is_canceled = 0 THEN 1 ELSE 0 END) AS successful_bookings,
    SUM(CASE WHEN s.is_canceled = 1 THEN 1 ELSE 0 END) AS canceled_bookings,
    CAST(AVG(CAST(1.0 - s.is_canceled AS DECIMAL(12, 8))) AS DECIMAL(12, 8)) AS occupancy_rate,
    CAST(ISNULL(AVG(CASE WHEN s.is_canceled = 0 AND s.adr > 0 THEN s.adr END), 0) AS DECIMAL(12, 4)) AS adr,
    CAST(
        ISNULL(AVG(CASE WHEN s.is_canceled = 0 AND s.adr > 0 THEN s.adr END), 0)
        * AVG(CAST(1.0 - s.is_canceled AS DECIMAL(18, 8)))
        AS DECIMAL(12, 4)
    ) AS revpar,
    CAST(ISNULL(SUM(s.revenue), 0) AS DECIMAL(16, 4)) AS total_revenue,
    CAST(AVG(CAST(s.lead_time AS DECIMAL(18, 4))) AS DECIMAL(12, 4)) AS avg_lead_time,
    CAST(
        AVG(CASE WHEN s.is_canceled = 0 THEN CAST(s.total_nights AS DECIMAL(18, 4)) END)
        AS DECIMAL(12, 4)
    ) AS avg_total_nights
FROM #src AS s
GROUP BY s.hotel, s.year_month, s.arrival_date_year, s.arrival_month_number;
GO

/* ----- Fact_Daily_AdrOcc (grain: hotel × ngày) — scatter ADR × Occ ----- */
INSERT INTO dbo.Fact_Daily_AdrOcc (
    hotel, arrival_date, bookings, canceled, successful,
    occupancy_rate, adr, room_nights_sold, revenue, revpar
)
SELECT
    s.hotel,
    s.arrival_date,
    COUNT(*) AS bookings,
    SUM(CASE WHEN s.is_canceled = 1 THEN 1 ELSE 0 END) AS canceled,
    SUM(CASE WHEN s.is_canceled = 0 THEN 1 ELSE 0 END) AS successful,
    CAST(AVG(CAST(1.0 - s.is_canceled AS DECIMAL(12, 8))) AS DECIMAL(12, 8)) AS occupancy_rate,
    CAST(AVG(CASE WHEN s.is_canceled = 0 AND s.adr > 0 THEN s.adr END) AS DECIMAL(12, 4)) AS adr,
    SUM(CASE WHEN s.is_canceled = 0 THEN s.total_nights ELSE 0 END) AS room_nights_sold,
    CAST(SUM(s.revenue) AS DECIMAL(16, 4)) AS revenue,
    CAST(
        AVG(CASE WHEN s.is_canceled = 0 AND s.adr > 0 THEN s.adr END)
        * AVG(CAST(1.0 - s.is_canceled AS DECIMAL(18, 8)))
        AS DECIMAL(12, 4)
    ) AS revpar
FROM #src AS s
GROUP BY s.hotel, s.arrival_date;
GO

/* Bật lại + kiểm tra FK */
ALTER TABLE dbo.Fact_Booking        WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE dbo.Fact_RevPAR_Monthly WITH CHECK CHECK CONSTRAINT ALL;
ALTER TABLE dbo.Fact_Daily_AdrOcc   WITH CHECK CHECK CONSTRAINT ALL;
GO

/* ----- Kiểm tra nạp ----- */
SELECT N'Dim_Hotel' AS [table_name], COUNT(*) AS n FROM dbo.Dim_Hotel
UNION ALL SELECT N'Dim_Date', COUNT(*) FROM dbo.Dim_Date
UNION ALL SELECT N'Dim_Status', COUNT(*) FROM dbo.Dim_Status
UNION ALL SELECT N'Dim_Deposit', COUNT(*) FROM dbo.Dim_Deposit
UNION ALL SELECT N'Dim_Country', COUNT(*) FROM dbo.Dim_Country
UNION ALL SELECT N'Dim_Segment', COUNT(*) FROM dbo.Dim_Segment
UNION ALL SELECT N'Dim_Channel', COUNT(*) FROM dbo.Dim_Channel
UNION ALL SELECT N'Dim_CustomerType', COUNT(*) FROM dbo.Dim_CustomerType
UNION ALL SELECT N'Dim_RoomType', COUNT(*) FROM dbo.Dim_RoomType
UNION ALL SELECT N'Fact_Booking', COUNT(*) FROM dbo.Fact_Booking
UNION ALL SELECT N'Fact_RevPAR_Monthly', COUNT(*) FROM dbo.Fact_RevPAR_Monthly
UNION ALL SELECT N'Fact_Daily_AdrOcc', COUNT(*) FROM dbo.Fact_Daily_AdrOcc
ORDER BY [table_name];

/* KPI tổng — đối chiếu dashboard Overview */
SELECT
    COUNT(*) AS total_bookings,
    SUM(CASE WHEN is_canceled = 0 THEN 1 ELSE 0 END) AS successful_bookings,
    CAST(AVG(CAST(1.0 - is_canceled AS DECIMAL(12, 6))) AS DECIMAL(8, 4)) AS occupancy_rate,
    CAST(AVG(CASE WHEN is_canceled = 0 AND adr > 0 THEN adr END) AS DECIMAL(10, 2)) AS adr,
    CAST(
        AVG(CASE WHEN is_canceled = 0 AND adr > 0 THEN adr END)
        * AVG(CAST(1.0 - is_canceled AS DECIMAL(18, 8)))
        AS DECIMAL(10, 2)
    ) AS revpar,
    CAST(SUM(revenue) AS DECIMAL(16, 2)) AS total_revenue,
    CAST(AVG(CAST(is_canceled AS DECIMAL(12, 6))) AS DECIMAL(8, 4)) AS cancel_rate
FROM dbo.Fact_Booking;

/* Catalog quan hệ — đối chiếu 14 FK với dashboard */
SELECT
    fk.name AS fk_name,
    OBJECT_NAME(fk.parent_object_id) AS from_table,
    COL_NAME(fc.parent_object_id, fc.parent_column_id) AS from_column,
    OBJECT_NAME(fk.referenced_object_id) AS to_table,
    COL_NAME(fc.referenced_object_id, fc.referenced_column_id) AS to_column,
    fk.delete_referential_action_desc AS on_delete
FROM sys.foreign_keys AS fk
INNER JOIN sys.foreign_key_columns AS fc
    ON fc.constraint_object_id = fk.object_id
WHERE OBJECT_SCHEMA_NAME(fk.parent_object_id) = N'dbo'
  AND OBJECT_NAME(fk.parent_object_id) LIKE N'Fact_%'
ORDER BY from_table, fk_name;

PRINT N'Đã nạp star schema từ hotel_booking_db.';
GO
