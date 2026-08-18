# Notebooks — Hotel Booking Demand

Phân tích Python từ dữ liệu sạch tới **pricing playbook**. Đọc **câu hỏi → kỹ thuật** trước; thứ tự chạy và công thức ở dưới.

Nguồn chuẩn: `data/hotel_bookings_v5.csv` (82.811 booking · Jul 2015 → Aug 2017 · City / Resort).  
Mô hình hủy nằm ở [`../models/`](../models/README.md), không trong thư mục này.

---

## Chất lượng v5

File phân tích (không phải raw). Notebook `01` biến raw 119.390 × 32 → **v2** (dedup) → v3/v4 (KPI) → **v5** (+ `day_of_week`). Mọi notebook sau neo v5.

| | |
|--|--|
| Grain | 1 dòng = 1 booking |
| n × p | **82.811 × 36** · trùng cả dòng = 0 · missing = 0 |
| Thời gian | Arrival 2015–2017 (cửa sổ ~ Jul 2015 → Aug 2017, ~26 tháng panel) |
| Hotel | City **50.686** (hủy **30,7%**) · Resort **32.125** (hủy **24,1%**) |
| Target | `is_canceled` · tỷ lệ hủy **28,12%** |
| Lead time | 0–737 ngày · median 48 |
| Quốc gia | 178 mức (đã fill; không NA trên v5) |
| ADR stay (`is_canceled=0`, `adr>0`) | mean ≈ €106 · median ≈ €97 · max €510 |

**Lỗi / biên (giữ, không drop hàng loạt):**

| Hiện tượng | n (stay thành công) | Cách đọc |
|------------|---------------------|----------|
| `adr = 0` | 1.460 | Complementary / miễn phí — loại khỏi EDA ADR và forecast giá |
| Số đêm = 0 | 584 | Không phát sinh `revenue` |
| `adr < 0` | 1 | Outlier; không suy diễn phân phối ADR |

**Không có trong dataset (ảnh hưởng mọi KPI sau):** không inventory phòng thật → `occupancy_rate` / `RevPAR` là **proxy**; 2017 cắt tháng 8 → forecast 6 tháng là minh họa.

**Khuyến nghị đọc file:** pandas; ADR/forecast lọc `is_canceled=0` và `adr>0`; model hủy **giữ cả hai lớp**; không `AVG` Occupancy/RevPAR khi gộp tháng (grain lặp trên từng booking). Viz: dual-axis volume vs rate (`02`), box ADR theo tháng (`03`).

---

## Câu hỏi → notebook → insight

| Giai đoạn | Câu hỏi | Quyết định cần ra | Kỹ thuật chính | Notebook | Báo cáo |
|-----------|---------|-------------------|----------------|----------|---------|
| **0** | Dữ liệu dùng được chưa? `n` đến từ đâu? | Neo mọi báo cáo sau trên **v5**; giữ cả booking hủy | Dedup theo key nghiệp vụ, missing, KPI row/tháng | `01` | — |
| **1** | Hủy tập trung ở đâu? ADR biến động thế nào? | High-risk → buffer; ADR chỉ tin trên stay thành công | Binning, dual-axis, heatmap, ECDF | `02`, `03`, **`02b`**, **`03b`** | `02`, `03`, `02b`, `03b`, `03_summary`, `03b_summary` |
| **2** | Tín hiệu hủy là nhân quả hay rò rỉ? | Loại leakage trước khi train model | Pearson / Spearman, Cramér's V, partial correlation | `04`, **`04b`** | `04`, `04b` |
| **2** | Lead time / deposit / segment có khác biệt thật không? | Không siết deposit hàng loạt nếu residual bất thường | Mann–Whitney U, χ², logistic OR | `05`, `05b`, **`05c`** | `05`, `05c` |
| **4** | BRD còn lỗ hổng nào? | Ưu tiên interaction 3 chiều, mismatch phòng, mô phỏng deposit | Stratify, revenue-loss proxy, what-if | `12` | `12` |
| **5** | City và Resort khác nhau thế nào về ADR? | Không dùng một ladder giá cho cả hai | Mann–Whitney, heatmap month×DOW, slope chart | `17`, **`17b`** | `17`, `17b` |
| **5** | Demand / ADR / RevPAR 6 tháng tới đi đâu? | Stance RAISE / HOLD / CUT **tách hotel** | ADF+KPSS, SARIMAX, Holt–Winters, holdout vs Seasonal Naive | `18*`, **`20*`** | `18*`, `20*`, `21` |
| **6** | Tăng giá thì demand mất bao nhiêu? | Prior vận hành: City ε≈−0,70 · Resort ε≈−1,10 | Log–log OLS + month FE, first-difference | **`22`** | `22` |
| **6** | BAR tối ưu trên giấy là bao nhiêu? | Không chốt p*; dùng band floor–recommend–ceil | Iso-elastic \(R(p)=p\cdot Q(p)\), grid search | **`23`** | `23` |
| **6** | Forecast + tối ưu + lịch sử họp ở mức giá nào? | Ensemble 3 nguồn, không một model độc quyền | HGB regressor + classifier, time-series CV | **`24`** | `24`, `25` |
| **7** | Rule hẹp có sống được trên lịch sử không? | `go=True` mới đưa vào playbook | What-if ladder, back-test 2015–2016 | **`27`** | `27` → `28` |

