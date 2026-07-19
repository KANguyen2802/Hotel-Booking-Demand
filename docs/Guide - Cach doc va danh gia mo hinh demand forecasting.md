# Hướng dẫn đọc và đánh giá mô hình demand forecasting (dynamic pricing)

> **Phạm vi:** `notebooks/18_demand_forecasting_dynamic_pricing.ipynb` (statsmodels Workflow 4)  
> **Biến mục tiêu:** demand tháng = số stay bookings (`is_canceled = 0`)  
> **Dữ liệu:** `hotel_bookings_v5.csv` · 59.527 stay · **26 tháng** (2015-07 → 2017-08)  
> **Báo cáo kết quả:** `reports/18_demand_forecasting_dynamic_pricing.md`  
> **Hình ảnh:** `reports/figures/18/`  
> **Library:** statsmodels **0.14.6**

---

## Mục tiêu tài liệu

Sau khi đọc xong, bạn có thể:

1. Đọc đúng **mọi chỉ số** time-series (ADF/KPSS, AIC/BIC, MAE/RMSE/MAPE, Ljung–Box, PI coverage).
2. Đọc **toàn bộ chart** trong notebook / báo cáo 18.
3. Phân biệt *model thắng trên train (AIC)* vs *model thắng ngoài mẫu (holdout MAPE)*.
4. Liên kết chỉ số ↔ chart ↔ **pricing stance** (PROTECT / NEUTRAL / STIMULATE).

---

## Bối cảnh mô hình notebook 18 (tóm tắt)

| Thành phần | Giá trị |
|---|---|
| Bài toán | Forecast **volume demand theo tháng** hỗ trợ dynamic pricing |
| Target chính | Monthly bookings (stays) |
| Chuỗi | 26 điểm tháng — ngắn → ưu tiên model ổn định + baseline mạnh |
| Differencing đã chọn | `d=1`, `D=0` (ADF+KPSS đạt trên `diff1`) |
| SARIMAX (best AIC train) | `(0,1,2)×(1,0,1,12)` · AIC ≈ 62,8 · BIC ≈ 59,7 |
| Holdout | 6 tháng cuối (train 20 / test 6) |
| Best holdout (MAPE) | **Seasonal Naive** ≈ **6,9%** |
| Đối chứng | Holt trend (train) / Holt–Winters seasonal (full) · SARIMAX + 95% PI |
| Primary cho pricing stance | Model thắng holdout = **Seasonal Naive** |

**Nguyên tắc kinh doanh của nb 18:** point forecast dùng model **thắng ngoài mẫu**; SARIMAX dùng cho **dải rủi ro (prediction interval)** và diagnostics — không tự động lấy AIC thấp nhất làm rate calendar.

---

# PHẦN I — Cách đọc chỉ số đánh giá

## 1. Bản đồ chỉ số trong notebook 18

| Nhóm | Chỉ số | Vai trò |
|---|---|---|
| Stationarity | ADF p, KPSS p | Quyết định cần diff bao nhiêu (`d`, `D`) |
| Identification | ACF / PACF | Gợi ý bậc `p`, `q`, `P`, `Q` |
| In-sample fit | AIC, BIC, LLF | So sánh SARIMAX trên **train** |
| Residual health | Ljung–Box p, resid mean/std | Còn autocorrelation sau fit không? |
| Out-of-sample | MAE, RMSE, **MAPE** | Chọn model cho pricing |
| Uncertainty | 95% PI, PI coverage | Độ rộng / độ tin cậy của SARIMAX |
| Pricing | season_index, demand_index, combined_pressure | Đổi forecast → stance |

---

## 2. Stationarity — ADF & KPSS

| Test | H₀ | Đọc ở α = 0,05 |
|---|---|---|
| **ADF** | Có unit root (non-stationary) | p < 0,05 → **bác bỏ H₀** → nghiêng stationary |
| **KPSS** | Stationary | p < 0,05 → **bác bỏ H₀** → nghiêng non-stationary |

**Quy tắc kết hợp (dùng trong nb 18):**

