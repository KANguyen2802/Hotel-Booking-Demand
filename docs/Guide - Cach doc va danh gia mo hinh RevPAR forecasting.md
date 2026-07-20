# Hướng dẫn đọc và đánh giá mô hình RevPAR forecasting (dynamic pricing)

> **Phạm vi:** `notebooks/18b_demand_forecasting_dynamic_pricing_RevPAR.ipynb` (statsmodels Workflow 4)  
> **Biến mục tiêu:** RevPAR tháng (proxy) = `ADR × Occupancy_Rate`  
> **Dữ liệu:** `hotel_bookings_v5.csv` · **26 tháng** (2015-07 → 2017-08) · mean lịch sử **73,92 €**  
> **Báo cáo kết quả:** [`reports/18b_demand_forecasting_dynamic_pricing_RevPAR.md`](../reports/18b_demand_forecasting_dynamic_pricing_RevPAR.md)  
> **Hình ảnh:** `reports/figures/18_revpar/`  
> **Library:** statsmodels **0.14.6**  
> **Guide cùng bộ:** [Demand (18)](Guide%20-%20Cach%20doc%20va%20danh%20gia%20mo%20hinh%20demand%20forecasting.md) · [ADR (18a)](Guide%20-%20Cach%20doc%20va%20danh%20gia%20mo%20hinh%20ADR%20forecasting.md)

---

## Mục tiêu tài liệu

1. Đọc RevPAR như “một số tổng hợp giá × công suất” — và nhớ đây là **proxy**, không phải RevPAR kế toán.  
2. Hiểu vì sao **Seasonal Naive thắng** (giống Demand, khác ADR).  
3. Biết **không** dùng SARIMAX PI (coverage 0% trên holdout).  
4. Đối chiếu 3 stance (volume · ADR · RevPAR) trước khi chốt hành động tháng.

**Cách dùng:** mỗi chart có *Biểu đồ này nói gì?* → *Nhìn gì trước?* → *Kết luận cho pricing* → *Đừng hiểu nhầm*.

---

## Bối cảnh mô hình notebook 18b (tóm tắt)

| Thành phần | Giá trị |
|---|---|
| Bài toán | Forecast **RevPAR tháng** (KPI tổng hợp rate × occ) |
| Công thức (nb 01) | `RevPAR = ADR × Occupancy_Rate` (Occupancy = tỷ lệ không hủy — **proxy**) |
| Differencing | `d=1`, `D=0` |
| SARIMAX (best AIC) | `(0,1,2)×(1,0,1,12)` · AIC ≈ 18,3 (cùng họ Demand) |
| Holdout | 6 tháng cuối |
| Best holdout (MAPE) | **Seasonal Naive ≈ 5,2%** (SARIMAX 18,1%) |
| PI95 coverage | **0%** — không dùng |
| Primary cho stance | **Seasonal Naive** |

**Vì sao giống Demand hơn ADR?** RevPAR bị kéo bởi occupancy/volume theo năm → “copy mùa năm trước” ổn định hơn cấu trúc AR/MA trên mẫu ngắn.

---

# PHẦN I — Chỉ số cần nhớ (RevPAR)

| Nhóm | Chỉ số RevPAR (nb 18b) | Đọc nhanh |
|---|---|---|
| Holdout winner | Naive MAPE **5,2%** vs SARIMAX **18,1%** | Primary = Naive |
| Uncertainty | PI coverage **0%** | SARIMAX thiên thấp — bỏ PI khỏi risk band |
| Ý nghĩa metric | Mean 73,92 € < mean ADR ~103 € | Đúng kỳ vọng vì nhân Occupancy < 1 |
| Stance | pressure ≥1,15 / ≤0,90 | PROTECT / STIMULATE trên KPI tổng hợp |

Khi stance RevPAR **lệch** ADR hoặc Demand → ưu tiên lever đang yếu (occ vs rate). Xem bảng đối chiếu 3 notebook ở cuối guide / report §7.3.

