"""Xuất báo cáo 11_ — P(hủy) theo booking và theo biến phân loại (LightGBM v2)."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from lightgbm import LGBMClassifier
from sklearn.compose import ColumnTransformer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

ROOT = Path(__file__).resolve().parents[2]
CSV_PATH = ROOT / "data" / "hotel_bookings_v5.csv"
SCORES_CSV = ROOT / "data" / "11_cancellation_probability_scores.csv"
REPORT_SCORES = ROOT / "reports" / "11_cancellation_probability_scores.md"
REPORT_BY_VAR = ROOT / "reports" / "11_cancellation_probability_by_variable.md"

RANDOM_STATE = 42
TEST_SIZE = 0.2
PREDICTION_THRESHOLD = 0.35

MONTH_TO_NUM = {m: i + 1 for i, m in enumerate([
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
])}

CATEGORICAL_FEATURES = [
    "deposit_type", "market_segment", "country", "distribution_channel",
    "customer_type", "hotel",
]
NUMERIC_FEATURES = [
    "lead_time", "total_of_special_requests", "total_guests", "price_per_person",
    "is_family", "total_nights", "lead_time_per_night", "history_cancel_rate",
    "is_weekend_only", "arrival_month_mapped",
]
FEATURE_COLUMNS = CATEGORICAL_FEATURES + NUMERIC_FEATURES
TARGET_COLUMN = "is_canceled"

TUNED_PARAMS = {
    "n_estimators": 250,
    "max_depth": 15,
    "num_leaves": 61,
    "min_child_samples": 35,
    "learning_rate": 0.06327088846969782,
    "subsample": 0.7957118696489107,
    "colsample_bytree": 0.6332771647068834,
    "reg_alpha": 0.008189179973637264,
    "reg_lambda": 3.265450956311304,
    "class_weight": "balanced",
    "random_state": RANDOM_STATE,
    "n_jobs": -1,
    "verbose": -1,
}


def engineer_features(raw: pd.DataFrame) -> pd.DataFrame:
    out = raw.copy()
    out["children"] = out["children"].fillna(0)
    out["total_guests"] = (out["adults"] + out["children"] + out["babies"]).clip(lower=1)
    out["price_per_person"] = out["adr"] / out["total_guests"]
    out["is_family"] = ((out["children"] > 0) | (out["babies"] > 0)).astype(int)
    out["total_nights"] = out["stays_in_weekend_nights"] + out["stays_in_week_nights"]
    out["lead_time_per_night"] = out["lead_time"] / out["total_nights"].clip(lower=1)
    prior = out["previous_cancellations"] + out["previous_bookings_not_canceled"]
    out["history_cancel_rate"] = np.where(prior > 0, out["previous_cancellations"] / prior, 0.0)
    out["is_weekend_only"] = (
        (out["stays_in_weekend_nights"] > 0) & (out["stays_in_week_nights"] == 0)
    ).astype(int)
    out["arrival_month_mapped"] = out["arrival_date_month"].map(MONTH_TO_NUM).fillna(0).astype(int)
    return out


def prepare_model_df(df: pd.DataFrame) -> pd.DataFrame:
    model_df = engineer_features(df)[FEATURE_COLUMNS + [TARGET_COLUMN]].copy()
    model_df["country"] = model_df["country"].fillna("Unknown").astype(str)
    for col in CATEGORICAL_FEATURES:
        model_df[col] = model_df[col].astype(str)
    for col in ["lead_time", "total_of_special_requests", "total_guests", "is_family",
                "total_nights", "is_weekend_only", "arrival_month_mapped"]:
        model_df[col] = model_df[col].fillna(0).astype(int)
    for col in ["price_per_person", "lead_time_per_night", "history_cancel_rate"]:
        model_df[col] = model_df[col].fillna(0.0).astype(float)
    return model_df


def make_pipeline() -> Pipeline:
    enc = OneHotEncoder(handle_unknown="infrequent_if_exist", min_frequency=5, sparse_output=False)
    pre = ColumnTransformer([
        ("cat", enc, CATEGORICAL_FEATURES),
        ("num", "passthrough", NUMERIC_FEATURES),
    ], remainder="drop")
    return Pipeline([
        ("preprocessor", pre),
        ("classifier", LGBMClassifier(**TUNED_PARAMS)),
    ])


def risk_bucket(p: float) -> str:
    if p < 0.20:
        return "Thấp (<0.20)"
    if p < 0.35:
        return "Trung bình (0.20–0.35)"
    if p < 0.55:
        return "Cao (0.35–0.55)"
    return "Rất cao (≥0.55)"


def main() -> None:
    read_cols = list(dict.fromkeys(
        CATEGORICAL_FEATURES + ["lead_time", "total_of_special_requests",
        "adults", "children", "babies", "adr", "stays_in_weekend_nights", "stays_in_week_nights",
        "previous_bookings_not_canceled", "arrival_date_month", "previous_cancellations", TARGET_COLUMN]
    ))
    raw = pd.read_csv(CSV_PATH, usecols=read_cols)
    raw = raw.reset_index(drop=True)
    raw["booking_index"] = raw.index

    model_df = prepare_model_df(raw)
    X = model_df[FEATURE_COLUMNS]
    y = model_df[TARGET_COLUMN].astype(int)

    X_train, _, y_train, _ = train_test_split(
        X, y, test_size=TEST_SIZE, random_state=RANDOM_STATE, stratify=y,
    )
    pipe = make_pipeline()
    pipe.fit(X_train, y_train)

    proba = pipe.predict_proba(X)[:, 1]
    pred = (proba >= PREDICTION_THRESHOLD).astype(int)

    scores = pd.DataFrame({
        "booking_index": raw["booking_index"],
        "cancellation_probability": proba,
        "predicted_cancel": pred,
        "actual_cancel": y.values,
        "risk_bucket": [risk_bucket(p) for p in proba],
    })
    scores.to_csv(SCORES_CSV, index=False, encoding="utf-8")

    # --- Report 1 ---
    bucket_stats = (
        scores.groupby("risk_bucket", observed=True)
        .agg(bookings=("cancellation_probability", "count"),
             mean_prob=("cancellation_probability", "mean"),
             actual_cancel_rate=("actual_cancel", "mean"))
        .reset_index()
    )
    top_risk = scores.nlargest(15, "cancellation_probability")
    lines1 = [
        "# Báo cáo cancellation probability scores — theo booking",
        "",
        f"> **Tạo lúc:** {datetime.now().strftime('%d/%m/%Y %H:%M')}  ",
        f"> **Mô hình:** LightGBM v2 (Optuna tuned) — `09_cancellation_model_v2.ipynb`  ",
        f"> **Dữ liệu:** `hotel_bookings_v5.csv` — **{len(scores):,}** booking  ",
        f"> **Ngưỡng phân loại:** **{PREDICTION_THRESHOLD}**  ",
        f"> **File đầy đủ:** `data/11_cancellation_probability_scores.csv`",
        "",
        "---",
        "",
        "## 1. Mục tiêu",
        "",
        "Xuất **xác suất hủy dự đoán** `P(hủy)` cho **toàn bộ booking** trong dataset, phục vụ scoring / ưu tiên can thiệp.",
        "",
        "**Lưu ý:** Dataset không có cột `booking_id` — dùng **`booking_index`** (chỉ số dòng 0-based trong file CSV gốc) làm khóa tham chiếu.",
        "",
        "## 2. Cột trong file CSV",
        "",
        "| Cột | Mô tả |",
        "|-----|--------|",
        "| `booking_index` | Chỉ số dòng trong `hotel_bookings_v5.csv` |",
        "| `cancellation_probability` | P(hủy) từ mô hình (0–1) |",
        "| `predicted_cancel` | 1 nếu P(hủy) ≥ 0,35 |",
        "| `actual_cancel` | Nhãn thực tế `is_canceled` |",
        "| `risk_bucket` | Phân nhóm rủi ro (xem mục 3) |",
        "",
        "## 3. Thống kê tổng quan P(hủy)",
        "",
        f"| Chỉ số | Giá trị |",
        f"|--------|--------:|",
        f"| Mean P(hủy) | {proba.mean():.4f} |",
        f"| Median P(hủy) | {np.median(proba):.4f} |",
        f"| Std | {proba.std():.4f} |",
        f"| Min / Max | {proba.min():.4f} / {proba.max():.4f} |",
        f"| P25 / P75 | {np.percentile(proba, 25):.4f} / {np.percentile(proba, 75):.4f} |",
        f"| Booking dự đoán Hủy @ 0,35 | {pred.sum():,} ({pred.mean()*100:.1f}%) |",
        f"| Tỷ lệ hủy thực tế | {y.mean()*100:.2f}% |",
        "",
        "### Phân nhóm rủi ro",
        "",
        "| Nhóm | Số booking | Mean P(hủy) | Tỷ lệ hủy thực tế |",
        "|------|----------:|------------:|------------------:|",
    ]
    for _, row in bucket_stats.iterrows():
        lines1.append(
            f"| {row['risk_bucket']} | {int(row['bookings']):,} | "
            f"{row['mean_prob']:.4f} | {row['actual_cancel_rate']*100:.1f}% |"
        )

    lines1 += [
        "",
        "## 4. Mẫu 15 booking rủi ro cao nhất",
        "",
        "| booking_index | P(hủy) | Dự đoán | Thực tế |",
        "|:-------------:|-------:|:-------:|:-------:|",
    ]
    for _, row in top_risk.iterrows():
        lines1.append(
            f"| {int(row['booking_index'])} | {row['cancellation_probability']:.4f} | "
            f"{int(row['predicted_cancel'])} | {int(row['actual_cancel'])} |"
        )

    lines1 += [
        "",
        "## 5. Cách sử dụng",
        "",
        "1. Join `booking_index` với bản ghi gốc để lấy thông tin chi tiết booking.",
        "2. Sắp xếp giảm dần `cancellation_probability` để ưu tiên can thiệp.",
        "3. Kết hợp với báo cáo `11_cancellation_probability_by_variable.md` để hiểu driver theo segment.",
        "",
        "---",
        "",
        "*Sinh tự động bởi `_run_11_probability_reports.py`.*",
    ]
    REPORT_SCORES.write_text("\n".join(lines1), encoding="utf-8")

    # --- Report 2: by categorical variable ---
    enriched = model_df.copy()
    enriched["cancellation_probability"] = proba
    enriched["predicted_cancel"] = pred

    lines2 = [
        "# Báo cáo cancellation probability — theo giá trị biến phân loại",
        "",
        f"> **Tạo lúc:** {datetime.now().strftime('%d/%m/%Y %H:%M')}  ",
        f"> **Mô hình:** LightGBM v2 (Optuna tuned)  ",
        f"> **Phạm vi:** {len(enriched):,} booking | Ngưỡng: **{PREDICTION_THRESHOLD}**  ",
        f"> **Đi kèm:** `data/11_cancellation_probability_scores.csv`",
        "",
        "---",
        "",
        "## 1. Mục tiêu",
        "",
        "Bảng **mean P(hủy)** theo từng **giá trị biến phân loại** (6 biến v2), so sánh với **tỷ lệ hủy thực tế** và **tỷ lệ dự đoán Hủy @ 0,35**.",
        "",
        "| Cột bảng | Ý nghĩa |",
        "|----------|---------|",
        "| `n` | Số booking |",
        "| `mean_P_huy` | Trung bình xác suất hủy dự đoán |",
        "| `actual_cancel_%` | Tỷ lệ `is_canceled=1` thực tế |",
        "| `predicted_cancel_%` | Tỷ lệ dự đoán Hủy @ 0,35 |",
        "",
    ]

    for var in CATEGORICAL_FEATURES:
        tbl = (
            enriched.groupby(var, observed=True)
            .agg(
                n=("cancellation_probability", "count"),
                mean_P_huy=("cancellation_probability", "mean"),
                actual_cancel_pct=(TARGET_COLUMN, "mean"),
                predicted_cancel_pct=("predicted_cancel", "mean"),
            )
            .reset_index()
            .sort_values("mean_P_huy", ascending=False)
        )
        lines2 += [
            f"## {var}",
            "",
            f"*{len(tbl)} giá trị — sắp xếp theo mean P(hủy) giảm dần.*",
            "",
            f"| {var} | n | mean P(hủy) | Hủy thực tế % | Dự đoán Hủy % |",
            f"|{'-' * len(var)}|--:|------------:|--------------:|--------------:|",
        ]
        for _, row in tbl.iterrows():
            lines2.append(
                f"| `{row[var]}` | {int(row['n']):,} | {row['mean_P_huy']:.4f} | "
                f"{row['actual_cancel_pct']*100:.1f}% | {row['predicted_cancel_pct']*100:.1f}% |"
            )
        lines2.append("")

        top3 = tbl.head(3)
        bot3 = tbl.tail(3).iloc[::-1]
        lines2.append("**Top 3 rủi ro cao:** " + ", ".join(
            f"`{r[var]}` ({r['mean_P_huy']:.3f})" for _, r in top3.iterrows()
        ) + "  ")
        lines2.append("**Top 3 rủi ro thấp:** " + ", ".join(
            f"`{r[var]}` ({r['mean_P_huy']:.3f})" for _, r in bot3.iterrows()
        ) + "  ")
        lines2 += ["", "---", ""]

    lines2 += [
        "## Ghi chú",
        "",
        "- Mean P(hủy) theo nhóm **không đồng nghĩa** xác suất nhân quả — chỉ phản ánh scoring trung bình của mô hình trên segment đó.",
        "- Biến `country` có nhiều mức hiếm; các nước ít booking có mean P(hủy) biến động mạnh.",
        "- So sánh `actual_cancel_%` vs `mean_P_huy` giúp đánh giá calibration theo segment.",
        "",
        "*Sinh tự động bởi `_run_11_probability_reports.py`.*",
    ]
    REPORT_BY_VAR.write_text("\n".join(lines2), encoding="utf-8")

    print(f"Scores CSV: {SCORES_CSV}")
    print(f"Report 1: {REPORT_SCORES}")
    print(f"Report 2: {REPORT_BY_VAR}")


if __name__ == "__main__":
    main()
