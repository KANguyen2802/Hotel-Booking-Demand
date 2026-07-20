# Hướng dẫn đọc và đánh giá mô hình demand forecasting (dynamic pricing)

> **Phạm vi:** `notebooks/18_demand_forecasting_dynamic_pricing.ipynb` (statsmodels Workflow 4)  
> **Biến mục tiêu:** demand tháng = số stay bookings (`is_canceled = 0`)  
> **Dữ liệu:** `hotel_bookings_v5.csv` · 59.527 stay · **26 tháng** (2015-07 → 2017-08)  
> **Báo cáo kết quả:** [`reports/18_demand_forecasting_dynamic_pricing.md`](../reports/18_demand_forecasting_dynamic_pricing.md)  
> **Hình ảnh:** `reports/figures/18/`  
> **Library:** statsmodels **0.14.6**  
> **Guide cùng bộ:** [ADR (18a)](Guide%20-%20Cach%20doc%20va%20danh%20gia%20mo%20hinh%20ADR%20forecasting.md) · [RevPAR (18b)](Guide%20-%20Cach%20doc%20va%20danh%20gia%20mo%20hinh%20RevPAR%20forecasting.md)

---

## Mục tiêu tài liệu

Sau khi đọc xong, bạn có thể:

1. Đọc đúng **mọi chỉ số** time-series (ADF/KPSS, AIC/BIC, MAE/RMSE/MAPE, Ljung–Box, PI coverage).
2. Đọc **toàn bộ chart** trong notebook / báo cáo 18 — kể cả khi chưa quen thuật ngữ thống kê.
3. Phân biệt *model thắng trên train (AIC)* vs *model thắng ngoài mẫu (holdout MAPE)*.
4. Liên kết chỉ số ↔ chart ↔ **pricing stance** (PROTECT / NEUTRAL / STIMULATE).

**Cách dùng phần chart (PHẦN II):** mỗi biểu đồ có khối *Biểu đồ này nói gì?* → *Nhìn gì trước?* → *Kết luận cho pricing* → *Đừng hiểu nhầm*. Đọc khối này trước; bảng kỹ thuật bên dưới dành khi cần đào sâu.

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

> Mỗi chart tự đứng được: đọc 4 khối plain-language trước, rồi mới xem bảng kỹ thuật nếu cần.

---

## Chart 01 — Monthly demand (overall + by hotel)

![Chart 01 — Monthly demand](../reports/figures/18/01_monthly_demand_overall.png)

### Biểu đồ này nói gì?

Đây là “nhịp thở” số phòng bán được theo tháng. Panel trên = tổng cả hai khách sạn; panel dưới = tách City vs Resort để thấy mùa có giống nhau không.

### Nhìn gì trước?

1. **Sóng lặp mỗi năm chưa?** (cao hè / thấp đông) → nếu có, model có mùa sẽ thắng model “phẳng”.  
2. **Đỉnh–đáy cách nhau bao xa?** Biên độ lớn = pricing theo tháng có ý nghĩa.  
3. **Hai đường City/Resort có cùng hình không?** Nếu lệch → đừng áp một rate calendar cho cả hai.

### Kết luận cho pricing (nb 18)

Demand có mùa rõ trên 26 tháng (~59.527 stay) → dùng forecast theo tháng là đúng hướng; rolling average dễ “làm mượt” mất peak.

### Đừng hiểu nhầm

| Dễ hiểu sai | Hiểu đúng hơn |
|---|---|
| Đường đi lên nhẹ = “năm sau chắc tăng mạnh” | Mẫu lệch năm (2015 chỉ H2, 2017 cắt Aug) — trend chỉ mang tính gợi ý |
| Hai hotel cùng chart = cùng policy | Biên độ khác → nên tách property khi triển khai |

| Panel | Đọc kỹ thuật ngắn |
|---|---|
| **Trên** | Chuỗi bookings tháng tổng; peak/trough theo năm |
| **Dưới** | City vs Resort — biên độ và pha mùa |

---

## Chart 02 — Seasonal decompose

![Chart 02 — Decompose](../reports/figures/18/02_seasonal_decompose.png)

### Biểu đồ này nói gì?

Máy “tách” chuỗi gốc thành 3 lớp: xu hướng chậm (trend), nhịp năm (seasonal), và phần nhiễu còn lại (residual). Giống tách bản nhạc thành bass / beat / noise.