| ADF stationary? | KPSS stationary? | Kết luận thực tế |
|---|---|---|
| Yes | Yes | Chuỗi dùng được (ít nghi ngờ) |
| No | No | Cần differencing |
| Yes | No | Có thể over-differenced / mẫu ngắn — thận trọng |
| No | Yes | Kết quả mâu thuẫn — thử diff thêm hoặc giảm bậc |

**Số liệu notebook 18:**

| Series | ADF stationary | KPSS stationary | Ghi chú |
|---|---|---|---|
| level | No | No | Không fit ARIMA trên level thô |
| **diff1** | **Yes** | **Yes** | **Chọn `d=1`, `D=0`** |
| seasonal_diff12 | Yes | No | n chỉ 14 — rủi ro over-diff |
| diff1_seasonal12 | Yes | Yes | n chỉ 13 — đốt mẫu nặng |

**Cách đọc sai thường gặp:** thấy ADF p ≈ 0 trên `seasonal_diff12` rồi ép `D=1` dù KPSS fail và n quá nhỏ.

---

## 3. AIC / BIC (chọn SARIMAX trên train)

| Chỉ số | Ý nghĩa | Cách đọc |
|---|---|---|
| **AIC** | Phạt phức tạp + goodness of fit | **Thấp hơn = tốt hơn** trên cùng dữ liệu train |
| **BIC** | Phạt phức tạp mạnh hơn AIC | Ưu tiên model gọn khi n nhỏ |
| **LLF** | Log-likelihood | Cao hơn = fit tốt hơn (chưa phạt độ phức tạp) |

**Best train (nb 18):** `SARIMAX(0,1,2)×(1,0,1,12)` · AIC ≈ **62,8** · BIC ≈ **59,7**.

**Quy tắc vàng:** AIC chọn model trên **train**, **không** tự động chọn model cho **pricing**. Phải đối chiếu holdout MAPE.

---

## 4. MAE, RMSE, MAPE (holdout)

Trên 6 tháng cuối:

| Chỉ số | Công thức ý tưởng | Ưu điểm | Hạn chế |
|---|---|---|---|
| **MAE** | Trung bình \|e\| | Dễ hiểu (booking) | Không phạt lệch lớn mạnh hơn |
| **RMSE** | √(trung bình e²) | Nhạy với outlier | Đơn vị booking nhưng khó so % |
| **MAPE** | Trung bình \|e\|/y | So được giữa model / tháng | Kém khi y gần 0 (ở đây y lớn → ổn) |

**Số liệu holdout nb 18:**

| Model | MAE | RMSE | MAPE |
|---|---:|---:|---:|
| **Seasonal Naive** | 189,2 | 207,3 | **6,9%** |
| Holt trend | 221,9 | 250,7 | 8,1% |
| SARIMAX(0,1,2)(1,0,1)₁₂ | 251,8 | 285,3 | 9,1% |

**Cách đọc trong bối cảnh khách sạn:**

- MAPE 6,9% ≈ lệch trung bình ~7% volume tháng — chấp nhận được cho rate calendar thô.  
- Naive thắng SARIMAX ~2 điểm MAPE → **primary point forecast = Naive**.  
- SARIMAX vẫn hữu ích vì có **PI**; không “bỏ model” chỉ vì MAPE hơi kém.

---

## 5. Seasonal Naive — baseline bắt buộc

| Thành phần | Ý nghĩa |
|---|---|
| Công thức | `ŷ_t = y_{t-12}` (cùng tháng năm trước) |
| Vì sao mạnh ở hotel | Seasonality năm thống trị; YoY pattern ổn trên mẫu ngắn |
| Khi nào thua | Shock cấu trúc, trend mạnh, hoặc có exogenous lớn |

**Quy tắc:** Model phức tạp chỉ được coi là “thắng” khi **holdout MAPE tốt hơn Naive rõ rệt** (thường ≥ 1–2 điểm % và ổn định trên nhiều cửa sổ).

---

## 6. Ljung–Box (residual diagnostics)