In đậm = bản **canonical** (tách City / Resort) dùng cho playbook. Bản `17` / `18*` là prototype gộp hoặc bước trung gian.

---

## Quy trình phân tích

```text
01  Làm sạch → v2…v5
        ↓
02–03  EDA hủy · ADR (gộp)
02b–03b  EDA hủy · ADR **tách City / Resort**
        ↓
04  Tương quan (gộp) · **04b** tương quan **tách City / Resort**
05  Kiểm định (gộp) · **05c** kiểm định **tách hotel**
        ↓
   [models/]  P(hủy) → luồng booking theo rủi ro
        ↓
12  BRD gap · overbooking / buffer (báo cáo 10, 15, 16, 26)
        ↓
17b  Chiến lược ADR theo property
        ↓
20 / 20a / 20b  Forecast Demand · ADR · RevPAR (tách City / Resort)
        ↓
22  Elasticity → 23  Tối ưu BAR → 24  Ensemble ML
        ↓
27  Mô phỏng · what-if · back-test  →  Pricing Playbook
```

Luôn **tách City vs Resort**. Mùa: **Peak** = 7–8 · **Shoulder** = 4–6 và 9–10 · **Low** = 11–3.

---

## Kỹ thuật theo giai đoạn

### 0 — Làm sạch (`01`)

| Việc | Cách làm | Vì sao |
|------|----------|--------|
| Cột `company` | Drop (thiếu quá nhiều) | Không cứu được bằng impute |
| Trùng | `drop_duplicates` theo **key nghiệp vụ**, không chỉ cả dòng | Tránh xóa nhầm booking hợp lệ |
| Hủy | **Giữ** `is_canceled = 1` | EDA + model hủy cần cả hai lớp |
| Version | raw → **v2** (clean) → **v3/v4** (KPI) → **v5** (`day_of_week`) | Mọi notebook sau neo **v5** |

KPI gắn vào từng dòng (grain tháng lặp lại — không `AVG` khi gộp):

```
revenue        = adr × (weekend_nights + week_nights)     khi is_canceled = 0
occupancy_rate = AVG(1 − is_canceled)                     proxy — không có inventory
adr            = AVG(adr) WHERE is_canceled = 0 AND adr > 0
revpar         = adr × occupancy_rate
```

### 1 — EDA (`02`, `03`, `02b`, `03b`, `05b`)

