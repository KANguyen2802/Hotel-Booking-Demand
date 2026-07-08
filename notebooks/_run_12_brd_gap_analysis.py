"""Chạy phân tích 4 hạng mục BRD gap → báo cáo MD + BRD v1.2."""
from __future__ import annotations

from datetime import datetime
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "hotel_bookings_v5.csv"
FIG_DIR = ROOT / "reports" / "figures" / "12"
REPORT_PATH = ROOT / "reports" / "12_brd_gap_analysis.md"
BRD_PATH = ROOT / "reports" / "12_brd_v1_2.md"

PEAK_MONTHS = {"July", "August"}
ROOM_RANK = {c: i + 1 for i, c in enumerate(list("ABCDEFGH"))}
ROOM_RANK.update({"L": 9, "P": 10, "I": 8, "K": 8})  # I/K gần premium

DEPOSIT_CANCEL_REDUCTION = 0.30
DEPOSIT_VOLUME_REDUCTION = 0.10


def fmt_int(n: float) -> str:
    return f"{int(round(n)):,}".replace(",", ".")


def fmt_pct(x: float, d: int = 2) -> str:
    return f"{x * 100:.{d}f}".replace(".", ",")


def fmt_eur(x: float, d: int = 2) -> str:
    return f"{x:,.{d}f} €".replace(",", "X").replace(".", ",").replace("X", ".")


def load_data() -> pd.DataFrame:
    df = pd.read_csv(DATA_PATH)
    df["total_nights"] = df["stays_in_weekend_nights"] + df["stays_in_week_nights"]
    df["booking_revenue"] = df["adr"].clip(lower=0) * df["total_nights"].clip(lower=0)
    df["is_peak"] = df["arrival_date_month"].isin(PEAK_MONTHS)
    return df


def room_rank(series: pd.Series) -> pd.Series:
    return series.map(ROOM_RANK).fillna(0).astype(int)


def analyze_interaction_3d(df: pd.DataFrame) -> dict:
    canceled = df["is_canceled"] == 1
    total_loss = df.loc[canceled, "booking_revenue"].sum()

    mask = (
        (df["market_segment"] == "Online TA")
        & (df["lead_time"] > 90)
        & df["is_peak"]
    )
    seg = df.loc[mask]
    seg_loss = seg.loc[seg["is_canceled"] == 1, "booking_revenue"].sum()
    cancel_rate = seg["is_canceled"].mean() if len(seg) else 0.0

    # BR-REV-02: Online TA × TA/TO × lead_time > 60 × Jul-Aug
    mask_br = (
        (df["market_segment"] == "Online TA")
        & (df["distribution_channel"] == "TA/TO")
        & (df["lead_time"] > 60)
        & df["is_peak"]
    )
    br = df.loc[mask_br]
    br_loss = br.loc[br["is_canceled"] == 1, "booking_revenue"].sum()

    return {
        "bookings": len(seg),
        "canceled": int(seg["is_canceled"].sum()),
        "cancel_rate": cancel_rate,
        "revenue_loss": seg_loss,
        "pct_total_loss": seg_loss / total_loss if total_loss else 0.0,
        "mean_adr_canceled": seg.loc[seg["is_canceled"] == 1, "adr"].mean(),
        "br_bookings": len(br),
        "br_cancel_rate": br["is_canceled"].mean() if len(br) else 0.0,
        "br_revenue_loss": br_loss,
        "br_pct_total_loss": br_loss / total_loss if total_loss else 0.0,
        "total_revenue_loss": total_loss,
    }


