/* =============================================================================
   01_create_star_schema.sql
   Hotel Booking Demand — DDL star schema (khớp dashboard Power BI / HTML)

   Chạy file này TRƯỚC 02_populate_star_schema.sql.

   Sơ đồ (snowflake nhẹ — 2 fact dùng chung Dim_Hotel + Dim_Date):

                    Dim_Date
                   /        \
                  1          1
                 /            \
   Fact_RevPAR_Monthly      Fact_Booking  *── Dim_Hotel
   (hotel × tháng)          (1 dòng/booking)
                                  *── Dim_Segment
                                  *── Dim_Channel
                                  *── Dim_Deposit
                                  *── Dim_Status
                                  *── Dim_Country
                                  *── Dim_CustomerType
                                  *── Dim_RoomType  (role-playing:
                                       reserved = active,
                                       assigned = cùng bảng, join khi cần)

   Fact_Daily_AdrOcc (hotel × ngày) — phục vụ scatter ADR × Occupancy.

   ============================================================================= */

USE [Hotel Booking Demand];
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

/* ----- Xóa theo thứ tự con → cha ----- */
IF OBJECT_ID(N'dbo.Fact_Daily_AdrOcc', N'U')     IS NOT NULL DROP TABLE dbo.Fact_Daily_AdrOcc;
IF OBJECT_ID(N'dbo.Fact_RevPAR_Monthly', N'U')   IS NOT NULL DROP TABLE dbo.Fact_RevPAR_Monthly;
IF OBJECT_ID(N'dbo.Fact_Booking', N'U')          IS NOT NULL DROP TABLE dbo.Fact_Booking;
IF OBJECT_ID(N'dbo.Dim_RoomType', N'U')          IS NOT NULL DROP TABLE dbo.Dim_RoomType;
IF OBJECT_ID(N'dbo.Dim_CustomerType', N'U')      IS NOT NULL DROP TABLE dbo.Dim_CustomerType;
IF OBJECT_ID(N'dbo.Dim_Channel', N'U')           IS NOT NULL DROP TABLE dbo.Dim_Channel;
IF OBJECT_ID(N'dbo.Dim_Segment', N'U')           IS NOT NULL DROP TABLE dbo.Dim_Segment;
IF OBJECT_ID(N'dbo.Dim_Country', N'U')           IS NOT NULL DROP TABLE dbo.Dim_Country;
IF OBJECT_ID(N'dbo.Dim_Deposit', N'U')           IS NOT NULL DROP TABLE dbo.Dim_Deposit;
IF OBJECT_ID(N'dbo.Dim_Status', N'U')            IS NOT NULL DROP TABLE dbo.Dim_Status;
IF OBJECT_ID(N'dbo.Dim_Hotel', N'U')             IS NOT NULL DROP TABLE dbo.Dim_Hotel;
IF OBJECT_ID(N'dbo.Dim_Date', N'U')              IS NOT NULL DROP TABLE dbo.Dim_Date;
GO

/* =============================================================================
   DIMENSIONS
   ============================================================================= */

CREATE TABLE dbo.Dim_Hotel (
    hotel_key   INT           NOT NULL IDENTITY(1,1),
    hotel_name  NVARCHAR(50)  NOT NULL,
    CONSTRAINT PK_Dim_Hotel PRIMARY KEY (hotel_key),
    CONSTRAINT UQ_Dim_Hotel_name UNIQUE (hotel_name)
);

CREATE TABLE dbo.Dim_Date (
    date_key      INT           NOT NULL,          -- YYYYMMDD
    full_date     DATE          NOT NULL,
    [year]        INT           NOT NULL,
    month_number  TINYINT       NOT NULL,
    month_name    NVARCHAR(20)  NOT NULL,
    year_month    CHAR(7)       NOT NULL,          -- YYYY-MM
    [quarter]     CHAR(2)       NOT NULL,          -- Q1..Q4
    week_number   TINYINT       NOT NULL,
    day_of_month  TINYINT       NOT NULL,
    day_of_week   NVARCHAR(20)  NOT NULL,
    season        NVARCHAR(20)  NOT NULL,          -- Peak / Shoulder / Low
    CONSTRAINT PK_Dim_Date PRIMARY KEY (date_key),
    CONSTRAINT UQ_Dim_Date_full UNIQUE (full_date),
    CONSTRAINT CK_Dim_Date_season CHECK (season IN (N'Peak', N'Shoulder', N'Low'))
);

