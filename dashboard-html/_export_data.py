"""Export star-schema CSVs to JSON for the local HTML dashboard."""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
STAR = ROOT / "data" / "star schema"
REVPAR_CSV = STAR / "revpar_monthly.csv"
BOOKING_CSV = STAR / "hotel_bookings_normalized.csv"
OUT = Path(__file__).resolve().parent / "data"
OUT.mkdir(parents=True, exist_ok=True)


def dump(df: pd.DataFrame, name: str) -> None:
    records = json.loads(df.to_json(orient="records", date_format="iso"))
    (OUT / name).write_text(json.dumps(records, ensure_ascii=False), encoding="utf-8")
    print(f"{name}: {len(records)} rows")


def lead_bin(series: pd.Series) -> pd.Series:
    return pd.cut(
        series,
        bins=[-1, 7, 30, 90, 180, 10_000],
        labels=["0-7d", "8-30d", "31-90d", "91-180d", "180d+"],
    )


def main() -> None:
    if not REVPAR_CSV.exists() or not BOOKING_CSV.exists():
        raise FileNotFoundError(
            f"Missing star-schema CSVs under {STAR}. Run scripts/build_star_schema_v5.py first."
        )

    rev = pd.read_csv(REVPAR_CSV).sort_values(["hotel", "year_month"])
    book = pd.read_csv(BOOKING_CSV)
    book["arrival_date_year"] = book["arrival_date_year"].astype(int)

    status = (
        book.groupby(["hotel", "arrival_date_year", "reservation_status"], as_index=False)
        .size()
        .rename(columns={"arrival_date_year": "year", "reservation_status": "status", "size": "bookings"})
        .sort_values(["hotel", "year", "bookings"], ascending=[True, True, False])
    )

    segment = (
        book.groupby(["hotel", "arrival_date_year", "market_segment"], as_index=False)
        .agg(
            bookings=("booking_key", "count"),
            canceled=("is_canceled", "sum"),
            avg_adr=("adr", "mean"),
            revenue=("revenue", "sum"),
        )
        .rename(columns={"arrival_date_year": "year"})
        .sort_values("bookings", ascending=False)
    )

    countries = (
        book.groupby(["hotel", "arrival_date_year", "country"], as_index=False)
        .agg(
            bookings=("booking_key", "count"),
            cancel_rate=("is_canceled", "mean"),
            revenue=("revenue", "sum"),
        )
        .rename(columns={"arrival_date_year": "year"})
        .sort_values("bookings", ascending=False)
    )

    cancel_monthly = (
        book.assign(noshow=(book["reservation_status"] == "No-Show").astype(float))
        .groupby(["hotel", "year_month", "arrival_date_year"], as_index=False)
        .agg(
            bookings=("booking_key", "count"),
            cancel_rate=("is_canceled", "mean"),
            noshow_rate=("noshow", "mean"),
        )
        .rename(columns={"arrival_date_year": "year"})
        .sort_values(["hotel", "year_month"])
    )

    cancel_lead = (
        book.assign(lead_bin=lead_bin(book["lead_time"]))
        .groupby(["hotel", "arrival_date_year", "lead_bin"], as_index=False, observed=True)
        .agg(bookings=("booking_key", "count"), cancel_rate=("is_canceled", "mean"))
        .rename(columns={"arrival_date_year": "year"})
        .sort_values(["hotel", "year", "lead_bin"])
    )

    cancel_deposit = (
        book.groupby(["hotel", "arrival_date_year", "deposit_type"], as_index=False)
        .agg(bookings=("booking_key", "count"), cancel_rate=("is_canceled", "mean"))
        .rename(columns={"arrival_date_year": "year"})
        .sort_values(["hotel", "year", "cancel_rate"], ascending=[True, True, False])
    )

    cancel_channel = (
        book.groupby(["hotel", "arrival_date_year", "distribution_channel"], as_index=False)
        .agg(bookings=("booking_key", "count"), cancel_rate=("is_canceled", "mean"))
        .rename(columns={"arrival_date_year": "year"})
        .sort_values(["hotel", "year", "cancel_rate"], ascending=[True, True, False])
    )

    cancel_segment = (
        book.groupby(["hotel", "arrival_date_year", "market_segment"], as_index=False)
        .agg(bookings=("booking_key", "count"), cancel_rate=("is_canceled", "mean"))
        .rename(columns={"arrival_date_year": "year"})
        .sort_values(["hotel", "year", "cancel_rate"], ascending=[True, True, False])
    )

    booking_cube = (
        book.assign(lead_bin=lead_bin(book["lead_time"]))
        .groupby(
            [
                "hotel",
                "arrival_date_year",
                "year_month",
                "lead_bin",
                "deposit_type",
                "distribution_channel",
                "market_segment",
                "reservation_status",
                "country",
            ],
            as_index=False,
            observed=True,
        )
        .agg(
            bookings=("booking_key", "count"),
            canceled=("is_canceled", "sum"),
            noshow=("reservation_status", lambda s: int((s == "No-Show").sum())),
            revenue=("revenue", "sum"),
        )
        .rename(
            columns={
                "arrival_date_year": "year",
                "distribution_channel": "channel",
                "market_segment": "segment",
                "reservation_status": "status",
            }
        )
        .sort_values(["hotel", "year_month"])
    )

    dump(rev, "revpar_monthly.json")
    dump(status, "status_mix.json")
    dump(segment, "segment_mix.json")
    dump(countries, "countries.json")
    dump(cancel_monthly, "cancel_monthly.json")
    dump(cancel_lead, "cancel_lead.json")
    dump(cancel_deposit, "cancel_deposit.json")
    dump(cancel_channel, "cancel_channel.json")
    dump(cancel_segment, "cancel_segment.json")
    dump(booking_cube, "booking_cube.json")

    meta = {
        "min_month": str(rev["year_month"].min()),
        "max_month": str(rev["year_month"].max()),
        "hotels": sorted(rev["hotel"].astype(str).unique().tolist()),
        "years": sorted(int(y) for y in rev["year"].unique().tolist()),
    }
    (OUT / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("meta:", meta)


if __name__ == "__main__":
    main()
