# Reports — Hotel Booking Demand

Tiến trình phân tích theo **thứ tự số file**. Mỗi giai đoạn: đọc gì → kết quả chốt. Chi tiết kỹ thuật ở [`../notebooks/`](../notebooks/README.md) và [`../models/`](../models/README.md).

Nguồn số: `hotel_bookings_v5.csv` · **82.811** booking · hủy **28,12%** · City / Resort · Jul 2015 → Aug 2017.  
**Recommend-only.** Không có báo cáo `01` (cleaning nằm ở notebook).

```text
02–03  EDA hủy · ADR
   → 04–05  Tương quan · giả thuyết
      → 06–09 · 11 · 13–14  Model hủy · P(hủy)
         → 10 · 12 · 15–16 · 26  BRD · chính sách · buffer
            → 17–21  ADR strategy · forecast (gộp rồi tách hotel)
               → 22–25  ε · tối ưu · ensemble BAR
                  → 27–28  Validate · Playbook
                     → 29–35  Stakeholder · triển khai
```

---

## 1 — EDA · `02` `03` `03_summary`

| File | Việc |
|------|------|
| [`02`](02_eda_stage1_cancellation_analysis.md) | Hủy theo lead, cọc, segment, kênh |
| [`03`](03_eda_stage2_adr_analysis.md) | ADR theo tháng, thứ, phòng, loại khách |
| [`03_summary`](03_summary_eda_key_findings.md) | Gộp hai stage thành ma trận rủi ro × giá trị |

**Kết quả:** Hủy **28,12%**. Lead 0–30 ngày hủy **17%** → >180 ngày **42%** (bước nhảy lớn sau 30 ngày). **98,7%** No Deposit. Online TA **35,5%** hủy (50.391 booking); TA/TO **31,5%** vs Direct **15,1%**. Cùng kênh TA/TO, Online vs Offline chênh ~21 pp — **segment quan trọng hơn channel**. ADR stay mean **€105,92**; City **€112** vs Resort **€97**; Transient **81,9%** volume, ADR cao nhất. August mean ADR **€151** vs January **€70**.

Hotspot: **Online TA × TA/TO** — vừa volume lớn vừa hủy cao.

---

## 2 — Tín hiệu có thật không · `04` `05`

| File | Việc |
|------|------|
| [`04`](04_correlation_analysis_is_canceled.md) | Pearson / Spearman / Cramér’s V; loại leakage |
| [`05`](05_hypothesis_testing_is_canceled.md) | H1–H4 (Mann–Whitney, χ², logistic) |

**Kết quả:** Sau khi loại leakage (`reservation_status`, `revenue`, Occupancy, RevPAR…), tín hiệu mạnh nhất: `market_segment` (V = **0,219**), `lead_time` (r = **0,196**), parking (r = **−0,189**), `deposit_type` (V = **0,161**). H1–H4 **đều bác bỏ H₀** (α = 0,05): lead, cọc, segment gắn với hủy; logistic đa biến pseudo-R² **0,094**. Non Refund hủy rất cao trên mẫu nhỏ → **audit**, không kết luận “đặt cọc đang chặn hủy”.

---

## 3 — Model hủy & scoring · `06`–`09` `11` `13` `14`

| File | Việc |
|------|------|
| [`06`](06_cancellation_model_v1.md) → [`08`](08_cancellation_model_v1_2.md) | RF v1 → v1.2 (+ số, FE, SHAP) |
| [`09`](09_cancellation_model_v2.md) [`09` v2.1](09_cancellation_model_v2_1.md) [`09` FP](09_fp_reduction_v2_1.md) [`09` v2.2](09_cancellation_model_v2_2.md) | LightGBM; giảm FP; calibrate |
| [`11`](11_cancellation_probability_scores.md) [`11` biến](11_cancellation_probability_by_variable.md) [`11b`](11b_cancellation_probability_overview.md) | P(hủy) từng booking + cách đọc tier |
| [`13`](13_cancellation_model_version_selection.md) | Chọn bản theo mục tiêu |
| [`14`](14_key_findings_after_prediction_models.md) | Gộp driver + metric cả chuỗi |

**Kết quả chuỗi model (test):**

| Bản | Việc chốt | AUC | Ghi nhớ |
|-----|-----------|----:|---------|
| RF v1 → v1.2 | Có tín hiệu, SHAP đọc được | 0,73 → **0,84** | Baseline giải thích |
| LGBM v2 @ 0,35 | Engine **scores file 11** | **0,871** | Rec 0,90 · Prec 0,49 |
| v2.1 @ 0,28 | Ít bỏ sót hủy | 0,872 | Rec **0,952** · FN ~225 |
| v2.1 @ 0,51 | Giảm FP không retrain | 0,872 | Rec ≥ 0,85 · FP 3.312 |
| **v2.2 @ 0,25** | Scoring giảm FP | **0,896** | Prec **0,577** · FP **2.939** |