---

# PHẦN II — Cách đọc chart

## Chart 01 — Monthly RevPAR (overall + by hotel)

![Chart 01 — Monthly RevPAR](../reports/figures/18_revpar/01_monthly_revpar_overall.png)

### Biểu đồ này nói gì?

Một đường “sức khỏe doanh thu phòng” theo tháng: vừa phản ánh giá, vừa phản ánh công suất (proxy). Panel dưới tách City vs Resort.

### Nhìn gì trước?

1. **Thấp đông / cao hè** có rõ không? — thường là kết hợp pattern ADR + occupancy.  
2. **Mức có thấp hơn ADR không?** (~74 vs ~103) → đúng; đừng so tuyệt đối hai metric như nhau.  
3. **Hai property lệch biên độ?** → tối ưu RevPAR nên tách property.

### Kết luận cho pricing

RevPAR = KPI điều hành tổng hợp. Khi cần biết *vì sao* thấp: phải tách nhìn ADR (giá) và occupancy/demand (phòng đầy/vắng).

### Đừng hiểu nhầm

| Dễ hiểu sai | Hiểu đúng hơn |
|---|---|
| Đây là RevPAR chuẩn ngành (rooms sold / available) | Proxy từ booking success — dùng xu hướng / stance, không thay báo cáo kế toán |
| RevPAR tăng = chắc do tăng giá | Có thể do occ tăng, giá tăng, hoặc cả hai |

---

## Chart 02 — Seasonal decompose

![Chart 02 — Decompose](../reports/figures/18_revpar/02_seasonal_decompose.png)

### Biểu đồ này nói gì?

Tách RevPAR thành trend + mùa 12 tháng + residual. Mùa năm thống trị — giống Demand.

### Nhìn gì trước?

1. Seasonal sóng rõ → model seasonal là mặc định hợp lý.  
2. Trend nghiêng nhẹ (ADR 2017 + lệch năm mẫu).  
3. Residual còn nhiễu → AR/MA vẫn có chỗ, nhưng holdout sẽ cho thấy Naive vẫn thắng.

### Kết luận cho pricing

Ưu tiên Naive / SARIMAX seasonal / HW; quyết định primary chỉ sau Chart 05.

### Đừng hiểu nhầm

Decompose đẹp ≠ chọn được primary. Ở RevPAR, AIC đẹp nhưng holdout SARIMAX kém.

---

## Chart 03 — ACF / PACF sau differencing

![Chart 03 — ACF/PACF](../reports/figures/18_revpar/03_acf_pacf.png)

### Biểu đồ này nói gì?

Gợi ý bậc AR/MA sau `diff1`. Order AIC-best trùng họ Demand: `(0,1,2)×(1,0,1,12)`.

### Nhìn gì trước?

1. Spike ngoài band / gần lag 12 = còn cấu trúc.  
2. n nhỏ → hướng thôi.  
3. Có thể bỏ qua nếu chỉ cần biết ai thắng holdout → Chart 05.

### Kết luận cho pricing

Giải thích *cấu trúc thử nghiệm*; không giải thích *vì sao Naive thắng 5,2% vs 18,1%*.

---

## Chart 04 — SARIMAX residual diagnostics

![Chart 04 — Diagnostics](../reports/figures/18_revpar/04_sarimax_diagnostics.png)

### Biểu đồ này nói gì?

Trên train, residual SARIMAX RevPAR trông rất “sạch” (Ljung–Box p rất cao). Đây là ví dụ điển hình: **train sạch nhưng ngoài mẫu vẫn kém**.

### Nhìn gì trước?

1. Correlogram / residual time: ổn trên train.  
2. Residual std ~**21 €** trên mean ~74 €.  
3. Nhắc mình: đừng dừng ở chart này để chọn pricing model.

### Kết luận cho pricing

Diagnostics đạt → được phép *thử* SARIMAX; Chart 05 sẽ loại khỏi primary và loại PI.