### Nhìn gì trước?

1. **Seasonal** có sóng rõ, lặp 12 tháng không? → tín hiệu chính của hotel.  
2. **Trend** chỉ hơi nghiêng hay nhảy mạnh? → nghiêng nhẹ trên mẫu ngắn = đừng tin quá.  
3. **Residual** còn “nhám” không? → còn chỗ cho SARIMAX bắt phần còn lại.

### Kết luận cho pricing

Seasonality năm mạnh → Seasonal Naive / SARIMAX seasonal / Holt–Winters hợp lý hơn ARIMA thuần (không có mùa).

### Đừng hiểu nhầm

| Dễ hiểu sai | Hiểu đúng hơn |
|---|---|
| Trend tăng = kế hoạch bán 2018 chắc chắn cao hơn | Trend trên ~26 điểm dễ bị lệch cấu trúc năm — chỉ minh họa |
| Residual đẹp = model forecast chắc thắng | Decompose chưa phải model; phải xem holdout MAPE |

| Thành phần | Ý nghĩa đời thường |
|---|---|
| Observed | Số booking thật từng tháng |
| Trend | “Mức nền” thay đổi chậm |
| Seasonal | Tháng nào thường đông / vắng (lặp mỗi năm) |
| Residual | Phần không giải thích được bằng trend + mùa |

---

## Chart 03 — ACF / PACF sau differencing

![Chart 03 — ACF/PACF](../reports/figures/18/03_acf_pacf.png)

### Biểu đồ này nói gì?

Hai “thước đo trí nhớ” của chuỗi sau khi đã làm phẳng (diff): tháng này còn “dính” tháng trước / cùng tháng năm trước bao nhiêu. Dùng để **gợi ý** cấu hình SARIMAX, không phải chấm điểm cuối.

### Nhìn gì trước?

1. Cột vượt ra ngoài dải xanh đậm = tương quan còn đáng kể ở lag đó.  
2. Spike quanh lag 12 = còn “nhớ mùa năm trước”.  
3. Với chỉ ~25 điểm sau diff → lấy **hướng**, đừng đếm từng cột để chọn order tay.

### Kết luận cho pricing

Nb 18 dùng ACF/PACF + lưới AIC → chốt `SARIMAX(0,1,2)×(1,0,1,12)`. Chart này giải thích *vì sao thử seasonal AR/MA*, không giải thích *vì sao Naive thắng holdout*.

### Đừng hiểu nhầm

| Dễ hiểu sai | Hiểu đúng hơn |
|---|---|
| Thấy spike đẹp → model đó chắc thắng pricing | Order cuối = AIC trên train + **MAPE holdout** |
| Không hiểu ACF = bỏ qua cả notebook | Có thể bỏ qua chi tiết; nhảy thẳng Chart 05a/05b để chọn model |

| Chart | Gợi ý order (kỹ thuật) |
|---|---|
| **ACF** | Cutoff lag q → MA(q); spike lag 12 → seasonal MA |
| **PACF** | Cutoff lag p → AR(p); spike lag 12 → seasonal AR |

---

## Chart 04 — SARIMAX residual diagnostics

![Chart 04 — Diagnostics](../reports/figures/18/04_sarimax_diagnostics.png)

### Biểu đồ này nói gì?

Kiểm tra “phần sai” của SARIMAX trên **dữ liệu đã học** còn mang hình dạng có hệ thống không. Nếu residual nhảy lung tung quanh 0 và không còn chu kỳ rõ → model đã “hút” hết cấu trúc dễ thấy trên train.

### Nhìn gì trước?

1. **Residuals theo thời gian:** dao động quanh 0, không lệch một phía lâu dài.  
2. **Histogram / Q–Q:** gần đối xứng / gần đường chuẩn (mẫu ngắn thì hơi lệch vẫn bình thường).  
3. **Correlogram:** hầu hết cột nằm trong band → ít “trí nhớ” còn sót.

### Kết luận cho pricing

Diagnostics đạt (Ljung–Box p > 0,05) → **được phép** dùng SARIMAX cho dải rủi ro. Vẫn **chưa đủ** để chọn primary: phải xem Chart 05.

### Đừng hiểu nhầm