| Chỉ số | H₀ | Cách đọc |
|---|---|---|
| **lb_pvalue** | Residuals không còn autocorrelation | p > 0,05 → **không bác bỏ** → residual “sạch” hơn |

**Nb 18 (train):**

| Model | p lag 6 | p lag 12 |
|---|---:|---:|
| SARIMAX | 0,17 | 0,18 |
| Holt trend | 0,32 | 0,28 |

**Cách đọc:** Diagnostics đạt ≠ forecast ngoài mẫu tốt. Chỉ nói “không còn cấu trúc tuyến tính rõ trong residual train”.

---

## 7. Prediction interval (95% PI) & coverage

| Khái niệm | Ý nghĩa |
|---|---|
| **Point forecast** | Một số (mean) |
| **95% PI** | Khoảng kỳ vọng chứa quan sát tương lai (dưới giả định model) |
| **Coverage** | % actual holdout nằm trong PI |

**Nb 18:** SARIMAX 95% PI coverage holdout = **100%**, nhưng interval **rộng** (chuỗi ngắn).

**Cách đọc đúng / sai:**

| Đúng | Sai |
|---|---|
| PI rộng = bất định cao → pricing thận trọng | Coverage 100% = model “hoàn hảo” |
| Dùng PI để biết biên rủi ro | Lấy cận trên PI làm target bán cứng |

---

## 8. Pricing indices & stance

| Chỉ số | Định nghĩa (nb 18) | Đọc |
|---|---|---|
| **season_index** | Mean bookings tháng / grand mean | >1 = tháng historically mạnh |
| **demand_index** | Forecast / grand mean | >1 = forecast cao hơn trung bình |
| **combined_pressure** | `0,5·season + 0,5·demand` | Tín hiệu tổng hợp |
| **PROTECT** | pressure ≥ 1,15 | Harden BAR, hạn chế promo |
| **NEUTRAL** | giữa 0,90 và 1,15 | Hold BAR, tactical |
| **STIMULATE** | pressure ≤ 0,90 | Promo / early-bird / package |

**Nb 18 (minh họa forecast):** Dec–Jan = **STIMULATE**; Oct gần protect; Sep/Nov/Feb = NEUTRAL.

---

# PHẦN II — Cách đọc chart đánh giá mô hình

## Chart 01 — Monthly demand (overall + by hotel)

![Chart 01 — Monthly demand](../reports/figures/18/01_monthly_demand_overall.png)

| Panel | Cách đọc |
|---|---|
| **Trên** | Chuỗi bookings tháng tổng; nhìn peak/trough theo năm |
| **Dưới** | Tách City vs Resort — so biên độ và pha mùa |

**Cách đọc visual:**

1. Có chu kỳ lặp theo năm không? (có → seasonal model).  
2. Trend tăng/giảm dài hạn có rõ không? (mẫu lệch năm → đừng over-interpret).  
3. Hai hotel có cùng hình dạng không? (không → cân nhắc forecast tách property).

**Liên kết chỉ số:** n = 26 tháng; total stays = 59.527.

---

## Chart 02 — Seasonal decompose

![Chart 02 — Decompose](../reports/figures/18/02_seasonal_decompose.png)

| Thành phần | Ý nghĩa |
|---|---|
| Observed | Chuỗi gốc |
| Trend | Xu hướng chậm |
| Seasonal | Chu kỳ 12 tháng |
| Residual | Phần còn lại sau trend+season |

**Cách đọc:** Seasonal biên độ lớn → Naive / SARIMAX seasonal / HW hợp lý. Residual vẫn “nhám” → còn chỗ cho AR/MA.

**Đọc sai:** coi trend tăng nhẹ trên 26 tháng là “tăng trưởng chắc chắn 2018”.

---

## Chart 03 — ACF / PACF sau differencing

![Chart 03 — ACF/PACF](../reports/figures/18/03_acf_pacf.png)

| Chart | Gợi ý order |
|---|---|
| **ACF** | Cutoff ở lag q → nghiêng MA(q); spike lag 12 → seasonal MA |
| **PACF** | Cutoff ở lag p → nghiêng AR(p); spike lag 12 → seasonal AR |