### Đừng hiểu nhầm

| Dễ hiểu sai | Hiểu đúng hơn |
|---|---|
| p Ljung–Box rất cao = model tốt nhất | Chỉ nói residual train ít autocorrelation |
| Bỏ qua holdout vì diagnostics đẹp | Holdout MAPE / coverage mới chốt việc |

---

## Chart 05a — Holdout forecasts + 95% PI

![Chart 05a — Holdout forecasts](../reports/figures/18_revpar/05_holdout_forecasts.png)

### Biểu đồ này nói gì?

Cuộc thi 6 tháng cuối trên RevPAR: Naive bám actual; SARIMAX **thiên thấp** rõ (Apr–Aug); vùng tô gần như không ôm được actual (coverage **0%**).

### Nhìn gì trước?

1. Đường nào sát actual? → **Seasonal Naive**.  
2. Actual có trong PI không? → **không**.  
3. Holt thiếu mùa → kém nhất.

### Kết luận cho pricing

- **Point forecast RevPAR** = Seasonal Naive.  
- **Không dùng** SARIMAX point hay PI cho điều hành trên cửa sổ này.  
- SARIMAX chỉ đối chứng đến khi có ≥36 tháng / exog / capacity thật.

### Đừng hiểu nhầm

| Dễ hiểu sai | Hiểu đúng hơn |
|---|---|
| Có vùng tô trên chart = vẫn dùng được PI | Coverage 0% = interval lệch hoàn toàn |
| SARIMAX AIC thấp → nên primary | AIC train ≠ MAPE holdout |

---

## Chart 05b — Holdout MAPE (bar)

![Chart 05b — Holdout MAPE](../reports/figures/18_revpar/05_holdout_metrics.png)

### Biểu đồ này nói gì?

Xếp hạng % lỗi: **Naive 5,2%** << SARIMAX 18,1% << Holt 34,6%. Khoảng cách rất lớn — ít tranh cãi khi chọn primary.

### Nhìn gì trước?

1. Cột thấp nhất = Naive.  
2. Gap ~13 điểm % vs SARIMAX — không phải “chênh nhẹ”.  
3. Pattern giống Demand (18), ngược ADR (18a).

### Kết luận cho pricing

Primary KPI tổng hợp = Seasonal Naive; re-benchmark mỗi quý trước khi đổi sang SARIMAX.

### Đừng hiểu nhầm

RevPAR Naive thắng **không** có nghĩa ADR cũng phải dùng Naive — mỗi series chọn riêng (xem report 19).

---

## Chart 07 — Forecast 6 tháng (full sample)

![Chart 07 — Forecast horizon](../reports/figures/18_revpar/07_forecast_horizon.png)

### Biểu đồ này nói gì?

Dự báo RevPAR 6 tháng tới (minh họa). Primary = Naive; SARIMAX/HW thường hơi cao hơn ở vài tháng.

### Nhìn gì trước?

1. **Hướng:** Sep cao; Dec–Jan đáy; Feb hồi nhẹ — đồng thuận.  
2. **Divergence** lớn hơn ở Dec–Feb → tháng yếu càng cần mềm khi chốt.  
3. Bỏ qua việc “chốt theo cận PI”.

### Kết luận cho pricing

Sep bảo vệ revenue tổng hợp; Nov–Feb kích cầu có kiểm soát; luôn đọc kèm Demand (18) và ADR (18a).

| Tháng (primary Naive) | RevPAR forecast | Gợi ý nhanh |
|---|---:|---|
| 2017-09 | 86,6 € | PROTECT |
| 2017-10 | 69,1 € | NEUTRAL |
| 2017-11 | 60,7 € | STIMULATE |
| 2017-12 | 59,2 € | STIMULATE |
| 2018-01 | 54,8 € | STIMULATE |
| 2018-02 | 57,6 € | STIMULATE |

---

## Chart 08 — Pricing stance (RevPAR pressure)