| Dễ hiểu sai | Hiểu đúng hơn |
|---|---|
| Q–Q hơi lệch → bỏ SARIMAX | Mẫu ngắn dễ lệch hình; ưu tiên Ljung–Box + holdout |
| Residual sạch = forecast ngoài mẫu tốt | Train sạch ≠ thắng 6 tháng holdout (ở đây Naive vẫn thắng MAPE) |

| Panel | Dấu hiệu “ổn” |
|---|---|
| Residuals vs time | Quanh 0, không trend rõ |
| Histogram / KDE | Gần đối xứng quanh 0 |
| Q–Q | Điểm gần đường chuẩn |
| Correlogram | Spike trong band |

---

## Chart 05a — Holdout forecasts + 95% PI

![Chart 05a — Holdout forecasts](../reports/figures/18/05_holdout_forecasts.png)

### Biểu đồ này nói gì?

Cuộc thi công khai: 6 tháng cuối **giấu** khỏi lúc train, rồi các model phải đoán. Đường đậm = thực tế; các đường đứt/chấm = dự báo; vùng tô = khoảng “chắc khoảng 95%” của SARIMAX.

### Nhìn gì trước?

1. **Ai bám sát đường actual nhất?** → Seasonal Naive.  
2. **Actual có nằm trong vùng tô không?** → có (coverage 100%).  
3. **Vùng tô rộng hay hẹp?** → rất rộng → biết được biên rủi ro, khó chốt một số cứng cho BAR.

### Kết luận cho pricing

- **Point forecast volume** = Seasonal Naive.  
- **Dải rủi ro** = SARIMAX 95% PI (cảnh báo khi actual lệch khỏi PI).  
- Holt trend thiếu mùa → lệch ở tháng mùa mạnh.

### Đừng hiểu nhầm

| Dễ hiểu sai | Hiểu đúng hơn |
|---|---|
| Coverage 100% = model hoàn hảo | PI rộng dễ “ôm” mọi thứ — độ bao phủ cao nhưng ít hữu ích để chốt giá |
| Lấy cận trên PI làm target bán | PI là biên bất định, không phải KPI doanh số |

| Thành phần | Ý nghĩa đời thường |
|---|---|
| Actual | Sự thật 6 tháng cuối |
| Các đường model | Mỗi model “đoán” thế nào |
| Vùng tô (PI) | Khoảng rủi ro SARIMAX |
| Đường dọc xám | Ranh giới train → test |

---

## Chart 05b — Holdout MAPE (bar)

![Chart 05b — Holdout MAPE](../reports/figures/18/05_holdout_metrics.png)

### Biểu đồ này nói gì?

Bảng xếp hạng lỗi theo %: cột càng thấp càng đoán sát. Đây là **trọng tài cuối** chọn model cho rate calendar volume.

### Nhìn gì trước?

1. Cột thấp nhất = primary. Nb 18: **Naive ~6,9%** < Holt ~8,1% < SARIMAX ~9,1%.  
2. Gap ~2 điểm % so với SARIMAX ≈ hàng trăm booking/tháng — đủ lớn để chọn Naive.  
3. Đừng so AIC ở đây — AIC ở train, MAPE ở holdout.

### Kết luận cho pricing

```
Holdout MAPE thấp nhất  →  primary point forecast (pricing volume)
AIC thấp nhất (train)   →  chỉ lọc trong họ SARIMAX / diagnostics
PI hẹp + coverage tốt   →  tin uncertainty band hơn
```

### Đừng hiểu nhầm

| Dễ hiểu sai | Hiểu đúng hơn |
|---|---|
| SARIMAX thua MAPE → xóa hẳn | Giữ SARIMAX cho PI / đối chứng |
| Cột gần nhau = chọn model nào cũng được | Với revenue, 2 điểm MAPE vẫn đáng kể trên chuỗi ngắn |

---

## Chart 07 — Forecast 6 tháng (full sample)

![Chart 07 — Forecast horizon](../reports/figures/18/07_forecast_horizon.png)

### Biểu đồ này nói gì?

Sau khi chọn xong model, vẽ **6 tháng phía trước** (Sep 2017 → Feb 2018, minh họa). Lịch sử bên trái đường xám; phần phải là dự báo + vùng rủi ro SARIMAX.

### Nhìn gì trước?