- **Hủy (`02`):** bin `lead_time`; tỷ lệ theo `deposit_type` / `market_segment` / `distribution_channel`; grouped + stacked bar; histogram + KDE trục Y kép; box + violin; heatmap segment × kênh.
- **Hủy tách hotel (`02b`):** cùng chiều phân tích, overlay / facet City vs Resort + gap lead bin.
- **ADR (`03`):** chỉ stay thành công (`is_canceled = 0`, `adr > 0`); box/line theo tháng; heatmap month × year + YoY; weekday; room type / room-match; customer type × hotel.
- **ADR tách hotel (`03b`):** cùng chiều, overlay mùa / DOW / room / customer + gap tháng.
- **Tổng hợp hình (`05b`):** heatmap, box, time series dual-axis (cancel vs ADR) — cùng logic, phục vụ báo cáo (bản gộp).

### 2 — Tương quan & giả thuyết (`04`, `05`)

| Đối tượng | Kiểm định | Effect size | Đọc kết quả |
|-----------|-----------|-------------|-------------|
| Biến số vs `is_canceled` | Pearson + Spearman | \|r\| | Spearman khi lệch phân phối |
| Biến phân loại vs `is_canceled` | χ² | Cramér's V | Residual \|z\| > 2 = ô bất thường |
| Confounding | Partial correlation | r sau khi kiểm soát | Tín hiệu “ảo” vì biến thứ ba |
| `lead_time` (H1) | Mann–Whitney U + bootstrap CI | Rank-biserial *r* | Không giả định chuẩn |
| `lead_time` bin (H1b) | χ² | Cramér's V | Cùng chiều với H1, grain khác |
| `deposit_type` (H2) | χ² + post-hoc z-test cặp | Cramér's V | Non Refund cancel cao → audit, không kết luận “đặt cọc đang chặn hủy” |
| `market_segment` (H3) | χ² + standardized residual | Cramér's V | Groups / Online TA khác cơ chế |
| 3 biến đồng thời (H4) | Logistic | Odds ratio + 95% CI, pseudo-R² | OR theo +30 ngày lead time cho dễ diễn giải |
| H1–H4 **tách hotel** (`05c`) | Cùng test trên từng property | So sánh r / V / OR | Lead & segment mạnh hơn Resort; deposit mạnh hơn City |

**Leakage không đưa vào model:** `reservation_status`, `reservation_status_date`, `revenue`, `Occupancy_Rate`, `RevPAR`, `assigned_room_type` (thường gán gần check-in).

### 4 — BRD gap (`12`)

Bốn hạng mục: interaction **lead × segment × mùa**; ước **revenue loss**; **room mismatch** (upgrade vs downgrade so median ADR); **deposit simulation** (what-if, không phải A/B live).

### 5 — ADR strategy (`17` → `17b`)

`17` gộp hai hotel (prototype). **`17b` tách City / Resort** — bản dùng cho quyết định:

- Mùa vụ: mean/median/volume, box theo tháng, weekend premium, heatmap month × DOW.
- Lead time: tương quan + rolling median (LOESS-like), control theo mùa, stratify segment.
- Room ladder + mismatch / upsell.
- So sánh chéo: slope chart, parallel coordinates (chuẩn hóa), ECDF, Mann–Whitney City vs Resort.

### 5 — Forecast (`18*` prototype → `20*` canonical)

Cùng **Workflow 4** (statsmodels), lặp cho **Demand / ADR / RevPAR**:

1. Vẽ chuỗi + seasonal decompose (additive).
2. **ADF + KPSS** — chỉ coi stationary khi *cả hai* đồng ý; chuỗi ngắn (~26 tháng) ưu tiên differencing nhẹ.
3. ACF / PACF sau differencing đã chọn.
4. Grid **SARIMAX** (AIC/BIC) + **Holt–Winters**; Seasonal Naive là baseline.
5. Residual: `plot_diagnostics`, Ljung–Box.
6. Holdout + **prediction interval**; coverage 95%.
7. Refit full history → forecast 6 tháng (Sep 2017 → Feb 2018, **minh họa** vì 2017 cắt tháng 8).
8. **Stance** giá từ pressure (demand / ADR / RevPAR), không phải lệnh đẩy OTA.

`18` / `18a` / `18b` = gộp portfolio. **`20` / `20a` / `20b` = chạy riêng từng hotel rồi so sánh** — đầu vào của `22`–`24` và playbook.

