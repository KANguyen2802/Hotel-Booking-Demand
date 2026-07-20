# Hướng dẫn đọc và đánh giá mô hình ADR forecasting (dynamic pricing)

> **Phạm vi:** `notebooks/18a_demand_forecasting_dynamic_pricing_adr.ipynb` (statsmodels Workflow 4)  
> **Biến mục tiêu:** mean ADR tháng (€/đêm) — stay bookings, `adr > 0`  
> **Dữ liệu:** `hotel_bookings_v5.csv` · **26 tháng** (2015-07 → 2017-08) · mean lịch sử **102,77 €**  
> **Báo cáo kết quả:** [`reports/18a_demand_forecasting_dynamic_pricing_adr.md`](../reports/18a_demand_forecasting_dynamic_pricing_adr.md)  
> **Hình ảnh:** `reports/figures/18_adr/`  
> **Library:** statsmodels **0.14.6**  
> **Guide cùng bộ:** [Demand (18)](Guide%20-%20Cach%20doc%20va%20danh%20gia%20mo%20hinh%20demand%20forecasting.md) · [RevPAR (18b)](Guide%20-%20Cach%20doc%20va%20danh%20gia%20mo%20hinh%20RevPAR%20forecasting.md)

---

## Mục tiêu tài liệu

1. Đọc chart ADR như “giá trung bình đêm theo tháng” — không cần thuộc hết công thức.  
2. Hiểu vì sao **SARIMAX thắng Naive** ở ADR (khác Demand / RevPAR).  
3. Biết khi nào **không** tin prediction interval.  
4. Đổi forecast → stance PROTECT / NEUTRAL / STIMULATE cho BAR.

**Cách dùng:** mỗi chart có *Biểu đồ này nói gì?* → *Nhìn gì trước?* → *Kết luận cho pricing* → *Đừng hiểu nhầm*. Chỉ số ADF/AIC/Ljung–Box chi tiết xem thêm guide Demand (PHẦN I) — logic giống, số liệu khác.

---

## Bối cảnh mô hình notebook 18a (tóm tắt)

| Thành phần | Giá trị |
|---|---|
| Bài toán | Forecast **ADR tháng** hỗ trợ BAR / rate ladder |
| Target | Mean `adr` theo tháng arrival (stay, `adr > 0`) |
| Differencing | `d=1`, `D=0` |
| SARIMAX (best AIC) | `(2,1,2)×(1,0,1,12)` · AIC ≈ 23,1 |
| Holdout | 6 tháng cuối (train 20 / test 6) |
| Best holdout (MAPE) | **SARIMAX ≈ 6,7%** (Naive 13,2%) |
| PI95 coverage | **16,7%** — **không** dùng làm risk band |
| Primary cho stance | **SARIMAX** |

**Khác Demand (nb 18):** volume “copy năm trước” đủ tốt; ADR 2017 có trend tăng giá → Naive bỏ sót, SARIMAX bắt được.

---

# PHẦN I — Chỉ số cần nhớ (ADR)

| Nhóm | Chỉ số ADR (nb 18a) | Đọc nhanh |
|---|---|---|
| Holdout winner | SARIMAX MAPE **6,7%** vs Naive **13,2%** | Primary = SARIMAX |
| Uncertainty | PI coverage **16,7%** | Interval hẹp giả / bias — đừng harden BAR theo PI |
| Residual | Ljung–Box SARIMAX p lag6/12 > 0,05 | Train “sạch” nhưng vẫn phải xem holdout |
| Stance | pressure ≥1,15 / ≤0,90 | PROTECT / STIMULATE trên **giá**, không phải volume |

Công thức stance: `combined_pressure = 0,5·season_index + 0,5·ADR_forecast_index`.

---

# PHẦN II — Cách đọc chart

## Chart 01 — Monthly ADR (overall + by hotel)

![Chart 01 — Monthly ADR](../reports/figures/18_adr/01_monthly_adr_overall.png)