CREATE TABLE dbo.Dim_Status (
    status_key           INT           NOT NULL IDENTITY(1,1),
    reservation_status   NVARCHAR(30)  NOT NULL,
    CONSTRAINT PK_Dim_Status PRIMARY KEY (status_key),
    CONSTRAINT UQ_Dim_Status UNIQUE (reservation_status)
);

CREATE TABLE dbo.Dim_Deposit (
    deposit_key    INT           NOT NULL IDENTITY(1,1),
    deposit_type   NVARCHAR(30)  NOT NULL,
    CONSTRAINT PK_Dim_Deposit PRIMARY KEY (deposit_key),
    CONSTRAINT UQ_Dim_Deposit UNIQUE (deposit_type)
);

CREATE TABLE dbo.Dim_Country (
    country_key    INT           NOT NULL IDENTITY(1,1),
    country_code   NVARCHAR(10)  NOT NULL,         -- ISO3; Fact_Booking.country
    CONSTRAINT PK_Dim_Country PRIMARY KEY (country_key),
    CONSTRAINT UQ_Dim_Country UNIQUE (country_code)
);

CREATE TABLE dbo.Dim_Segment (
    segment_key      INT           NOT NULL IDENTITY(1,1),
    market_segment   NVARCHAR(50)  NOT NULL,
    CONSTRAINT PK_Dim_Segment PRIMARY KEY (segment_key),
    CONSTRAINT UQ_Dim_Segment UNIQUE (market_segment)
);

CREATE TABLE dbo.Dim_Channel (
    channel_key              INT           NOT NULL IDENTITY(1,1),
    distribution_channel     NVARCHAR(50)  NOT NULL,
    CONSTRAINT PK_Dim_Channel PRIMARY KEY (channel_key),
    CONSTRAINT UQ_Dim_Channel UNIQUE (distribution_channel)
);

CREATE TABLE dbo.Dim_CustomerType (
    customer_type_key   INT           NOT NULL IDENTITY(1,1),
    customer_type       NVARCHAR(30)  NOT NULL,
    CONSTRAINT PK_Dim_CustomerType PRIMARY KEY (customer_type_key),
    CONSTRAINT UQ_Dim_CustomerType UNIQUE (customer_type)
);

/* Role-playing: 1 bảng, 2 quan hệ (reserved = chính, assigned = join khi cần) */
CREATE TABLE dbo.Dim_RoomType (
    room_type_key   INT           NOT NULL IDENTITY(1,1),
    room_type       NVARCHAR(10)  NOT NULL,
    CONSTRAINT PK_Dim_RoomType PRIMARY KEY (room_type_key),
    CONSTRAINT UQ_Dim_RoomType UNIQUE (room_type)
);
GO

/* =============================================================================
   FACTS
   ============================================================================= */

CREATE TABLE dbo.Fact_Booking (
    booking_key                         INT             NOT NULL IDENTITY(1,1),
    hotel                               NVARCHAR(50)    NOT NULL,
    arrival_date                        DATE            NOT NULL,
    arrival_date_year                   INT             NOT NULL,
    arrival_date_month                  NVARCHAR(20)    NOT NULL,
    arrival_month_number                TINYINT         NOT NULL,
    year_month                          CHAR(7)         NOT NULL,
    arrival_date_week_number            TINYINT         NOT NULL,
    arrival_date_day_of_month           TINYINT         NOT NULL,
    day_of_week                         NVARCHAR(20)    NOT NULL,
    country                             NVARCHAR(10)    NULL,
    market_segment                      NVARCHAR(50)    NOT NULL,
    distribution_channel                NVARCHAR(50)    NOT NULL,
    customer_type                       NVARCHAR(30)    NOT NULL,
    is_repeated_guest                   BIT             NOT NULL,
    reserved_room_type                  NVARCHAR(10)    NOT NULL,
    assigned_room_type                  NVARCHAR(10)    NOT NULL,
    meal                                NVARCHAR(20)    NOT NULL,   -- degenerate dim
    deposit_type                        NVARCHAR(30)    NOT NULL,
    reservation_status                  NVARCHAR(30)    NOT NULL,
    agent                               NVARCHAR(20)    NULL,
    is_canceled                         BIT             NOT NULL,
    lead_time                           INT             NOT NULL,
    stays_in_weekend_nights             INT             NOT NULL,
    stays_in_week_nights                INT             NOT NULL,
    total_nights                        INT             NOT NULL,
    adults                              INT             NOT NULL,
    children                            INT             NOT NULL,
    babies                              INT             NOT NULL,
    previous_cancellations              INT             NOT NULL,
    previous_bookings_not_canceled      INT             NOT NULL,
    booking_changes                     INT             NOT NULL,
    days_in_waiting_list                INT             NOT NULL,
    required_car_parking_spaces         INT             NOT NULL,
    total_of_special_requests           INT             NOT NULL,
    adr                                 DECIMAL(12, 4)  NOT NULL,
    revenue                             DECIMAL(14, 4)  NOT NULL,   -- adr * nights * (1 - is_canceled)
    reservation_status_date             DATE            NULL,

    /* Cột tính — khớp Power Query / DAX Lead Time Bin */
    cancel_label AS (
        CASE WHEN is_canceled = 1 THEN N'Canceled' ELSE N'Not canceled' END
    ) PERSISTED,
    lead_time_bin AS (
        CASE
            WHEN lead_time <= 7   THEN N'0-7d'
            WHEN lead_time <= 30  THEN N'8-30d'
            WHEN lead_time <= 90  THEN N'31-90d'
            WHEN lead_time <= 180 THEN N'91-180d'
            ELSE N'180d+'
        END
    ) PERSISTED,
    lead_time_bin_order AS (
        CASE
            WHEN lead_time <= 7   THEN 0
            WHEN lead_time <= 30  THEN 1
            WHEN lead_time <= 90  THEN 2
            WHEN lead_time <= 180 THEN 3
            ELSE 4
        END
    ) PERSISTED,
    room_mismatch_flag AS (
        CASE WHEN reserved_room_type <> assigned_room_type THEN 1 ELSE 0 END
    ) PERSISTED,

    CONSTRAINT PK_Fact_Booking PRIMARY KEY (booking_key)
);

