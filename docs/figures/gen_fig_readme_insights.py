#!/usr/bin/env python3
"""Publication-style insight charts for the project README."""
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

OUT = Path(__file__).resolve().parent
DATA = Path(__file__).resolve().parents[2] / "data" / "hotel_bookings_v5.csv"

plt.rcParams.update({
    "font.family": "sans-serif",
    "font.sans-serif": ["Segoe UI", "DejaVu Sans", "Arial"],
    "font.size": 10,
    "axes.titlesize": 12,
    "axes.titleweight": "bold",
    "axes.labelsize": 10,
    "legend.fontsize": 9,
    "legend.frameon": False,
    "figure.dpi": 300,
    "savefig.dpi": 300,
    "savefig.bbox": "tight",
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.grid": True,
    "grid.alpha": 0.18,
    "grid.linestyle": "-",
})

CITY = "#264653"
RESORT = "#E76F51"
TEAL = "#2A9D8F"
GOLD = "#E9C46A"
INK = "#1F2933"


def fig_cancel_lead():
    df = pd.read_csv(DATA, usecols=["hotel", "is_canceled", "lead_time"])
    bins = [0, 8, 31, 91, 181, 10_000]
    labels = ["0–7 ngày", "8–30 ngày", "31–90 ngày", "91–180 ngày", "180+ ngày"]
    df["lead_bin"] = pd.cut(df["lead_time"], bins=bins, right=False, labels=labels)
    rates = (
        df.groupby(["hotel", "lead_bin"], observed=True)["is_canceled"]
        .mean()
        .unstack("hotel")
        * 100
    )
    rates = rates.reindex(labels)

    fig, ax = plt.subplots(figsize=(7.2, 3.6))
    x = np.arange(len(labels))
    w = 0.38
    b1 = ax.bar(x - w / 2, rates["City Hotel"], w, label="City Hotel", color=CITY, edgecolor="white", linewidth=0.4)
    b2 = ax.bar(x + w / 2, rates["Resort Hotel"], w, label="Resort Hotel", color=RESORT, edgecolor="white", linewidth=0.4)
    ax.axhline(28.12, color=INK, linestyle="--", linewidth=1.0, alpha=0.7, label="Toàn portfolio 28,1%")
    ax.set_xticks(x)
    ax.set_xticklabels(labels)
    ax.set_ylabel("Tỷ lệ hủy (%)")
    ax.set_xlabel("Lead time (ngày đặt trước ngày đến)")
    ax.set_title("Hủy tăng theo lead time — bước nhảy lớn sau 30 ngày")
    ax.set_ylim(0, 58)
    ax.legend(loc="upper left", ncol=3)
    for bars in (b1, b2):
        for bar in bars:
            h = bar.get_height()
            ax.text(bar.get_x() + bar.get_width() / 2, h + 0.8, f"{h:.0f}", ha="center", va="bottom", fontsize=7.5, color="#444")
    fig.savefig(OUT / "fig_cancel_lead.png")
    fig.savefig(OUT / "fig_cancel_lead.pdf")
    plt.close(fig)


def fig_cancel_drivers_city_resort():
    """|association| with is_canceled after dropping leakage (notebook 04b)."""
    labels = [
        "Yêu cầu đặc biệt  |r|",
        "Loại cọc  V",
        "Lead time  r",
        "Market segment  V",
        "Chỗ đậu xe  |r|",
        "ADR  r",
        "Tháng đến  V",
    ]
    city = np.array([0.170, 0.183, 0.204, 0.198, 0.129, 0.081, 0.065])
    resort = np.array([0.059, 0.102, 0.193, 0.239, 0.244, 0.168, 0.143])

    fig, ax = plt.subplots(figsize=(7.2, 4.2))
    y = np.arange(len(labels))
    h = 0.36
    b1 = ax.barh(y - h / 2, city, h, label="City Hotel", color=CITY, edgecolor="white", linewidth=0.4)
    b2 = ax.barh(y + h / 2, resort, h, label="Resort Hotel", color=RESORT, edgecolor="white", linewidth=0.4)
    ax.set_yticks(y)
    ax.set_yticklabels(labels)
    ax.set_xlabel("|Tương quan| với hủy  (Pearson r hoặc Cramér's V)")
    ax.set_title("Tín hiệu hủy: cùng dấu, khác trọng số khi tách hotel")
    ax.set_xlim(0, 0.32)
    ax.invert_yaxis()
    ax.legend(loc="lower right")
    for bars in (b1, b2):
        for bar in bars:
            w = bar.get_width()
            ax.text(w + 0.004, bar.get_y() + bar.get_height() / 2, f"{w:.2f}",
                    va="center", ha="left", fontsize=7.5, color="#444")
    ax.annotate("Mạnh hơn ở City", xy=(0.183, 1), xytext=(0.248, 0.55),
                fontsize=8, color=CITY, arrowprops=dict(arrowstyle="-", color=CITY, lw=0.6))
    ax.annotate("Mạnh hơn ở Resort", xy=(0.244, 4), xytext=(0.248, 4.85),
                fontsize=8, color=RESORT, arrowprops=dict(arrowstyle="-", color=RESORT, lw=0.6))
    fig.savefig(OUT / "fig_cancel_drivers_city_resort.png")
    fig.savefig(OUT / "fig_cancel_drivers_city_resort.pdf")
    plt.close(fig)


def fig_asymmetric_pricing():
    hotels = ["City Hotel\nPeak", "Resort Hotel\nPeak"]
    delta = [2.3, -2.1]
    colors = [TEAL, RESORT]
    fig, ax = plt.subplots(figsize=(6.4, 3.4))
    y = np.arange(len(hotels))
    bars = ax.barh(y, delta, color=colors, height=0.48, edgecolor="white", linewidth=0.5)
    ax.axvline(0, color=INK, linewidth=1.0)
    ax.set_yticks(y)
    ax.set_yticklabels(hotels)
    ax.set_xlabel("Δ RevPAR khi tăng ADR +10% (điểm %)")
    ax.set_title("Một chính sách giá cho cả hai property làm giảm RevPAR")
    ax.set_xlim(-4.5, 4.5)
    ax.invert_yaxis()
    for bar, val in zip(bars, delta):
        side = "left" if val < 0 else "right"
        offset = -0.18 if val < 0 else 0.18
        ax.text(val + offset, bar.get_y() + bar.get_height() / 2, f"{val:+.1f}%", va="center", ha=side, fontsize=10, fontweight="bold", color=INK)
    ax.annotate("ε ≈ −0,70 · harden BAR", xy=(2.3, 0), xytext=(3.2, 0.42), fontsize=8, color=CITY, arrowprops=dict(arrowstyle="-", color=CITY, lw=0.6))
    ax.annotate(
        "ε ≈ −1,10 · cấm shock giá",
        xy=(-2.1, 0.78),
        xytext=(-3.85, 0.36),
        fontsize=8,
        color=RESORT,
        ha="left",
        va="center",
        arrowprops=dict(arrowstyle="-", color=RESORT, lw=0.6),
    )
    fig.savefig(OUT / "fig_asymmetric_pricing.png")
    fig.savefig(OUT / "fig_asymmetric_pricing.pdf")
    plt.close(fig)


if __name__ == "__main__":
    fig_cancel_lead()
    fig_cancel_drivers_city_resort()
    fig_asymmetric_pricing()
    print("Wrote", OUT / "fig_cancel_lead.png")
    print("Wrote", OUT / "fig_cancel_drivers_city_resort.png")
    print("Wrote", OUT / "fig_asymmetric_pricing.png")