Driver hội tụ với EDA: lead dài, Online TA, thiếu cam kết, PRT / lịch sử hủy, parking & special requests.

**Tier vận hành (scores v2):** Low P < 0,35 (hủy thật ~**4%**) · Medium 0,35–0,55 (~**24%**) · High P ≥ 0,55 (~**64%**, nguồn buffer). High → bán lại; không overbook Low/Medium. Precision ~0,49 → **safety factor** (tránh walk).

---

## 4 — BRD · chính sách · overbooking · `10` `12` `15` `16` `26`

| File | Việc |
|------|------|
| [`10`](10_brd_v1_1.md) | BRD v1.1 — bài toán RevPAR, luật nghiệp vụ |
| [`12` gap](12_brd_gap_analysis.md) · [`12` BRD v1.2](12_brd_v1_2.md) | 4 lỗ hổng BRD + cập nhật tài liệu |
| [`15`](15_policy_scenario.md) | 3 kịch bản cọc + memo quyết định; map A/B hẹp vào 16 tuần |
| [`16`](16_overbooking_policy.md) | Overbook chỉ High-tier, có trần; bật buffer từ Phase 2 |
| [`26`](26_overbooking_buffer_strategy.md) | Buffer pool gắn stance giá + memo go/no-go 16 tuần |

**Kết quả `12`:** Online TA + lead > 90 + Jul–Aug: hủy **46,6%**, **22,6%** doanh thu mất. Tổng mất hủy ước **€11,25M** (**33,7%** tiềm năng). Mis-match phòng **18%** (phần lớn free upgrade). Mô phỏng cọc Online TA lead > 30: net **+€1,52M** (hoặc **+€3,48M** nếu giữ cọc).

**Kết quả `15`–`16`–`26`:** Không siết cọc hàng loạt (OTA ranking). Overbook **chỉ High-tier**, chiết khấu so tỷ lệ hủy thô. Net benefit hủy + buffer (ước) **~€4,2–5,0M**/năm — proxy, không P&L live. Refill buffer **ưu tiên Direct @ BAR**.

---

## 5 — ADR strategy & forecast · `17` `18*` `19` rồi `17b` `20*` `21`

Bản **gộp portfolio** trước, bản **tách City / Resort** sau (canonical cho playbook).

| File | Việc |
|------|------|
| [`17`](17_adr_strategy_analysis.md) | ADR mùa, lead, room ladder (gộp) |
| [`18`](18_demand_forecasting_dynamic_pricing.md) [`18a`](18a_demand_forecasting_dynamic_pricing_adr.md) [`18b`](18b_demand_forecasting_dynamic_pricing_RevPAR.md) | Forecast Demand / ADR / RevPAR gộp |
| [`19`](19_key_findings_after_forecasting_models.md) | Gộp 18* |
| [`17b`](17b_adr_strategy_analysis_city_resort.md) | ADR **tách hotel** |
| [`20`](20_demand_forecasting_dynamic_pricing_city_resort.md) [`20a`](20a_demand_forecasting_dynamic_pricing_adr_city_resort.md) [`20b`](20b_demand_forecasting_dynamic_pricing_RevPAR_city_resort.md) | Forecast **tách hotel** |
| [`21`](21_key_findings_after_forecasting_models_city_resort.md) | Gộp 20* → stance 90 ngày |

**Kết quả `17` / `17b`:** Hai property = hai sản phẩm giá. Weekend surcharge chủ yếu **Resort** (+7% vs +1% City). Last-minute Resort đang rẻ. Free upgrade nặng hơn Resort. Upsell A→D proxy **~€399k**; downgrade **1.747** ca.

**Kết quả `19` (gộp):** Demand primary = **Seasonal Naive** (MAPE **6,9%**). ADR = **SARIMAX** (**6,7%**, thắng Naive 13,2%). RevPAR = **Naive** (**5,2%**). PI SARIMAX chỉ tin được ở Demand.

**Kết quả `21` (tách — dùng cho giá):**

| Series | City | Resort |
|--------|------|--------|
| Demand | Naive MAPE **7,8%** (SARIMAX vỡ 45%) | **Holt** **5,5%** |
| ADR | SARIMAX ≈ Naive **12,4%** | **SARIMAX** **7,1%** |
| RevPAR | Naive **5,3%** | Naive **4,1%** |

Lệch pha: **Sep** gần đồng thuận PROTECT; **Oct** City còn NEUTRAL, Resort đã **STIMULATE**. Gộp `19` đúng hướng mùa, **sai timing** nếu không tách hotel.

---

## 6 — Elasticity → tối ưu → ensemble · `22` `23` `24` `25`