CREATE TABLE dbo.Fact_RevPAR_Monthly (
    hotel                 NVARCHAR(50)    NOT NULL,
    year_month            CHAR(7)         NOT NULL,
    [year]                INT             NOT NULL,
    month_number          TINYINT         NOT NULL,
    month_start_date      DATE            NOT NULL,   -- DATE(year, month, 1) → Dim_Date
    total_bookings        INT             NOT NULL,
    successful_bookings   INT             NOT NULL,
    canceled_bookings     INT             NOT NULL,
    occupancy_rate        DECIMAL(12, 8)  NOT NULL,   -- successful / total  (proxy)
    adr                   DECIMAL(12, 4)  NOT NULL,   -- AVG(adr) stay thành công, adr > 0
    revpar                DECIMAL(12, 4)  NOT NULL,   -- adr * occupancy_rate
    total_revenue         DECIMAL(16, 4)  NOT NULL,
    avg_lead_time         DECIMAL(12, 4)  NULL,
    avg_total_nights      DECIMAL(12, 4)  NULL,
    CONSTRAINT PK_Fact_RevPAR_Monthly PRIMARY KEY (hotel, year_month)
);

CREATE TABLE dbo.Fact_Daily_AdrOcc (
    hotel                 NVARCHAR(50)    NOT NULL,
    arrival_date          DATE            NOT NULL,
    bookings              INT             NOT NULL,
    canceled              INT             NOT NULL,
    successful            INT             NOT NULL,
    occupancy_rate        DECIMAL(12, 8)  NOT NULL,
    adr                   DECIMAL(12, 4)  NULL,
    room_nights_sold      INT             NOT NULL,
    revenue               DECIMAL(16, 4)  NOT NULL,
    revpar                DECIMAL(12, 4)  NULL,
    CONSTRAINT PK_Fact_Daily_AdrOcc PRIMARY KEY (hotel, arrival_date)
);
GO

/* =============================================================================
   QUAN HỆ — 12 FK khớp POWERBI_SETUP_GUIDE.md mục 3.1.1
   + 2 FK cho Fact_Daily_AdrOcc
   Mọi quan hệ: dimension (1) → fact (*)
   ============================================================================= */

