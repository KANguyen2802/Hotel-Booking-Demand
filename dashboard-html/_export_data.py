"""Export star-schema CSVs to JSON for the local HTML dashboard."""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
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

    # Top-3 customer types by volume (Transient, Transient-Party, Contract); Group → Other
    top_ctypes = ["Transient", "Transient-Party", "Contract"]
    book_ct = book.copy()
    book_ct["customer_type"] = book_ct["customer_type"].where(
        book_ct["customer_type"].isin(top_ctypes), "Other"
    )
    customer_type_monthly = (
        book_ct.groupby(
            ["hotel", "arrival_date_year", "year_month", "customer_type"], as_index=False
        )
        .agg(
            bookings=("booking_key", "count"),
            revenue=("revenue", "sum"),
            room_nights=("total_nights", "sum"),
            avg_adr=("adr", "mean"),
        )
        .rename(columns={"arrival_date_year": "year"})
        .sort_values(["hotel", "year_month", "customer_type"])
    )

    # Daily ADR × Occupancy grain for scatter + box-select summary.
    # Scatter: ADR / occupancy_rate / revpar như lúc thêm biểu đồ (mean theo ngày,
    # occupancy_rate lấy từ monthly context trên booking). RevPAR = ADR × Occupancy.
    # Box-select extras: canceled, available/sold room-nights, segments.
    daily_keys = ["hotel", "arrival_date", "arrival_date_year", "year_month"]
    daily_adr_occ = (
        book.groupby(daily_keys, as_index=False)
        .agg(
            bookings=("booking_key", "count"),
            canceled=("is_canceled", "sum"),
            adr=("adr", "mean"),
            occupancy_rate=("occupancy_rate", "mean"),
            available_room_nights=("total_nights", "sum"),
            revenue=("revenue", "sum"),
        )
        .rename(columns={"arrival_date_year": "year"})
    )
    sold_nights = (
        book.loc[book["is_canceled"] == 0]
        .groupby(daily_keys, as_index=False)
        .agg(room_nights=("total_nights", "sum"))
        .rename(columns={"arrival_date_year": "year"})
    )
    daily_adr_occ = daily_adr_occ.merge(
        sold_nights, on=["hotel", "arrival_date", "year", "year_month"], how="left"
    )
    daily_adr_occ["room_nights"] = daily_adr_occ["room_nights"].fillna(0.0)
    daily_adr_occ["cancel_rate"] = (
        daily_adr_occ["canceled"] / daily_adr_occ["bookings"].clip(lower=1)
    )
    daily_adr_occ["revpar"] = daily_adr_occ["adr"] * daily_adr_occ["occupancy_rate"]

    seg_daily = (
        book.groupby(["hotel", "arrival_date", "market_segment"], as_index=False)
        .size()
        .rename(columns={"size": "bookings"})
    )
    seg_daily["arrival_date"] = pd.to_datetime(
        seg_daily["arrival_date"], dayfirst=True, errors="coerce"
    ).dt.strftime("%Y-%m-%d")
    seg_daily = seg_daily.dropna(subset=["arrival_date"])
    seg_map: dict[tuple[str, str], dict[str, int]] = {}
    for row in seg_daily.itertuples(index=False):
        key = (str(row.hotel), str(row.arrival_date))
        seg_map.setdefault(key, {})[str(row.market_segment)] = int(row.bookings)

    # Normalize date to ISO YYYY-MM-DD for JS
    daily_adr_occ["arrival_date"] = pd.to_datetime(
        daily_adr_occ["arrival_date"], dayfirst=True, errors="coerce"
    ).dt.strftime("%Y-%m-%d")
    daily_adr_occ = daily_adr_occ.dropna(subset=["arrival_date"])
    daily_adr_occ["segments"] = [
        seg_map.get((str(h), str(d)), {})
        for h, d in zip(daily_adr_occ["hotel"], daily_adr_occ["arrival_date"])
    ]
    daily_adr_occ = daily_adr_occ.sort_values(["hotel", "arrival_date"])

    def _room_side(col: str, side: str) -> pd.DataFrame:
        g = (
            book.groupby(["hotel", "arrival_date_year", col], as_index=False)
            .agg(
                bookings=("booking_key", "count"),
                revenue=("revenue", "sum"),
                room_nights=("total_nights", "sum"),
                avg_adr=("adr", "mean"),
                avg_revpar=("revpar", "mean"),
            )
            .rename(columns={"arrival_date_year": "year", col: "room_type"})
        )
        g["side"] = side
        g["revpar"] = g.apply(
            lambda r: (r["revenue"] / r["room_nights"]) if r["room_nights"] else r["avg_revpar"],
            axis=1,
        )
        return g

    room_type_revpar = pd.concat(
        [_room_side("reserved_room_type", "reserved"), _room_side("assigned_room_type", "assigned")],
        ignore_index=True,
    ).sort_values(["hotel", "year", "side", "bookings"], ascending=[True, True, True, False])

    # ADR samples for boxplot by hotel × year (capped) + exact means
    rng = np.random.default_rng(42)
    adr_cancel: dict = {"rows": [], "stats": []}
    for (hotel, year, flag), g in book.groupby(
        ["hotel", "arrival_date_year", "is_canceled"], sort=False
    ):
        label = "Canceled" if int(flag) == 1 else "Not canceled"
        vals = g["adr"].dropna().astype(float).to_numpy()
        if len(vals) > 1500:
            vals = rng.choice(vals, size=1500, replace=False)
        vals_list = sorted(float(v) for v in vals)
        n = len(vals_list)

        def q(p: float, arr: list[float] = vals_list, n: int = n) -> float | None:
            if not n:
                return None
            idx = (n - 1) * p
            lo, hi = int(idx), int(math.ceil(idx))
            if lo == hi:
                return arr[lo]
            return arr[lo] * (hi - idx) + arr[hi] * (idx - lo)

        adr_cancel["rows"].append(
            {
                "hotel": str(hotel),
                "year": int(year),
                "label": label,
                "samples": vals_list,
            }
        )
        adr_cancel["stats"].append(
            {
                "hotel": str(hotel),
                "year": int(year),
                "label": label,
                "n": int(len(g)),
                "mean": float(g["adr"].mean()),
                "min": vals_list[0] if n else None,
                "q1": q(0.25),
                "median": q(0.5),
                "q3": q(0.75),
                "max": vals_list[-1] if n else None,
            }
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
    dump(customer_type_monthly, "customer_type_monthly.json")
    dump(daily_adr_occ, "daily_adr_occ.json")
    dump(room_type_revpar, "room_type_revpar.json")
    (OUT / "adr_cancel_box.json").write_text(
        json.dumps(adr_cancel, ensure_ascii=False), encoding="utf-8"
    )
    print(f"adr_cancel_box.json: {sum(len(g['samples']) for g in adr_cancel['rows'])} samples")

    meta = {
        "min_month": str(rev["year_month"].min()),
        "max_month": str(rev["year_month"].max()),
        "hotels": sorted(rev["hotel"].astype(str).unique().tolist()),
        "years": sorted(int(y) for y in rev["year"].unique().tolist()),
        "customer_types": top_ctypes,
    }
    (OUT / "meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("meta:", meta)


if __name__ == "__main__":
    main()