### Biểu đồ này nói gì?

Giá trung bình mỗi đêm khách thực sự ở (ADR) theo tháng. Panel trên = tổng hợp; panel dưới = City vs Resort — thấy mùa giá có lệch property không.

### Nhìn gì trước?

1. **Đáy đông / đỉnh hè rõ chưa?** (~61–80 € vs Jul–Aug ~147–167 € trên holdout).  
2. **Biên độ có lớn hơn demand không?** Thường ADR dao động % mạnh → pricing theo tháng rất quan trọng.  
3. **City vs Resort cùng pha không?** Lệch → BAR ladder nên tách property.

### Kết luận cho pricing

ADR có mùa rất rõ + mean ~103 € → forecast ADR bổ sung tín hiệu volume (nb 18); không dùng rolling average làm primary (dễ làm mượt peak Jul–Aug).

### Đừng hiểu nhầm

| Dễ hiểu sai | Hiểu đúng hơn |
|---|---|
| ADR = giá phòng niêm yết | Đây là giá trung bình trên booking hoàn tất (`adr > 0`) |
| Trend lên = năm sau chắc đắt hơn | Mẫu lệch năm + mix channel đổi — ngoại suy thận trọng |

---

## Chart 02 — Seasonal decompose

![Chart 02 — Decompose](../reports/figures/18_adr/02_seasonal_decompose.png)

### Biểu đồ này nói gì?

Tách ADR thành xu hướng chậm + nhịp 12 tháng + nhiễu. Nhịp năm là “nhạc nền” của giá khách sạn.

### Nhìn gì trước?

1. **Seasonal** sóng rõ → model có mùa là bắt buộc.  
2. **Trend** nghiêng lên qua mẫu (một phần do 2017) → giải thích vì sao Naive (copy năm trước) dễ thua.  
3. **Residual** còn biến động → SARIMAX còn việc để làm sau diff.

### Kết luận cho pricing

Ưu tiên SARIMAX / HW / Seasonal Naive; không dùng ARIMA thuần.

### Đừng hiểu nhầm

Trend tăng trên decompose ≠ “được phép tăng BAR mọi tháng 2018” — phải đối chiếu holdout và competitive set.

---

## Chart 03 — ACF / PACF sau differencing

![Chart 03 — ACF/PACF](../reports/figures/18_adr/03_acf_pacf.png)

### Biểu đồ này nói gì?

Sau khi làm phẳng chuỗi giá (`diff1`), còn “trí nhớ” ngắn hạn và mùa không? Chart gợi ý bậc AR/MA trước khi chạy lưới AIC.

### Nhìn gì trước?

1. Spike vượt band → còn tương quan ở lag đó.  
2. Gần lag 12 → còn nhớ giá cùng tháng năm trước.  
3. n nhỏ → chỉ lấy hướng; order cuối = AIC + holdout → `(2,1,2)×(1,0,1,12)`.

### Kết luận cho pricing

Giải thích *vì sao* SARIMAX ADR phức tạp hơn Demand `(0,1,2)…` (có thêm AR(2)); không thay thế Chart 05 khi chọn primary.

### Đừng hiểu nhầm

Không cần thuộc ACF để làm pricing — nhảy Chart 05a/05b nếu chỉ cần biết model nào thắng.

---

## Chart 04 — SARIMAX residual diagnostics

![Chart 04 — Diagnostics](../reports/figures/18_adr/04_sarimax_diagnostics.png)

### Biểu đồ này nói gì?

Phần sai trên train của SARIMAX ADR còn mang chu kỳ / lệch hệ thống không?

### Nhìn gì trước?

1. Residual quanh 0 theo thời gian.  
2. Correlogram nằm trong band.  
3. Residual std ~**38 €** trên mean ~103 € — sai số tuyệt đối vẫn lớn.

### Kết luận cho pricing

Train sạch (Ljung–Box OK) → được phép dùng point SARIMAX. **Không** tự động tin PI: coverage holdout chỉ 16,7%.

