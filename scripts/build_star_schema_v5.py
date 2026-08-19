"""
Build star-schema CSV exports from hotel_bookings_v5.csv (pandas only).

Grain:
  - hotel_bookings_normalized.csv: 1 row = 1 booking (+ monthly RevPAR context)
  - revpar_monthly.csv: 1 row = 1 hotel × calendar month
  - dim_*.csv: lookup tables for BI / Power BI

RevPAR (project formula, notebook 01):
  Occupancy_Rate = mean(1 - is_canceled) by hotel-month
  ADR            = mean(adr) where is_canceled = 0 by hotel-month
  RevPAR         = ADR × Occupancy_Rate
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SRC_CSV = ROOT / "data" / "hotel_bookings_v5.csv"
OUT_DIR = ROOT / "data" / "star schema"
REVPAR_CSV = OUT_DIR / "revpar_monthly.csv"
NORMALIZED_CSV = OUT_DIR / "hotel_bookings_normalized.csv"
LEGACY_DUCKDB = OUT_DIR / "hotel_bookings_star.duckdb"

MONTH_MAP = {
    "January": 1,
    "February": 2,
    "March": 3,
    "April": 4,
    "May": 5,
    "June": 6,
    "July": 7,
    "August": 8,
    "September": 9,
    "October": 10,
    "November": 11,
    "December": 12,
}


def _dim_table(df: pd.DataFrame, cols: list[str], key_name: str) -> pd.DataFrame:
    keys = df[cols].drop_duplicates().sort_values(cols).reset_index(drop=True)
    keys.insert(0, key_name, range(1, len(keys) + 1))
    return keys


def build() -> None:
    if not SRC_CSV.exists():
        raise FileNotFoundError(f"Source CSV not found: {SRC_CSV}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    if LEGACY_DUCKDB.exists():
        LEGACY_DUCKDB.unlink()
        print(f"Removed legacy file: {LEGACY_DUCKDB.name}")

    src = pd.read_csv(SRC_CSV)
    src = src.copy()
    src["booking_key"] = range(1, len(src) + 1)
    src["arrival_month_number"] = src["arrival_date_month"].map(MONTH_MAP).astype(int)
    src["year_month"] = (
        src["arrival_date_year"].astype(int).astype(str)
        + "-"
        + src["arrival_month_number"].astype(int).astype(str).str.zfill(2)
    )
    src["total_nights"] = src["stays_in_weekend_nights"].fillna(0) + src["stays_in_week_nights"].fillna(0)
    if "revenue" not in src.columns:
        src["revenue"] = src["adr"].fillna(0) * src["total_nights"].clip(lower=0) * (1 - src["is_canceled"])

    # Dimensions
    dim_hotel = _dim_table(src.rename(columns={"hotel": "hotel_name"}), ["hotel_name"], "hotel_key")
    dim_country = _dim_table(src.rename(columns={"country": "country_code"}), ["country_code"], "country_key")
    dim_market = _dim_table(src, ["market_segment", "distribution_channel"], "market_key")
    dim_customer = _dim_table(src, ["customer_type", "is_repeated_guest"], "customer_key")
    dim_room = _dim_table(src, ["reserved_room_type", "assigned_room_type"], "room_key")
    dim_meal = _dim_table(src, ["meal"], "meal_key")
    dim_deposit = _dim_table(src, ["deposit_type"], "deposit_key")
    dim_status = _dim_table(src, ["reservation_status"], "status_key")
    agent = src[["agent"]].copy()
    agent["agent"] = agent["agent"].fillna("NULL").astype(str)
    dim_agent = _dim_table(agent.rename(columns={"agent": "agent_id"}), ["agent_id"], "agent_key")

    dates = (
        src[["arrival_date_year", "arrival_date_month", "arrival_month_number", "year_month",
             "arrival_date_week_number", "arrival_date_day_of_month"]]
        .drop_duplicates()
        .copy()
    )
    dates["full_date"] = pd.to_datetime(
        dict(
            year=dates["arrival_date_year"].astype(int),
            month=dates["arrival_month_number"].astype(int),
            day=dates["arrival_date_day_of_month"].astype(int),
        ),
        errors="coerce",
    )
    dates["date_key"] = dates["full_date"].dt.strftime("%Y%m%d").astype("Int64")
    dates["day_of_week"] = dates["full_date"].dt.day_name()
    dim_date = (
        dates.rename(
            columns={
                "arrival_date_year": "year",
                "arrival_date_month": "month_name",
                "arrival_month_number": "month_number",
                "arrival_date_week_number": "week_number",
                "arrival_date_day_of_month": "day_of_month",
            }
        )[
            [
                "date_key",
                "full_date",
                "year",
                "month_number",
                "month_name",
                "year_month",
                "week_number",
                "day_of_month",
                "day_of_week",
            ]
        ]
        .dropna(subset=["date_key"])
        .drop_duplicates(subset=["date_key"])
        .sort_values("date_key")
        .reset_index(drop=True)
    )

    # Monthly RevPAR fact
    successful = src["is_canceled"] == 0
    revpar = (
        src.groupby(["hotel", "year_month"], as_index=False)
        .agg(
            year=("arrival_date_year", "first"),
            month_number=("arrival_month_number", "first"),
            total_bookings=("booking_key", "count"),
            successful_bookings=("is_canceled", lambda s: int((s == 0).sum())),
            canceled_bookings=("is_canceled", lambda s: int((s == 1).sum())),
            occupancy_rate=("is_canceled", lambda s: float((1 - s).mean())),
            total_revenue=("revenue", "sum"),
            avg_lead_time=("lead_time", "mean"),
            avg_total_nights=("total_nights", "mean"),
        )
    )
    adr = (
        src.loc[successful]
        .groupby(["hotel", "year_month"], as_index=False)["adr"]
        .mean()
        .rename(columns={"adr": "adr"})
    )
    revpar = revpar.merge(adr, on=["hotel", "year_month"], how="left")
    revpar["adr"] = revpar["adr"].fillna(0.0)
    revpar["revpar"] = revpar["adr"] * revpar["occupancy_rate"]
    revpar = revpar[
        [
            "hotel",
            "year_month",
            "year",
            "month_number",
            "total_bookings",
            "successful_bookings",
            "canceled_bookings",
            "occupancy_rate",
            "adr",
            "revpar",
            "total_revenue",
            "avg_lead_time",
            "avg_total_nights",
        ]
    ].sort_values(["hotel", "year_month"])

    # Normalized booking export
    monthly_ctx = revpar[["hotel", "year_month", "occupancy_rate", "adr", "revpar"]].rename(
        columns={"adr": "group_adr"}
    )
    normalized = src.merge(monthly_ctx, on=["hotel", "year_month"], how="left")
    keep_cols = [
        "booking_key",
        "hotel",
        "arrival_date_year",
        "arrival_date_month",
        "arrival_month_number",
        "year_month",
        "arrival_date_week_number",
        "arrival_date_day_of_month",
        "country",
        "market_segment",
        "distribution_channel",
        "customer_type",
        "is_repeated_guest",
        "reserved_room_type",
        "assigned_room_type",
        "meal",
        "deposit_type",
        "reservation_status",
        "agent",
        "is_canceled",
        "lead_time",
        "stays_in_weekend_nights",
        "stays_in_week_nights",
        "total_nights",
        "adults",
        "children",
        "babies",
        "previous_cancellations",
        "previous_bookings_not_canceled",
        "booking_changes",
        "days_in_waiting_list",
        "required_car_parking_spaces",
        "total_of_special_requests",
        "adr",
        "revenue",
        "reservation_status_date",
        "occupancy_rate",
        "group_adr",
        "revpar",
    ]
    # arrival_date / day_of_week if reconstructable
    arrival_date = pd.to_datetime(
        dict(
            year=normalized["arrival_date_year"].astype(int),
            month=normalized["arrival_month_number"].astype(int),
            day=normalized["arrival_date_day_of_month"].astype(int),
        ),
        errors="coerce",
    )
    normalized.insert(2, "arrival_date", arrival_date.dt.strftime("%Y-%m-%d"))
    normalized.insert(9, "day_of_week", arrival_date.dt.day_name())
    keep_cols = [
        "booking_key",
        "hotel",
        "arrival_date",
        "arrival_date_year",
        "arrival_date_month",
        "arrival_month_number",
        "year_month",
        "arrival_date_week_number",
        "arrival_date_day_of_month",
        "day_of_week",
        "country",
        "market_segment",
        "distribution_channel",
        "customer_type",
        "is_repeated_guest",
        "reserved_room_type",
        "assigned_room_type",
        "meal",
        "deposit_type",
        "reservation_status",
        "agent",
        "is_canceled",
        "lead_time",
        "stays_in_weekend_nights",
        "stays_in_week_nights",
        "total_nights",
        "adults",
        "children",
        "babies",
        "previous_cancellations",
        "previous_bookings_not_canceled",
        "booking_changes",
        "days_in_waiting_list",
        "required_car_parking_spaces",
        "total_of_special_requests",
        "adr",
        "revenue",
        "reservation_status_date",
        "occupancy_rate",
        "group_adr",
        "revpar",
    ]
    normalized = normalized[keep_cols].sort_values("booking_key")

    # Write outputs
    revpar.to_csv(REVPAR_CSV, index=False)
    normalized.to_csv(NORMALIZED_CSV, index=False)
    dim_hotel.to_csv(OUT_DIR / "dim_hotel.csv", index=False)
    dim_date.to_csv(OUT_DIR / "dim_date.csv", index=False)
    dim_country.to_csv(OUT_DIR / "dim_country.csv", index=False)
    dim_market.to_csv(OUT_DIR / "dim_market.csv", index=False)
    dim_customer.to_csv(OUT_DIR / "dim_customer.csv", index=False)
    dim_room.to_csv(OUT_DIR / "dim_room.csv", index=False)
    dim_meal.to_csv(OUT_DIR / "dim_meal.csv", index=False)
    dim_deposit.to_csv(OUT_DIR / "dim_deposit.csv", index=False)
    dim_status.to_csv(OUT_DIR / "dim_status.csv", index=False)
    dim_agent.to_csv(OUT_DIR / "dim_agent.csv", index=False)

    summary = [
        "=== Star schema built (pandas / CSV) ===",
        f"CSV: {REVPAR_CSV.name}",
        f"CSV: {NORMALIZED_CSV.name}",
        "DIM CSVs: dim_hotel, dim_date, dim_country, dim_market, dim_customer, dim_room, dim_meal, dim_deposit, dim_status, dim_agent",
        "",
        f"fact_booking rows: {len(normalized)}",
        f"fact_revpar_monthly rows: {len(revpar)}",
        "",
        "Sample RevPAR monthly:",
        revpar.head(8)[
            ["hotel", "year_month", "total_bookings", "occupancy_rate", "adr", "revpar", "total_revenue"]
        ].to_string(index=False),
    ]
    summary_path = OUT_DIR / "build_summary.txt"
    summary_path.write_text("\n".join(summary), encoding="utf-8")
    print(summary_path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    build()
