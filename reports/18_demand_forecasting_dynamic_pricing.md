# 18 — Demand Forecasting for Dynamic Pricing (statsmodels)

> **Nguồn dữ liệu:** `hotel_bookings_v5.csv`  
> **Phạm vi:** stay bookings (`is_canceled = 0`) · 59.527 booking · 26 tháng (2015-07 → 2017-08)  
> **Skill:** [`statsmodels`](../.cursor/skills/statsmodels/SKILL.md) — Workflow 4 Time Series Forecasting  
> **Library:** statsmodels **0.14.6**  
> **Notebook:** [`notebooks/18_demand_forecasting_dynamic_pricing.ipynb`](../notebooks/18_demand_forecasting_dynamic_pricing.ipynb)  
> **Figures:** [`reports/figures/18/`](./figures/18/) · KPI: [`kpi_summary.csv`](./figures/18/kpi_summary.csv)

---

## Mục tiêu

Dự báo demand tháng cho dynamic pricing theo pipeline **statsmodels**:

1. Plot + `seasonal_decompose`  
2. Stationarity **ADF / KPSS** → chọn `d`, `D`  
3. **ACF / PACF**  
4. **SARIMAX** grid (AIC/BIC) + **Holt–Winters / Holt**  
5. Residual diagnostics (`plot_diagnostics`, Ljung–Box)  
6. Forecast có **95% prediction interval**  
7. Holdout vs **Seasonal Naive** baseline  

---

## 1. Series & decomposition

![Monthly demand](./figures/18/01_monthly_demand_overall.png)

![Seasonal decompose](./figures/18/02_seasonal_decompose.png)

---

## 2. Stationarity (ADF + KPSS)

| Series | n | ADF p | ADF stationary | KPSS p | KPSS stationary |
|---|---:|---:|:---:|---:|:---:|
| level | 26 | 0,091 | No | 0,044 | No |
| **diff1** | 25 | ≈0 | **Yes** | 0,100 | **Yes** |
| seasonal_diff12 | 14 | ≈0 | Yes | 0,018 | No |
| diff1_seasonal12 | 13 | ≈0 | Yes | 0,100 | Yes |

**Chọn differencing:** `d=1`, `D=0` (ưu tiên phương án ít “đốt” mẫu hơn khi cả ADF+KPSS đạt trên chuỗi ngắn).

![ACF/PACF](./figures/18/03_acf_pacf.png)

---

## 3. SARIMAX selection (train AIC)

Train = 20 tháng đầu · Test/holdout = 6 tháng cuối.

**Best by AIC:** `SARIMAX(0,1,2)×(1,0,1,12)`  
- AIC ≈ **62,8** · BIC ≈ **59,7** · LLF ≈ −26,4  

(Grid lưu tại [`sarimax_aic_grid.csv`](./figures/18/sarimax_aic_grid.csv).)

### Residual diagnostics (train)

![SARIMAX diagnostics](./figures/18/04_sarimax_diagnostics.png)

| Model | Ljung–Box p (lag 6) | Ljung–Box p (lag 12) |
|---|---:|---:|
| SARIMAX | 0,17 | 0,18 |
| Holt trend (train fallback) | 0,32 | 0,28 |

→ Không bác bỏ white-noise residuals ở α=0,05 (lag 6/12).

**Lưu ý HW:** train chỉ 20 tháng (< 2×12) → statsmodels không khởi tạo seasonal HW được → dùng **Holt trend-only** trên holdout; full sample (26 tháng) fit được **Holt–Winters seasonal**.

---

## 4. Holdout accuracy (6 tháng)

![Holdout forecasts + PI](./figures/18/05_holdout_forecasts.png)

![Holdout MAPE](./figures/18/05_holdout_metrics.png)

| Model | MAE | RMSE | MAPE |
|---|---:|---:|---:|
| **Seasonal Naive** | 189,2 | 207,3 | **6,9%** |
| Holt trend | 221,9 | 250,7 | 8,1% |
| SARIMAX(0,1,2)(1,0,1)₁₂ | 251,8 | 285,3 | 9,1% |

- **Best holdout:** Seasonal Naive (MAPE 6,9%).  
- SARIMAX **95% PI coverage** trên holdout: **100%** (interval rộng — đúng với chuỗi ngắn).  
- AIC tốt trên train ≠ thắng holdout: với n≈26, **ưu tiên out-of-sample MAPE** cho pricing.

---

## 5. Forecast 6 tháng (full-sample refit)

Primary cho stance pricing = model thắng holdout → **Seasonal Naive**.  
SARIMAX / Holt–Winters giữ làm đối chứng + interval.

![Forecast horizon](./figures/18/07_forecast_horizon.png)

| Tháng | Seasonal Naive | SARIMAX | SARIMAX 95% PI | Holt–Winters |
|---|---:|---:|---|---:|
| 2017-09 | 2.573 | 2.620 | [2.301, 2.939] | 2.659 |
| 2017-10 | 2.790 | 2.891 | [2.534, 3.247] | 2.758 |
| 2017-11 | 2.408 | 2.705 | [2.348, 3.061] | 2.198 |
| 2017-12 | 2.027 | 2.337 | [1.980, 2.693] | 2.125 |
| 2018-01 | 1.966 | 2.299 | [1.942, 2.656] | 2.061 |
| 2018-02 | 2.269 | 2.426 | [2.069, 2.782] | 2.569 |

File: [`forecast_next_6m.csv`](./figures/18/forecast_next_6m.csv)

---

## 6. Pricing stance

![Pricing stance](./figures/18/08_pricing_stance.png)

| Tháng | Forecast (Naive) | Pressure | Stance |
|---|---:|---:|---|
| 2017-09 | 2.573 | 1,07 | NEUTRAL |
| 2017-10 | 2.790 | 1,13 | NEUTRAL (gần protect) |
| 2017-11 | 2.408 | 0,93 | NEUTRAL |
| 2017-12 | 2.027 | 0,83 | **STIMULATE** |
| 2018-01 | 1.966 | 0,80 | **STIMULATE** |
| 2018-02 | 2.269 | 0,98 | NEUTRAL |

---

## 7. KPI

| Metric | Value |
|---|---|
| n_months | 26 |
| differencing | d=1, D=0 |
| best SARIMAX (AIC) | (0,1,2)×(1,0,1,12) |
| best holdout model | seasonal_naive |
| best holdout MAPE | 6,9% |
| SARIMAX holdout MAPE | 9,1% |
| SARIMAX PI95 coverage | 100% |
| statsmodels | 0.14.6 |

---

## 8. Giới hạn (statsmodels + dữ liệu ngắn)

- Chỉ ~26 điểm → seasonal HW không fit trên train holdout; SARIMAX PI rất rộng.  
- AIC trên train không đảm bảo thắng Naive ngoài mẫu.  
- Dataset lệch năm (2015 H2 / 2017 cắt Aug) — forecast 2018 mang tính minh họa.  
- Bước tiếp: thêm năm dữ liệu, hoặc SARIMAX + exog (`lead_time`, channel mix); nối ADR playbook ở [`17_adr_strategy_analysis.md`](17_adr_strategy_analysis.md).

---

*Báo cáo sinh từ `notebooks/18_demand_forecasting_dynamic_pricing.ipynb` (statsmodels Workflow 4).*
