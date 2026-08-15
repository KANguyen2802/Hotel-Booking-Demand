USE [Hotel Booking Demand];
GO

IF OBJECT_ID(N'dbo.hotel_bookings', N'U') IS NOT NULL
    DROP TABLE dbo.hotel_bookings;
GO

CREATE TABLE dbo.hotel_bookings (
    booking_id                      INT IDENTITY(1,1) PRIMARY KEY,
    hotel                           NVARCHAR(50)   NOT NULL,   -- City Hotel / Resort Hotel
    is_canceled                     BIT            NOT NULL,
    lead_time                       INT            NOT NULL,
    arrival_date_year               INT            NOT NULL,
    arrival_date_month              NVARCHAR(20)   NOT NULL,   -- July, August, ...
    arrival_date_week_number        INT            NOT NULL,
    arrival_date_day_of_month       INT            NOT NULL,
    stays_in_weekend_nights         INT            NOT NULL,
    stays_in_week_nights            INT            NOT NULL,
    adults                          INT            NOT NULL,
    children                        FLOAT          NULL,
    babies                          INT            NOT NULL,
    meal                            NVARCHAR(20)   NOT NULL,
    country                         NVARCHAR(10)   NULL,
    market_segment                  NVARCHAR(50)   NOT NULL,
    distribution_channel            NVARCHAR(50)   NOT NULL,
    is_repeated_guest               BIT            NOT NULL,
    previous_cancellations          INT            NOT NULL,
    previous_bookings_not_canceled  INT            NOT NULL,
    reserved_room_type              NVARCHAR(10)   NOT NULL,
    assigned_room_type              NVARCHAR(10)   NOT NULL,
    booking_changes                 INT            NOT NULL,
    deposit_type                    NVARCHAR(30)   NOT NULL,
    agent                           FLOAT          NULL,
    days_in_waiting_list            INT            NOT NULL,
    customer_type                   NVARCHAR(30)   NOT NULL,
    adr                             DECIMAL(10,2)  NOT NULL,
    required_car_parking_spaces     INT            NOT NULL,
    total_of_special_requests       INT            NOT NULL,
    reservation_status              NVARCHAR(30)   NOT NULL,
    reservation_status_date         DATE           NULL
);
GO