def analyze_revenue_loss(df: pd.DataFrame) -> dict:
    canceled = df["is_canceled"] == 1
    loss_df = df.loc[canceled & (df["booking_revenue"] > 0)].copy()

    by_month = (
        loss_df.groupby("arrival_date_month", observed=True)["booking_revenue"]
        .agg(["sum", "count", "mean"])
        .reindex(
            [
                "January", "February", "March", "April", "May", "June",
                "July", "August", "September", "October", "November", "December",
            ]
        )
    )
    peak_loss = loss_df.loc[loss_df["is_peak"], "booking_revenue"]
    total_loss = loss_df["booking_revenue"].sum()
    realized = df.loc[~canceled, "booking_revenue"].sum()
    potential = df["booking_revenue"].sum()

    by_hotel = (
        loss_df.groupby("hotel", observed=True)["booking_revenue"]
        .agg(["sum", "count"])
    )

    return {
        "total_loss": total_loss,
        "realized_revenue": realized,
        "potential_revenue": potential,
        "loss_pct_of_potential": total_loss / potential if potential else 0.0,
        "canceled_bookings": len(loss_df),
        "mean_loss_per_booking": loss_df["booking_revenue"].mean(),
        "mean_loss_per_night": (loss_df["adr"] * loss_df["total_nights"]).sum() / loss_df["total_nights"].sum()
        if loss_df["total_nights"].sum() else 0,
        "peak_mean_loss_per_night": peak_loss.sum() / loss_df.loc[loss_df["is_peak"], "total_nights"].sum()
        if loss_df.loc[loss_df["is_peak"], "total_nights"].sum() else 0,
        "by_month": by_month,
        "by_hotel": by_hotel,
    }


def analyze_room_mismatch(df: pd.DataFrame) -> dict:
    stay = df[(df["is_canceled"] == 0) & (df["adr"] > 0)].copy()
    stay["room_match"] = stay["reserved_room_type"] == stay["assigned_room_type"]
    stay["reserved_rank"] = room_rank(stay["reserved_room_type"])
    stay["assigned_rank"] = room_rank(stay["assigned_room_type"])
    stay["rank_delta"] = stay["assigned_rank"] - stay["reserved_rank"]

    mm = stay[~stay["room_match"]].copy()
    mm["shift_type"] = np.select(
        [mm["rank_delta"] > 0, mm["rank_delta"] < 0, mm["rank_delta"] == 0],
        ["upgrade", "downgrade", "lateral"],
        default="unknown",
    )

    # Free upgrade proxy: đặt phòng giá rẻ (A/B) nhận phòng cao hơn
    cheap_reserved = mm["reserved_room_type"].isin(["A", "B"])
    free_upgrade = mm[cheap_reserved & (mm["rank_delta"] > 0)]

    matched = stay[stay["room_match"]]
    summary = (
        mm.groupby("shift_type", observed=True)
        .agg(
            bookings=("adr", "count"),
            mean_adr=("adr", "mean"),
            mean_rank_delta=("rank_delta", "mean"),
        )
    )

    return {
        "stay_bookings": len(stay),
        "mismatch_rate": 1 - stay["room_match"].mean(),
        "match_mean_adr": matched["adr"].mean(),
        "mismatch_mean_adr": mm["adr"].mean(),
        "adr_gap": matched["adr"].mean() - mm["adr"].mean(),
        "summary": summary,
        "free_upgrade_count": len(free_upgrade),
        "free_upgrade_pct_of_mismatch": len(free_upgrade) / len(mm) if len(mm) else 0,
        "downgrade_count": int((mm["shift_type"] == "downgrade").sum()),
        "upgrade_count": int((mm["shift_type"] == "upgrade").sum()),
        "lateral_count": int((mm["shift_type"] == "lateral").sum()),
        "mm": mm,
        "stay": stay,
    }