### Đừng hiểu nhầm

| Dễ hiểu sai | Hiểu đúng hơn |
|---|---|
| Diagnostics đẹp = PI đáng tin | PI phải kiểm bằng coverage trên holdout |
| Residual std lớn → bỏ model | Point forecast vẫn có thể thắng MAPE (và đã thắng) |

---

## Chart 05a — Holdout forecasts + 95% PI

![Chart 05a — Holdout forecasts](../reports/figures/18_adr/05_holdout_forecasts.png)

### Biểu đồ này nói gì?

6 tháng cuối: giá thật vs các model đoán. Đây là chỗ thấy rõ SARIMAX bám hè 2017 tốt hơn “copy năm trước”.

### Nhìn gì trước?

1. **Ai sát actual nhất?** → SARIMAX (đặc biệt Apr–Jun).  
2. **Actual có nằm trong vùng tô không?** → hầu như **không** (coverage 16,7%).  
3. Holt trend thiếu mùa → lệch mạnh khi ADR tăng hè.

### Kết luận cho pricing

- **Point forecast ADR** = **SARIMAX**.  
- **Không dùng PI 95%** làm risk band trên cửa sổ này.  
- Naive giữ làm đối chứng (an toàn hơn nếu 2018 không giữ trend giá 2017).

### Đừng hiểu nhầm

| Dễ hiểu sai | Hiểu đúng hơn |
|---|---|
| Vùng tô hẹp = chắc chắn | Hẹp nhưng trượt actual → tự tin giả |
| SARIMAX cao hơn Naive ~15–20 € ở forecast → khóa BAR theo SARIMAX ngay | Kiểm tra pickup & competitive set trước khi lock |

---

## Chart 05b — Holdout MAPE (bar)

![Chart 05b — Holdout MAPE](../reports/figures/18_adr/05_holdout_metrics.png)

### Biểu đồ này nói gì?

Xếp hạng % lỗi giá: cột thấp = tốt. Nb 18a: **SARIMAX 6,7%** << Naive 13,2% << Holt 40%.

### Nhìn gì trước?

1. Gap ~6 điểm % vs Naive — đủ lớn để đổi primary sang SARIMAX.  
2. Holt 40% = cảnh báo: model thiếu mùa gần như vô dụng cho ADR.  
3. Đây là trọng tài chọn BAR signal — không phải AIC.

### Kết luận cho pricing

Primary rate calendar ADR = SARIMAX; Naive đối chứng; Holt không dùng.

### Đừng hiểu nhầm

Thắng MAPE ≠ thắng PI. Ở ADR: điểm tốt, khoảng tin cậy kém.

---

## Chart 07 — Forecast 6 tháng (full sample)

![Chart 07 — Forecast horizon](../reports/figures/18_adr/07_forecast_horizon.png)

### Biểu đồ này nói gì?

Dự báo ADR Sep 2017 → Feb 2018 (minh họa). Primary = đường SARIMAX; Naive / HW đối chứng.

### Nhìn gì trước?

1. **Hướng mùa:** Sep còn cao → Nov–Jan thấp → Feb hồi nhẹ — 3 model cùng hướng.  
2. **Mức:** SARIMAX thường **cao hơn Naive ~15–22 €** — phản ánh trend 2017.  
3. PI hẹp trên chart → nhớ coverage holdout kém, đọc mang tính minh họa.

### Kết luận cho pricing

Sep bảo vệ BAR; Nov–Jan nới / promo có floor; luôn đối chiếu pickup thực tế.

### Đừng hiểu nhầm

| Dễ hiểu sai | Hiểu đúng hơn |
|---|---|
| Cận dưới PI = sàn giá cứng | PI chưa tin được trên holdout |
| Forecast 2018 = cam kết doanh thu | Horizon minh họa sau Aug-2017 |