| File | Việc |
|------|------|
| [`22`](22_dynamic_pricing_elasticity_city_resort.md) | ε giá–demand |
| [`23`](23_dynamic_pricing_optimization_city_resort.md) | p\* maximize revenue proxy |
| [`24`](24_dynamic_pricing_ml_city_resort.md) | ML + median ensemble BAR |
| [`25`](25_key_findings_dynamic_pricing_pipeline_city_resort.md) | Gộp 20→24 |

**Kết quả:** OLS lịch sử **bias dương** → không dùng làm ε vận hành. Prior: City **−0,70** · Resort **−1,10**. p\* thuần: City **RAISE ~+21%** (ΔRevPAR **+3,21%**) · Resort **CUT ~−4,5%** (**+0,23%**). ML CV yếu — chỉ làm mềm cực trị. Ensemble: band **floor–recommend–ceil ±15%**; City RAISE/HOLD ôn hòa; Resort HOLD tháng 9 rồi **CUT từ Oct**. Resort Offline ε_ops rất co giãn (~−2,24); Groups **inelastic** → không dump giá.

---

## 7 — Kiểm chứng & playbook · `27` `28`

| File | Việc |
|------|------|
| [`27`](27_validate_simulation_pricing_playbook.md) | What-if · dual-objective · back-test 2015–2016 |
| [`28` playbook](28_finalize_dynamic_pricing_playbook.md) | 3 quyết định khóa + rule giá × mùa × ROI × timeline 16 tuần |
| [`28` strategy](28_dynamic_pricing_strategy.md) | Bản chiến lược đồng bộ số với playbook |

**Kết quả `27`:** Peak ADR **+10%** → City RevPAR **+2,3%** (win-rate Peak 100%); Resort **−2,1%** → **cấm shock**. Low Resort CUT **−5%**: revenue **+0,23%**. Dual-objective hạ BAR **~7–8%** so p\* thuần. Back-test: **go=True** cả hai hotel (ΔRevPAR ≥ 0, Δcancel ≤ +1 pp).

**Kết quả `28` — ma trận khóa:**

| Ô | Stance |
|---|--------|
| City Peak | Harden / RAISE trong band |
| Resort Peak | **HOLD** — không +ADR thuần |
| Resort Low | **CUT ~−5%** (Offline trước Online) |
| Mọi ô | Ensemble ±15% · promote rule mới chỉ khi go=True |

Uplift giá năm hóa (proxy, base ~€2,84M): conservative **~€10k** · full band **~€59k** · + Direct/buffer **~€70–85k**. Booking: Low frictionless · Medium CRM confirm · High buffer → Direct.

---

## 8 — Đóng gói điều hành · `29`–`35` + HTML

| File | Việc | Kết quả / dùng để |
|------|------|-------------------|
| [`29`](29_executive_summary.md) | Memo C-level: 3 can thiệp + timeline 16 tuần + ask duyệt | Duyệt playbook + pilot + Legal parity |
| [`30`](30_final_business_report.md) | Narrative data → quyết định (v1) | Câu chuyện đầy đủ trước feedback |
| [`31`](31_stakeholder_presentation.md) | Deck 12 slide | Họp |
| [`32`](32_stakeholder_presentation_qa.md) | Script + Q&A | Trả lời ε chưa causal, ROI proxy, parity |
| [`33`](33_final_business_report_v2.md) | Report v2 sau góp ý | Nổi hạn chế; shadow ≥ 2 tuần trước pilot giá |
| [`34`](34_implementation_guide.md) | Pilot 16 tuần: 1 trang duyệt + bước thao tác | Cổng go/no-go từng phase; kill switch |
| [`35`](35_project_retrospective.md) | Bài học + monitoring | Tách hotel sớm; không tin OLS ε dương |
| [`29_35` index](29_35_closing_pack_index.md) | Mục lục gói đóng | — |
| [`html/`](html/README.md) | SCQA storytelling | [Live](https://hotel-booking-demand-scqa.vercel.app) |

**Quyết định gói này khóa:** playbook bất đối xứng; không chốt +21%; luồng booking theo tier; pilot có cửa chết; Legal xem rate-parity trước best-rate Direct.

---

## Đọc nhanh theo vai trò

| Bạn cần | Bắt đầu |
|---------|---------|
| 1–2 trang quyết định | [`29`](29_executive_summary.md) |
| Rule giá & booking | [`28`](28_finalize_dynamic_pricing_playbook.md) |
| Vì sao tin rule | [`27`](27_validate_simulation_pricing_playbook.md) ← [`25`](25_key_findings_dynamic_pricing_pipeline_city_resort.md) |
| P(hủy) / buffer | [`11b`](11b_cancellation_probability_overview.md) → [`26`](26_overbooking_buffer_strategy.md) |
| Chọn model hủy | [`13`](13_cancellation_model_version_selection.md) · [`14`](14_key_findings_after_prediction_models.md) |
| Triển khai | [`34`](34_implementation_guide.md) |

Hình: `figures/<số_báo_cáo>/`.