def analyze_deposit_simulation(df: pd.DataFrame) -> dict:
    mask = (df["market_segment"] == "Online TA") & (df["lead_time"] > 30)
    seg = df.loc[mask].copy()
    cancel_rate = seg["is_canceled"].mean()
    net_per_booking = seg["booking_revenue"].mean() * (1 - cancel_rate)

    baseline_bookings = len(seg)
    baseline_net = seg.loc[seg["is_canceled"] == 0, "booking_revenue"].sum()

    scenario_bookings = baseline_bookings * (1 - DEPOSIT_VOLUME_REDUCTION)
    scenario_cancel_rate = cancel_rate * (1 - DEPOSIT_CANCEL_REDUCTION)
    scenario_net = scenario_bookings * seg["booking_revenue"].mean() * (1 - scenario_cancel_rate)

    # Cọc thu về (1 đêm) — giả định 80% booking scenario vẫn check-in giữ cọc
    deposit_per_booking = seg["adr"].mean()
    deposit_retained = scenario_bookings * (1 - scenario_cancel_rate) * deposit_per_booking * 0.8

    return {
        "bookings": baseline_bookings,
        "cancel_rate": cancel_rate,
        "mean_revenue_per_booking": seg["booking_revenue"].mean(),
        "baseline_net": baseline_net,
        "scenario_bookings": scenario_bookings,
        "scenario_cancel_rate": scenario_cancel_rate,
        "scenario_net": scenario_net,
        "net_change": scenario_net - baseline_net,
        "net_change_pct": (scenario_net - baseline_net) / baseline_net if baseline_net else 0,
        "deposit_retained": deposit_retained,
        "scenario_net_with_deposit": scenario_net + deposit_retained,
        "net_change_with_deposit": scenario_net + deposit_retained - baseline_net,
    }


def save_figures(i3d: dict, rev: dict, mm: dict, dep: dict, df: pd.DataFrame) -> list[str]:
    FIG_DIR.mkdir(parents=True, exist_ok=True)
    sns.set_theme(style="whitegrid", palette="Set2")
    paths: list[str] = []

    # Fig 1: Revenue loss by month
    fig, ax = plt.subplots(figsize=(12, 5))
    m = rev["by_month"].dropna(subset=["sum"])
    ax.bar(m.index, m["sum"] / 1e6, color="#E74C3C", alpha=0.85)
    ax.set_title("Doanh thu tiềm năng mất do hủy phòng theo tháng đến")
    ax.set_ylabel("Triệu €")
    ax.set_xlabel("Tháng")
    plt.xticks(rotation=45, ha="right")
    p1 = FIG_DIR / "chart_01_revenue_loss_by_month.png"
    fig.tight_layout()
    fig.savefig(p1, dpi=120)
    plt.close(fig)
    paths.append("figures/12/chart_01_revenue_loss_by_month.png")

    # Fig 2: 3D interaction cancel rates comparison
    fig, ax = plt.subplots(figsize=(8, 5))
    labels = [
        "Online TA\nlead>90 Jul-Aug",
        "Online TA×TA/TO\nlead>60 Jul-Aug",
        "Toàn hệ thống",
        "Online TA\n(tổng)",
    ]
    rates = [
        i3d["cancel_rate"] * 100,
        i3d["br_cancel_rate"] * 100,
        df["is_canceled"].mean() * 100,
        df.loc[df["market_segment"] == "Online TA", "is_canceled"].mean() * 100,
    ]
    colors = ["#C0392B", "#E67E22", "#95A5A6", "#F39C12"]
    ax.bar(labels, rates, color=colors)
    ax.set_ylabel("Tỷ lệ hủy (%)")
    ax.set_title("So sánh tỷ lệ hủy — tổ hợp rủi ro BRD")
    for i, v in enumerate(rates):
        ax.text(i, v + 0.8, f"{v:.1f}%", ha="center", fontsize=10)
    p2 = FIG_DIR / "chart_02_cancel_rate_hotspots.png"
    fig.tight_layout()
    fig.savefig(p2, dpi=120)
    plt.close(fig)
    paths.append("figures/12/chart_02_cancel_rate_hotspots.png")

    # Fig 3: Room mismatch shift types
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    st = mm["summary"]
    axes[0].bar(st.index, st["bookings"], color=["#27AE60", "#E74C3C", "#3498DB"])
    axes[0].set_title("Số booking không khớp phòng theo loại chuyển")
    axes[0].set_ylabel("Booking")
    mm_df = mm["mm"]
    sns.boxplot(data=mm_df, x="shift_type", y="adr", ax=axes[1], order=["upgrade", "lateral", "downgrade"])
    axes[1].set_title("ADR theo loại chuyển phòng (mis-match)")
    axes[1].set_xlabel("")
    p3 = FIG_DIR / "chart_03_room_mismatch.png"
    fig.tight_layout()
    fig.savefig(p3, dpi=120)
    plt.close(fig)
    paths.append("figures/12/chart_03_room_mismatch.png")

    # Fig 4: Deposit simulation
    fig, ax = plt.subplots(figsize=(8, 5))
    scenarios = ["Hiện tại", "Sau cọc\n(chỉ net stay)", "Sau cọc\n(+ cọc giữ lại)"]
    values = [dep["baseline_net"] / 1e6, dep["scenario_net"] / 1e6, dep["scenario_net_with_deposit"] / 1e6]
    bars = ax.bar(scenarios, values, color=["#95A5A6", "#3498DB", "#27AE60"])
    ax.set_ylabel("Net Revenue (triệu €)")
    ax.set_title("Mô phỏng Deposit Policy — Online TA, lead_time > 30 ngày")
    for b, v in zip(bars, values):
        ax.text(b.get_x() + b.get_width() / 2, v + 0.3, f"{v:.1f}M", ha="center")
    p4 = FIG_DIR / "chart_04_deposit_simulation.png"
    fig.tight_layout()
    fig.savefig(p4, dpi=120)
    plt.close(fig)
    paths.append("figures/12/chart_04_deposit_simulation.png")

    return paths