| Tháng (primary SARIMAX) | ADR forecast | Gợi ý nhanh |
|---|---:|---|
| 2017-09 | 143,4 € | PROTECT |
| 2017-10 | 116,8 € | NEUTRAL |
| 2017-11 | 91,4 € | STIMULATE |
| 2017-12 | 100,5 € | NEUTRAL |
| 2018-01 | 88,0 € | STIMULATE |
| 2018-02 | 96,5 € | STIMULATE |

---

## Chart 08 — Pricing stance (ADR pressure)

![Chart 08 — Pricing stance](../reports/figures/18_adr/08_pricing_stance.png)

### Biểu đồ này nói gì?

Đổi ADR forecast thành hành động giá: cột đỏ = tháng giá mạnh → harden BAR; cột xanh = tháng giá yếu → kích cầu có floor.

### Nhìn gì trước?

1. ≥ 1,15 → **PROTECT** (Sep rõ: 1,29).  
2. ≤ 0,90 → **STIMULATE** (Nov / Jan / Feb).  
3. Giữa khoảng → NEUTRAL (Oct / Dec).

### Kết luận cho pricing

| Tháng | Stance ADR | Việc nên nghĩ tới |
|---|---|---|
| Sep | **PROTECT** | Harden BAR; hạn chế dump OTA; weekend premium nhẹ |
| Oct / Dec | NEUTRAL | Hold BAR; chỉnh tactical |
| Nov / Jan / Feb | **STIMULATE** | Early-bird / mid-week; giữ floor tránh race-to-bottom |

Ghép volume stance (nb 18) + ADR season/weekend (nb 17): Dec–Jan thường vừa kích cầu volume vừa nới ADR có kiểm soát.

### Đừng hiểu nhầm

| Dễ hiểu sai | Hiểu đúng hơn |
|---|---|
| STIMULATE ADR = xả giá OTA | Promo có floor; ưu tiên package / LOS |
| Chỉ nhìn ADR stance | Đối chiếu Demand + RevPAR cùng tháng (xem report 18b §7.3) |

---

# PHẦN III — Checklist nhanh ADR

1. Chart 01–02: mùa giá có rõ không?  
2. Chart 05b: SARIMAX có thắng Naive ≥ ~2 điểm MAPE không? → có (6,7% vs 13,2%).  
3. Chart 05a: PI coverage có > ~50% không? → **không** → bỏ PI khỏi risk band.  
4. Chart 07–08: Sep PROTECT; Nov–Feb thiên STIMULATE.  
5. Mỗi quý: re-fit holdout; nếu Naive bắt kịp 2 cửa sổ liên tiếp → xem lại primary.

## Trade-off nb 18a

```
ADR + trend giá 2017 + seasonality
        │
        ├── SARIMAX          → MAPE holdout tốt nhất (~6,7%)  → PRIMARY point forecast
        ├── Seasonal Naive   → đối chứng an toàn nếu trend gãy
        ├── 95% PI           → coverage kém (~17%)            → KHÔNG dùng risk band
        └── Holt trend       → thiếu mùa (MAPE ~40%)          → không dùng
```

---

## Tài liệu liên quan

| File | Nội dung |
|---|---|
| `notebooks/18a_demand_forecasting_dynamic_pricing_adr.ipynb` | Notebook nguồn |
| `reports/18a_demand_forecasting_dynamic_pricing_adr.md` | Báo cáo + playbook |
| [`Guide Demand`](Guide%20-%20Cach%20doc%20va%20danh%20gia%20mo%20hinh%20demand%20forecasting.md) | Volume + chỉ số nền |
| [`Guide RevPAR`](Guide%20-%20Cach%20doc%20va%20danh%20gia%20mo%20hinh%20RevPAR%20forecasting.md) | KPI tổng hợp |
| `reports/17_adr_strategy_analysis.md` | Season / weekend / lead-time |

---

*Cập nhật: 20/7/2026 — guide đọc chart ADR plain-language (cùng khung với Demand / RevPAR).*