**Cách đọc với n nhỏ:** chỉ lấy **hướng**; quyết định cuối = AIC grid + holdout (nb chọn `(0,1,2)×(1,0,1,12)`).

---

## Chart 04 — SARIMAX residual diagnostics

![Chart 04 — Diagnostics](../reports/figures/18/04_sarimax_diagnostics.png)

| Panel điển hình | Cách đọc “ổn” |
|---|---|
| Residuals vs time | Dao động quanh 0, không trend rõ |
| Histogram / KDE | Gần đối xứng quanh 0 |
| Q–Q | Điểm gần đường chuẩn |
| Correlogram | Spike trong band → ít autocorrelation còn lại |

**Liên kết chỉ số:** Ljung–Box p lag 6/12 > 0,05 → khớp “residual sạch” trên train.

**Đọc sai:** thấy Q–Q hơi lệch trên mẫu ngắn rồi bác bỏ model đang thắng holdout.

---

## Chart 05a — Holdout forecasts + 95% PI

![Chart 05a — Holdout forecasts](../reports/figures/18/05_holdout_forecasts.png)

| Thành phần visual | Ý nghĩa |
|---|---|
| Đường actual | Sự thật 6 tháng cuối |
| Seasonal Naive / Holt / SARIMAX | Point forecast từng model |
| Vùng tô (PI) | 95% prediction interval của SARIMAX |
| Đường dọc train/test | Ranh giới holdout |

**Cách đọc:**

1. Model nào bám actual sát nhất? → Naive.  
2. Actual có nằm trong PI không? → có (coverage 100%).  
3. PI có quá rộng để “chốt giá cứng” không? → có → dùng PI làm cảnh báo, không làm target duy nhất.

---

## Chart 05b — Holdout MAPE (bar)

![Chart 05b — Holdout MAPE](../reports/figures/18/05_holdout_metrics.png)

**Cách đọc:** cột thấp hơn = tốt hơn. Thứ tự nb 18: Naive < Holt trend < SARIMAX.

**Quy tắc quyết định:**

```
Holdout MAPE thấp nhất  →  primary point forecast (pricing volume)
AIC thấp nhất (train)   →  chỉ chọn trong họ SARIMAX / diagnostics
PI hẹp + coverage tốt   →  tin uncertainty band hơn
```

---

## Chart 07 — Forecast 6 tháng (full sample)

![Chart 07 — Forecast horizon](../reports/figures/18/07_forecast_horizon.png)

| Đường | Vai trò |
|---|---|
| Actual (lịch sử) | Quan sát đến Aug-2017 |
| Seasonal Naive | Primary stance input |
| SARIMAX + PI | Đối chứng + biên rủi ro |
| Holt–Winters | Đối chứng seasonal (full sample đủ 2 chu kỳ) |

**Cách đọc:** ba model **đồng thuận hướng mùa** (Oct cao, Dec–Jan thấp) dù mức tuyệt đối khác → tín hiệu mùa đáng tin hơn mức điểm từng model.

---

## Chart 08 — Pricing stance (pressure index)

![Chart 08 — Pricing stance](../reports/figures/18/08_pricing_stance.png)

| Màu / ngưỡng | Stance | Hành động gợi ý |
|---|---|---|
| Đỏ / ≥ 1,15 | PROTECT | Harden BAR, hạn chế dump OTA |
| Vàng / 0,90–1,15 | NEUTRAL | Hold BAR, weekend tactical |
| Xanh / ≤ 0,90 | STIMULATE | Promo, early-bird, package |

**Nb 18:** Dec–Jan xanh (STIMULATE); Oct gần ngưỡng protect; còn lại NEUTRAL.

**Liên kết nb 17:** stance volume này ghép với ADR season / weekend premium / lead-time ladder — xem `reports/17_adr_strategy_analysis.md` và mục chiến lược trong `reports/18_...md` §7.

---

# PHẦN III — Liên kết chỉ số ↔ chart ↔ quyết định

## Checklist đọc kết quả notebook 18