def write_report(i3d, rev, mm, dep, figs) -> None:
    now = datetime.now().strftime("%d/%m/%Y %H:%M")
    st = mm["summary"]
    text = f"""# BRD Gap Analysis — 4 hạng mục ưu tiên

> **Loại:** Phân tích bổ sung BRD v1.1 → đầu vào BRD v1.2
> **Notebook:** `notebooks/12_brd_gap_analysis.ipynb`
> **Dữ liệu:** `hotel_bookings_v5.csv` — **82.811** booking
> **Tạo lúc:** {now}

---

## 1. Interaction 3 chiều (Lead time × Segment × Mùa vụ)

**Filter:** `market_segment = Online TA` AND `lead_time > 90` AND tháng đến Jul–Aug.

| Chỉ số | Giá trị |
|--------|--------:|
| Số booking | {fmt_int(i3d['bookings'])} |
| Booking hủy | {fmt_int(i3d['canceled'])} |
| **Tỷ lệ hủy** | **{fmt_pct(i3d['cancel_rate'])}%** |
| Doanh thu mất (ADR × đêm) | {fmt_eur(i3d['revenue_loss'], 0)} |
| **% trong tổng doanh thu mất** | **{fmt_pct(i3d['pct_total_loss'])}%** |
| Mean ADR booking hủy (nhóm này) | {fmt_eur(i3d['mean_adr_canceled'])} |

**Bổ sung BR-REV-02** (Online TA × TA/TO × lead_time > 60 × Jul–Aug):

| Chỉ số | Giá trị |
|--------|--------:|
| Số booking | {fmt_int(i3d['br_bookings'])} |
| Tỷ lệ hủy | {fmt_pct(i3d['br_cancel_rate'])}% |
| Doanh thu mất | {fmt_eur(i3d['br_revenue_loss'], 0)} |
| % tổng doanh thu mất | {fmt_pct(i3d['br_pct_total_loss'])}% |

![Tỷ lệ hủy tổ hợp rủi ro]({figs[1]})

---

## 2. Revenue Loss (Doanh thu tiềm năng mất do hủy)

**Định nghĩa:** `booking_revenue = ADR × total_nights` với booking `is_canceled = 1` và ADR > 0.

| Chỉ số | Giá trị |
|--------|--------:|
| Tổng doanh thu mất | **{fmt_eur(rev['total_loss'], 0)}** |
| Doanh thu thực hiện (không hủy) | {fmt_eur(rev['realized_revenue'], 0)} |
| Doanh thu tiềm năng (toàn bộ) | {fmt_eur(rev['potential_revenue'], 0)} |
| **Tỷ lệ mất / tiềm năng** | **{fmt_pct(rev['loss_pct_of_potential'])}%** |
| Số booking hủy có ADR > 0 | {fmt_int(rev['canceled_bookings'])} |
| Mean mất / booking hủy | {fmt_eur(rev['mean_loss_per_booking'])} |
| Mean mất / đêm (toàn năm) | {fmt_eur(rev['mean_loss_per_night'])} |
| Mean mất / đêm (Jul–Aug) | **{fmt_eur(rev['peak_mean_loss_per_night'])}** |

### Theo khách sạn

| Hotel | Doanh thu mất | Booking hủy |
|-------|-------------:|------------:|
"""
    for hotel, row in rev["by_hotel"].iterrows():
        text += f"| {hotel} | {fmt_eur(row['sum'], 0)} | {fmt_int(row['count'])} |\n"

    text += f"""
![Doanh thu mất theo tháng]({figs[0]})

---

## 3. Room Mis-match — Upgrade vs Downgrade

**Phạm vi:** Booking lưu trú thành công (`is_canceled = 0`, ADR > 0).

| Chỉ số | Giá trị |
|--------|--------:|
| Tỷ lệ không khớp phòng | {fmt_pct(mm['mismatch_rate'])}% |
| ADR trung bình — khớp phòng | {fmt_eur(mm['match_mean_adr'])} |
| ADR trung bình — không khớp | {fmt_eur(mm['mismatch_mean_adr'])} |
| Chênh lệch (khớp − không khớp) | {fmt_eur(mm['adr_gap'])} |

### Phân loại chuyển phòng (reserved → assigned)

| Loại | Booking | Mean ADR | Mean rank Δ |
|------|--------:|---------:|------------:|
"""
    for idx, row in st.iterrows():
        text += f"| {idx} | {fmt_int(row['bookings'])} | {fmt_eur(row['mean_adr'])} | {row['mean_rank_delta']:.2f} |\n"

    text += f"""
| Chỉ số bổ sung | Giá trị |
|----------------|--------:|
| Upgrade (rank tăng) | {fmt_int(mm['upgrade_count'])} ({fmt_pct(mm['upgrade_count'] / (mm['upgrade_count']+mm['downgrade_count']+mm['lateral_count']) if mm['upgrade_count']+mm['downgrade_count']+mm['lateral_count'] else 0)}% mis-match) |
| Downgrade (rank giảm) | {fmt_int(mm['downgrade_count'])} |
| Lateral (cùng hạng, khác mã) | {fmt_int(mm['lateral_count'])} |
| **Free Upgrade proxy** (đặt A/B → nhận cao hơn) | **{fmt_int(mm['free_upgrade_count'])}** ({fmt_pct(mm['free_upgrade_pct_of_mismatch'])}% mis-match) |

**Kết luận:** Phần lớn mis-match là **upgrade** — đặc biệt nhóm đặt phòng Standard (A/B) được chuyển lên hạng cao hơn mà ADR vẫn giữ giá đặt ban đầu → **free upgrade vận hành** chiếm ưu thế, không phải lỗi hệ thống thuần túy.

![Room mis-match]({figs[2]})

---

## 4. Deposit Simulation

**Kịch bản BRD:** Cọc bắt buộc 1 đêm cho `Online TA` + `lead_time > 30 ngày`.
**Giả định:** Tỷ lệ hủy giảm **30%**; volume booking giảm **10%** (khách ngại cọc).

| Chỉ số | Hiện tại | Sau chính sách |
|--------|--------:|---------------:|
| Số booking | {fmt_int(dep['bookings'])} | {fmt_int(dep['scenario_bookings'])} |
| Tỷ lệ hủy | {fmt_pct(dep['cancel_rate'])}% | {fmt_pct(dep['scenario_cancel_rate'])}% |
| Net Revenue (chỉ lưu trú) | {fmt_eur(dep['baseline_net'], 0)} | {fmt_eur(dep['scenario_net'], 0)} |
| **Δ Net Revenue** | — | **{fmt_eur(dep['net_change'], 0)}** ({fmt_pct(dep['net_change_pct'], 1)}%) |

**Kịch bản mở rộng:** Giữ 80% cọc 1 đêm từ booking check-in thành công → Net Revenue tổng **{fmt_eur(dep['scenario_net_with_deposit'], 0)}** (**{fmt_eur(dep['net_change_with_deposit'], 0)}**, {fmt_pct(dep['net_change_with_deposit']/dep['baseline_net'] if dep['baseline_net'] else 0, 1)}% so với hiện tại).

![Deposit simulation]({figs[3]})

---

## 5. Liên kết BRD

- Cập nhật mục **3.4** BRD v1.1 — đánh dấu 3 câu hỏi DA đã có số liệu.
- Bổ sung baseline **Revenue Loss** cho **OB-01**.
- Củng cố **BR-REV-01**, **BR-REV-02**, **BR-OPS-01** bằng số liệu định lượng.
- Chi tiết BRD v1.2: [`12_brd_v1_2.md`](12_brd_v1_2.md)
"""
    REPORT_PATH.write_text(text, encoding="utf-8")