### 6 — Elasticity · tối ưu · ensemble (`22`–`24`)

**`22` — ε giá–demand** (stay, panel tháng):

```
ε = ∂ log Q / ∂ log P     (kỳ vọng ε < 0)
```

- Log–log OLS + **month fixed effects**.
- First-difference (bớt nhiễu trend).
- ε theo `market_segment` (giảm bias mùa).
- Chọn **ε vận hành + prior an toàn** (City kém co giãn hơn Resort) → `elasticity_by_hotel.csv`.

**`23` — tối ưu BAR** trên horizon forecast:

```
Q(p) = Q₀ (p / P₀)^ε
R(p) = p · Q(p)
```

Grid `p ∈ [0.70 P₀, 1.30 P₀]`; soft capacity `Q(p) ≤ 1.15 Q_demand^fc`. Điểm `p*` là gợi ý trên giấy — **không** chốt lên kênh.

**`24` — ML policy** (sklearn, không GPU):

| Head | Model | Target |
|------|--------|--------|
| Regression | `HistGradientBoostingRegressor` | ADR tháng (lag + contemporaneous) |
| Classification | `HistGradientBoostingClassifier` | Stance 3 lớp: PROTECT / NEUTRAL / STIMULATE |

Feature: calendar, lag t−1 / t−12, mix kênh–segment, context forecast 20\*. Time-series CV. **Ensemble** = ML ⊕ tối ưu `23` ⊕ stance `20*` → dải floor / recommend / ceil (±15%).

### 7 — Kiểm chứng (`27`)

| Block | Việc | Ý nghĩa vận hành |
|-------|------|------------------|
| 1 | RevPAR baseline vs dynamic | Lift proxy, không phải P&L kế toán |
| 2 | What-if Peak ADR +5 / +10 / +15% | City Peak chịu được; Resort Peak dễ mất volume |
| 3 | ε theo segment (+ ε_ops) | Không dump giá Groups; Offline Resort nhạy hơn Online |
| 4 | Dual-objective: revenue × cancel risk | Hạ tay so p* thuần |
| 5 | Back-test rule hẹp 2015–2016 | `go=True` khi ΔRevPAR ≥ 0 và Δcancel ≤ +1 pp |

---

## Catalog file

| File | Vai trò |
|------|---------|
| `01_data_cleaning.ipynb` | raw → v5 |
| `02_eda_stage1_cancellation.ipynb` | EDA hủy |
| `02b_eda_stage1_cancellation_city_resort.ipynb` | EDA hủy **tách City / Resort** |
| `03_eda_stage2_adr.ipynb` | EDA ADR |
| `03b_eda_stage2_adr_city_resort.ipynb` | EDA ADR **tách City / Resort** |
| `04_correlation_analysis.ipynb` | Pearson / Spearman / Cramér / partial (gộp) |
| `04b_correlation_analysis_city_resort.ipynb` | Cùng quy trình **tách City / Resort** |
| `05_hypothesis_testing.ipynb` | H1–H4 |
| `05b_hypothesis_visualization.ipynb` | Hình tổng hợp cho báo cáo (gộp) |
| `05c_hypothesis_testing_city_resort.ipynb` | H1–H4 **tách City / Resort** |
| `12_brd_gap_analysis.ipynb` | 4 gap BRD |
| `17_adr_strategy_analysis.ipynb` | ADR strategy (gộp) |
| `17b_adr_strategy_analysis_city_resort.ipynb` | ADR strategy **tách hotel** |
| `18` / `18a` / `18b` | Forecast Demand / ADR / RevPAR (gộp) |
| `20` / `20a` / `20b` | Forecast **tách City / Resort** |
| `22_dynamic_pricing_elasticity_city_resort.ipynb` | ε |
| `23_dynamic_pricing_optimization_city_resort.ipynb` | p* |
| `24_dynamic_pricing_ml_city_resort.ipynb` | Ensemble BAR |
| `27_validate_simulation.ipynb` | Back-test → playbook |

Hình xuất vào `reports/figures/<số_notebook>/`. Markdown tương ứng trong `reports/`.

---