ALTER TABLE dbo.Fact_Booking ADD
    CONSTRAINT FK_FactBooking_Hotel
        FOREIGN KEY (hotel) REFERENCES dbo.Dim_Hotel (hotel_name),
    CONSTRAINT FK_FactBooking_Date
        FOREIGN KEY (arrival_date) REFERENCES dbo.Dim_Date (full_date),
    CONSTRAINT FK_FactBooking_Segment
        FOREIGN KEY (market_segment) REFERENCES dbo.Dim_Segment (market_segment),
    CONSTRAINT FK_FactBooking_Channel
        FOREIGN KEY (distribution_channel) REFERENCES dbo.Dim_Channel (distribution_channel),
    CONSTRAINT FK_FactBooking_CustomerType
        FOREIGN KEY (customer_type) REFERENCES dbo.Dim_CustomerType (customer_type),
    CONSTRAINT FK_FactBooking_Status
        FOREIGN KEY (reservation_status) REFERENCES dbo.Dim_Status (reservation_status),
    CONSTRAINT FK_FactBooking_Deposit
        FOREIGN KEY (deposit_type) REFERENCES dbo.Dim_Deposit (deposit_type),
    CONSTRAINT FK_FactBooking_Country
        FOREIGN KEY (country) REFERENCES dbo.Dim_Country (country_code),
    CONSTRAINT FK_FactBooking_RoomReserved
        FOREIGN KEY (reserved_room_type) REFERENCES dbo.Dim_RoomType (room_type),
    CONSTRAINT FK_FactBooking_RoomAssigned
        FOREIGN KEY (assigned_room_type) REFERENCES dbo.Dim_RoomType (room_type);

ALTER TABLE dbo.Fact_RevPAR_Monthly ADD
    CONSTRAINT FK_FactRevPAR_Hotel
        FOREIGN KEY (hotel) REFERENCES dbo.Dim_Hotel (hotel_name),
    CONSTRAINT FK_FactRevPAR_Date
        FOREIGN KEY (month_start_date) REFERENCES dbo.Dim_Date (full_date);

ALTER TABLE dbo.Fact_Daily_AdrOcc ADD
    CONSTRAINT FK_FactDaily_Hotel
        FOREIGN KEY (hotel) REFERENCES dbo.Dim_Hotel (hotel_name),
    CONSTRAINT FK_FactDaily_Date
        FOREIGN KEY (arrival_date) REFERENCES dbo.Dim_Date (full_date);
GO

/* Index hỗ trợ join / filter dashboard (hotel, năm, segment, channel, deposit) */
CREATE INDEX IX_FactBooking_Hotel_Date
    ON dbo.Fact_Booking (hotel, arrival_date);
CREATE INDEX IX_FactBooking_YearMonth
    ON dbo.Fact_Booking (year_month);
CREATE INDEX IX_FactBooking_Segment
    ON dbo.Fact_Booking (market_segment);
CREATE INDEX IX_FactBooking_Channel
    ON dbo.Fact_Booking (distribution_channel);
CREATE INDEX IX_FactBooking_Deposit
    ON dbo.Fact_Booking (deposit_type);
CREATE INDEX IX_FactBooking_Country
    ON dbo.Fact_Booking (country);
CREATE INDEX IX_FactBooking_CustomerType
    ON dbo.Fact_Booking (customer_type);
CREATE INDEX IX_FactBooking_LeadBin
    ON dbo.Fact_Booking (lead_time_bin_order);
CREATE INDEX IX_FactRevPAR_YearMonth
    ON dbo.Fact_RevPAR_Monthly (year_month);
CREATE INDEX IX_FactRevPAR_MonthStart
    ON dbo.Fact_RevPAR_Monthly (month_start_date);
GO

/* =============================================================================
   VIEW KPI — weighted average giống DAX / data.js (KHÔNG dùng AVG thô)
     ADR    = Σ(adr × successful_bookings) / Σ(successful_bookings)
     Occ    = Σ(occupancy_rate × total_bookings) / Σ(total_bookings)
     RevPAR = Σ(revpar × total_bookings) / Σ(total_bookings)
   ============================================================================= */

IF OBJECT_ID(N'dbo.vw_kpi_revpar_weighted', N'V') IS NOT NULL
    DROP VIEW dbo.vw_kpi_revpar_weighted;
GO

CREATE VIEW dbo.vw_kpi_revpar_weighted
AS
SELECT
    r.hotel,
    r.year_month,
    r.[year],
    r.month_number,
    r.month_start_date,
    d.month_name,
    d.season,
    r.total_bookings,
    r.successful_bookings,
    r.canceled_bookings,
    r.occupancy_rate,
    r.adr,
    r.revpar,
    r.total_revenue,
    CAST(r.canceled_bookings AS DECIMAL(18, 6))
        / NULLIF(r.total_bookings, 0) AS cancel_rate
FROM dbo.Fact_RevPAR_Monthly AS r
INNER JOIN dbo.Dim_Date AS d
    ON d.full_date = r.month_start_date;
GO

PRINT N'Đã tạo star schema: 9 dimension + 3 fact + 14 FK + view KPI.';
GO