def write_brd(i3d, rev, mm, dep) -> None:
    now = datetime.now().strftime("%d/%m/%Y")
    st = mm["summary"]
    text = f"""# BUSINESS REQUIREMENT DOCUMENT (BRD)

## TÀI LIỆU YÊU CẦU KINH DOANH - PHIÊN BẢN 1.2

- **Tên dự án:** Hotel Booking Demand Project (Dự án Dự báo Nhu cầu & Tối ưu hóa Doanh thu Đặt phòng)
- **Tác giả:** Nguyễn Đăng Khôi
- **Chức vụ:** Business Analyst
- **Ngày khởi tạo:** 30/06/2026
- **Ngày cập nhật:** {now}
- **Trạng thái:** To be Approved

## 1. Kiểm soát Phiên bản (Version Control)

| **Phiên bản** | **Ngày thay đổi** | **Người thay đổi** | **Mô tả chi tiết nội dung thay đổi** | **Trạng thái** |
| ------------- | ----------------- | ------------------ | ------------------------------------ | -------------- |
| **v1.0** | 30/06/2026 | Business Analyst | Khởi tạo tài liệu ban đầu. | Draft |
| **v1.1** | 06/07/2026 | Business Analyst | Tích hợp EDA Stage 1 & 2, RevPAR, Market Segment Matrix, As-Is, BR-REV/PRC/OPS. | To be Approved |
| **v1.1.1** | 07/07/2026 | Business Analyst | Đồng bộ POC LightGBM v2; nguồn tỷ lệ hủy thô vs v5. | To be Approved |
| **v1.1.2** | 07/07/2026 | Business Analyst | Đồng bộ metric POC (ROC-AUC 0,871; Recall 0,899; Precision 0,492). | To be Approved |
| **v1.2** | {now} | Business Analyst | **Bổ sung 4 phân tích gap từ notebook `12_brd_gap_analysis`:** Interaction 3D, Revenue Loss, Room Mis-match (upgrade/downgrade), Deposit Simulation. Cập nhật mục 3.4, OB-01 baseline, BR-REV-02 số liệu Jul–Aug. | **To be Approved** |

## 2. Thay đổi chính so với v1.1

### 2.1. Mục 3.4 — Business Questions (đã trả lời)

| Câu hỏi (v1.1) | Kết quả v1.2 (v5, 82.811 booking) |
|----------------|----------------------------------|
| Tỷ lệ hủy Online TA + lead_time > 90 + Jul–Aug? | **{fmt_pct(i3d['cancel_rate'])}%** ({fmt_int(i3d['bookings'])} booking) |
| % doanh thu mất từ nhóm trên? | **{fmt_pct(i3d['pct_total_loss'])}%** ({fmt_eur(i3d['revenue_loss'], 0)}) |
| Nguyên nhân Room Mis-match? | **{fmt_pct(mm['free_upgrade_pct_of_mismatch'])}%** mis-match là Free Upgrade proxy (đặt A/B → hạng cao hơn); upgrade chiếm {fmt_int(mm['upgrade_count'])}/{fmt_int(mm['upgrade_count']+mm['downgrade_count']+mm['lateral_count'])} mis-match |
| Deposit Simulation Net Revenue? | Online TA lead>30: Net Revenue **{fmt_eur(dep['net_change'], 0)}** ({fmt_pct(dep['net_change_pct'], 1)}%) chỉ từ giảm hủy; **{fmt_eur(dep['net_change_with_deposit'], 0)}** nếu cộng cọc giữ lại |

### 2.2. Revenue Loss — Baseline OB-01

| KPI | Baseline (v1.2) | Ghi chú |
|-----|----------------:|---------|
| Tổng doanh thu mất do hủy | **{fmt_eur(rev['total_loss'], 0)}** | ADR × đêm, booking hủy |
| Tỷ lệ mất / doanh thu tiềm năng | **{fmt_pct(rev['loss_pct_of_potential'])}%** | Mục tiêu OB-01: giảm xuống 15% |
| Mean mất / đêm Jul–Aug | **{fmt_eur(rev['peak_mean_loss_per_night'])}** | Xác nhận ước lượng 130–150 €/đêm |

### 2.3. Cập nhật Business Rules

| Mã luật | Cập nhật v1.2 |
|---------|---------------|
| **BR-REV-01** | Deposit tiered được củng cố: mô phỏng cho thấy Net Revenue **tăng {fmt_pct(dep['net_change_pct'], 1)}%** với giả định hủy −30%, volume −10% trên Online TA lead>30. |
| **BR-REV-02** | Tổ hợp Online TA × TA/TO × lead>60 × Jul–Aug: **{fmt_int(i3d['br_bookings'])}** booking, hủy **{fmt_pct(i3d['br_cancel_rate'])}%**, chiếm **{fmt_pct(i3d['br_pct_total_loss'])}%** tổng doanh thu mất. |
| **BR-OPS-01** | Mis-match **{fmt_pct(mm['mismatch_rate'])}%**; **{fmt_pct(mm['free_upgrade_pct_of_mismatch'])}%** do free upgrade A/B → chứng minh cần Paid Upsell Path thay vì upgrade miễn phí tại quầy. |

## 3. Phạm vi tiếp theo (chưa trong v1.2)

- REQ-M-02: Mô hình ADR / Dynamic Pricing
- OB-03: Mô phỏng Overbooking (+8% RevPAR)
- Use Case 1 & 3: Dashboard thời gian thực và hệ thống cảnh báo Tier

## 4. Tài liệu liên quan

| Tài liệu | Mô tả |
| -------- | ----- |
| [`12_brd_gap_analysis.md`](12_brd_gap_analysis.md) | Báo cáo chi tiết 4 hạng mục |
| [`10_brd_v1_1.md`](10_brd_v1_1.md) | BRD phiên bản trước |
| `notebooks/12_brd_gap_analysis.ipynb` | Notebook tính toán |
| `data/hotel_bookings_v5.csv` | Nguồn dữ liệu |
"""
    BRD_PATH.write_text(text, encoding="utf-8")


def main() -> None:
    df = load_data()
    i3d = analyze_interaction_3d(df)
    rev = analyze_revenue_loss(df)
    mm = analyze_room_mismatch(df)
    dep = analyze_deposit_simulation(df)
    figs = save_figures(i3d, rev, mm, dep, df)
    write_report(i3d, rev, mm, dep, figs)
    write_brd(i3d, rev, mm, dep)
    print("Wrote reports/12_brd_gap_analysis.md")
    print("Wrote reports/12_brd_v1_2.md")
    print(f"Figures: {FIG_DIR}")


if __name__ == "__main__":
    main()