1. **Hướng mùa có đồng thuận không?** Oct cao hơn, Dec–Jan thấp hơn — cả 3 model cùng hướng.  
2. **Mức điểm có lệch nhau không?** (vd. Nov) → càng lệch càng nên mềm khi chốt BAR.  
3. **PI có nở dần theo tháng không?** → càng xa càng bất định.

### Kết luận cho pricing

Tín hiệu mùa (cao/thấp) đáng tin hơn con số tuyệt đối từng model. Primary stance lấy **Seasonal Naive**; đọc kèm PI khi model lệch nhau.

### Đừng hiểu nhầm

| Dễ hiểu sai | Hiểu đúng hơn |
|---|---|
| Đây là kế hoạch bán chắc chắn 2018 | Horizon minh họa trên dữ liệu cắt Aug-2017 |
| Chọn một đường rồi khóa cứng cả quý | Khi 3 model phân kỳ → giữ linh hoạt channel / LOS |

| Đường | Vai trò |
|---|---|
| Actual | Quan sát đến Aug-2017 |
| Seasonal Naive | Primary input cho stance |
| SARIMAX + PI | Đối chứng + biên rủi ro |
| Holt–Winters | Đối chứng seasonal (full sample) |

---

## Chart 08 — Pricing stance (pressure index)

![Chart 08 — Pricing stance](../reports/figures/18/08_pricing_stance.png)

### Biểu đồ này nói gì?

Đổi forecast volume thành **hành động giá**: cột cao (đỏ) = tháng đông → bảo vệ giá; cột thấp (xanh) = tháng vắng → kích cầu. Hai đường ngang = ngưỡng PROTECT (≥1,15) và STIMULATE (≤0,90).

### Nhìn gì trước?

1. Cột **vượt 1,15** chưa? → PROTECT.  
2. Cột **dưới 0,90** chưa? → STIMULATE.  
3. Nằm giữa → NEUTRAL (giữ BAR, chỉnh tactical).

### Kết luận cho pricing (nb 18)

| Tháng (minh họa) | Stance | Việc nên nghĩ tới |
|---|---|---|
| Dec–Jan | **STIMULATE** | Promo, early-bird, package |
| Oct | NEUTRAL gần protect | Hạn chế dump OTA; weekend chọn lọc |
| Sep / Nov / Feb | NEUTRAL | Hold BAR, chỉnh theo lead-time / channel |

Ghép với ADR season / weekend / lead-time ở [`17_adr_strategy_analysis.md`](../reports/17_adr_strategy_analysis.md) và playbook §7 trong báo cáo 18.

### Đừng hiểu nhầm

| Dễ hiểu sai | Hiểu đúng hơn |
|---|---|
| STIMULATE = cắt giá sâu mọi kênh | Kích cầu có floor; tránh race-to-bottom OTA |
| PROTECT = tăng giá vô điều kiện | Chủ yếu *không xả* inventory / hạn chế dump; vẫn cần đọc pickup tuần |
| Chỉ nhìn chart volume là đủ | Đối chiếu thêm ADR (18a) và RevPAR (18b) cùng tháng |

| Màu / ngưỡng | Stance | Hành động gợi ý |
|---|---|---|
| Đỏ / ≥ 1,15 | PROTECT | Harden BAR, hạn chế dump OTA |
| Vàng / 0,90–1,15 | NEUTRAL | Hold BAR, weekend tactical |
| Xanh / ≤ 0,90 | STIMULATE | Promo, early-bird, package |

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
| [`Guide ADR forecasting`](Guide%20-%20Cach%20doc%20va%20danh%20gia%20mo%20hinh%20ADR%20forecasting.md) | Đọc chart / chỉ số series ADR (18a) |
| [`Guide RevPAR forecasting`](Guide%20-%20Cach%20doc%20va%20danh%20gia%20mo%20hinh%20RevPAR%20forecasting.md) | Đọc chart / chỉ số series RevPAR (18b) |
| `reports/17_adr_strategy_analysis.md` | ADR season / weekend / lead-time để ghép pricing |
| `docs/Guide - Cach doc chi so thong ke.md` | ADF/p-value/effect size & khái niệm thống kê nền |
| `docs/Guide - Cach doc va danh gia mo hinh du doan.md` | Guide mô hình hủy phòng (classification) — so sánh tư duy đánh giá |

---

*Cập nhật: 20/7/2026 — bổ sung khối đọc chart plain-language (self-contained); liên kết guide ADR / RevPAR.*