![Chart 08 — Pricing stance](../reports/figures/18_revpar/08_pricing_stance.png)

### Biểu đồ này nói gì?

Đổi RevPAR forecast thành hành động: đỏ = bảo vệ doanh thu phòng; xanh = kích cầu vì KPI tổng hợp yếu.

### Nhìn gì trước?

1. Sep ≥ 1,15 → **PROTECT**.  
2. Nov–Feb ≤ 0,90 → **STIMULATE**.  
3. Oct giữa khoảng → NEUTRAL.

### Kết luận cho pricing

| Tháng | Stance RevPAR | Việc nên nghĩ tới |
|---|---|---|
| Sep | **PROTECT** | Harden BAR + bảo vệ inventory |
| Oct | NEUTRAL | Cân bằng rate–occ |
| Nov–Feb | **STIMULATE** | Promo / mở bán linh hoạt + giữ floor ADR |

### Đừng hiểu nhầm

| Dễ hiểu sai | Hiểu đúng hơn |
|---|---|
| RevPAR STIMULATE = luôn cắt giá | Có thể cần tăng occ (mở bán) hơn là xả ADR |
| Một stance đủ quyết định | Phải đối chiếu 3 tín hiệu (bảng dưới) |

---

# PHẦN III — Đối chiếu 3 series (cùng cửa sổ minh họa)

| Tháng | Demand (18) | ADR (18a) | RevPAR (18b) | Ưu tiên hành động |
|---|---|---|---|---|
| Sep | NEUTRAL | **PROTECT** | **PROTECT** | Harden BAR; bảo vệ inventory |
| Oct | NEUTRAL≈protect | NEUTRAL | NEUTRAL | Hold; hạn chế dump |
| Nov | NEUTRAL | **STIMULATE** | **STIMULATE** | Promo có floor |
| Dec | **STIMULATE** | NEUTRAL | **STIMULATE** | Kích cầu volume; giữ ADR floor |
| Jan | **STIMULATE** | **STIMULATE** | **STIMULATE** | Kích cầu mạnh + floor |
| Feb | NEUTRAL | **STIMULATE** | **STIMULATE** | Promo nhẹ; chuẩn bị shoulder |

## Checklist nhanh RevPAR

1. Nhớ metric là **proxy** — xu hướng, không kế toán.  
2. Chart 05: Naive thắng rõ; PI coverage 0% → bỏ PI.  
3. Chart 08: Sep PROTECT; Nov–Feb STIMULATE.  
4. Mỗi tháng: mở bảng 3 stance trước khi lock BAR.  
5. Khi có capacity thật: thay Occupancy proxy bằng Rooms sold / Available.

## Trade-off nb 18b

```
RevPAR proxy = ADR × occ  +  seasonality mạnh  +  mẫu ngắn
        │
        ├── Seasonal Naive   → MAPE ~5,2%     → PRIMARY point forecast
        ├── SARIMAX AIC-best → holdout kém + PI coverage 0%  → chỉ đối chứng
        └── Holt trend       → thiếu mùa (~35% MAPE)         → không dùng
```

---

## Tài liệu liên quan

| File | Nội dung |
|---|---|
| `notebooks/18b_demand_forecasting_dynamic_pricing_RevPAR.ipynb` | Notebook nguồn |
| `reports/18b_demand_forecasting_dynamic_pricing_RevPAR.md` | Báo cáo + playbook đối chiếu 3 series |
| `reports/19_key_findings_after_forecasting_models.md` | Tổng hợp executive 3 mô hình |
| [`Guide Demand`](Guide%20-%20Cach%20doc%20va%20danh%20gia%20mo%20hinh%20demand%20forecasting.md) | Volume |
| [`Guide ADR`](Guide%20-%20Cach%20doc%20va%20danh%20gia%20mo%20hinh%20ADR%20forecasting.md) | Giá/đêm |

---

*Cập nhật: 20/7/2026 — guide đọc chart RevPAR plain-language (cùng khung với Demand / ADR).*