1. **Chuỗi & decompose** — có seasonality năm rõ không? n có đủ dài không?  
2. **ADF + KPSS** — `d`, `D` đã chọn có nhất quán và không over-diff không?  
3. **ACF/PACF + AIC** — order SARIMAX có hợp lý không? AIC có bị degenerate (quá thấp bất thường) không?  
4. **Ljung–Box / diagnostics** — residual train có sạch không?  
5. **Holdout MAE/RMSE/MAPE** — ai thắng Naive? gap có đáng kể không?  
6. **PI coverage & độ rộng** — interval có dùng được cho rủi ro không?  
7. **Stance** — PROTECT/NEUTRAL/STIMULATE có khớp peak/trough không?  
8. **Giới hạn mẫu** — có đang ngoại suy quá đà sang năm thiếu dữ liệu không?

## Bảng “nhìn chart / chỉ số nào khi hỏi gì?”

| Câu hỏi | Chart / chỉ số |
|---|---|
| Demand có mùa rõ không? | Chart 01, Chart 02 |
| Có cần differencing không? | Bảng ADF/KPSS |
| Gợi ý bậc AR/MA thế nào? | Chart 03 (ACF/PACF) |
| SARIMAX train có fit sạch không? | Chart 04, Ljung–Box, AIC/BIC |
| Model nào tốt nhất để forecast giá? | Chart 05a/05b, **MAPE holdout** |
| Forecast có chắc chắn không? | 95% PI, coverage |
| Tháng tới nên promo hay harden BAR? | Chart 08, combined_pressure |
| Có nên bỏ Naive không? | So MAPE model vs Seasonal Naive |
| City/Resort có cần tách không? | Chart 01 (panel dưới) |

## Trade-off mô hình nb 18 (tóm tắt)

```
Chuỗi ngắn (~26 tháng) + seasonality mạnh
        │
        ├── Seasonal Naive     → MAPE holdout tốt nhất (~6,9%)  → PRIMARY point forecast
        ├── SARIMAX AIC-best   → diagnostics ổn + có 95% PI      → uncertainty / đối chứng
        ├── Holt–Winters       → cần ≥24 tháng cho seasonal init → full-sample OK; train holdout phải fallback Holt trend
        └── Rolling average    → dễ làm mượt peak                 → chỉ baseline phụ (không dùng primary)
```

**Quy tắc vận hành đề xuất:**

- **Volume cho rate calendar:** Seasonal Naive (re-benchmark mỗi quý).  
- **Dải rủi ro:** SARIMAX 95% PI — nếu actual lệch khỏi PI → escalate review.  
- **Đổi primary sang SARIMAX/HW** chỉ khi thắng Naive ≥ 2 điểm MAPE trên **≥ 2** cửa sổ holdout liên tiếp.  
- **Stance:** Dec–Jan STIMULATE; Oct thận trọng protect; nối ADR playbook nb 17.

---

## Tài liệu & file liên quan

| File | Nội dung |
|---|---|
| `notebooks/18_demand_forecasting_dynamic_pricing.ipynb` | Notebook nguồn (statsmodels) |
| `reports/18_demand_forecasting_dynamic_pricing.md` | Báo cáo kết quả + insight + gợi ý chiến lược |
| `reports/figures/18/*.png` | Hình dùng trong guide này |
| `reports/figures/18/kpi_summary.csv` | KPI tóm tắt (local; `*.csv` đang gitignore) |
| `reports/17_adr_strategy_analysis.md` | ADR season / weekend / lead-time để ghép pricing |
| `docs/Guide - Cach doc chi so thong ke.md` | ADF/p-value/effect size & khái niệm thống kê nền |
| `docs/Guide - Cach doc va danh gia mo hinh du doan.md` | Guide mô hình hủy phòng (classification) — so sánh tư duy đánh giá |

---

*Cập nhật: 19/7/2026 — hướng dẫn đọc chỉ số & chart mô hình demand forecasting dynamic pricing (kèm hình từ `18_demand_forecasting_dynamic_pricing.ipynb`).*
