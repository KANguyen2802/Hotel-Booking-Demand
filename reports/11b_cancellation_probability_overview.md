# 11b — Cancellation probability: bộ đầu vào cho Overbooking Strategy

> **Loại:** Báo cáo cầu nối · dễ hiểu · recommend-only  
> **Dữ liệu:** `hotel_bookings_v5.csv` · **82.811** booking · tỷ lệ hủy thực tế **28,12%**  
> **Đọc cùng:** [`11_cancellation_probability_scores.md`](11_cancellation_probability_scores.md) · [`11_cancellation_probability_by_variable.md`](11_cancellation_probability_by_variable.md)  
> **Mục tiêu:** Ba file `11` + `11b` đủ để viết / cập nhật **Overbooking Strategy** (risk tier · buffer pool · safety factor)  
> **Cập nhật:** 22/07/2026

---

## Tóm tắt một phút

**P(hủy)** = mức mô hình tin booking sẽ hủy (0→1). Overbooking không bán thêm phòng “theo cảm tính” mà dựa trên:

1. **Ai** có nguy cơ hủy cao → đưa vào *Buffer Pool* (từ file scores).  
2. **Segment nào** hủy nhiều hơn → buffer % khác nhau (từ file by variable).  
3. **Không bán hết** theo tỷ lệ hủy thô → phải chiết khấu vì mô hình hay gắn cờ sai (FP / Precision).

Ba file dùng như một bộ:

| File | Cho overbooking cái gì |
|------|------------------------|
| `11_…_scores` | P từng booking · bucket · hủy thật theo bucket · join `booking_index` |
| `11_…_by_variable` | Mean P + hủy thật theo hotel / segment / kênh / loại khách |
| **`11b` (file này)** | Cách đọc · risk tier vận hành · chọn model · công thức buffer khung · checklist viết strategy |

---

## 1. P(hủy) là gì? (đọc nhanh)

| Khái niệm | Ý nghĩa đơn giản | Liên quan overbooking |
|-----------|------------------|------------------------|
| **P(hủy)** | Xác suất dự đoán hủy | Xếp booking vào Buffer Pool |
| **Ngưỡng** | P ≥ ngưỡng → gắn “Hủy” | Không dùng một mình để bán buffer |
| **Recall** | Bắt được bao nhiêu % hủy thật | Thấp → bỏ sót → phòng trống, bán thiếu buffer |
| **Precision** | Trong số gắn “Hủy”, bao nhiêu % đúng | Thấp → bán buffer quá tay → **walk** khách thật |
| **FN / FP** | Bỏ sót hủy / báo oan | FN = mất cơ hội bán lại; FP = rủi ro walk |

File scores hiện dùng **LightGBM v2 @ 0,35** (`data/11_cancellation_probability_scores.csv`).

---

## 2. Ba file 11/11b làm việc thế nào

```text
┌─────────────────────────┐
│ 11_scores.csv / .md     │  P(hủy) từng booking + risk_bucket + actual_cancel
└───────────┬─────────────┘
            │ join booking_index
            ▼
┌─────────────────────────┐
│ 11_by_variable.md       │  Mean P & hủy thật theo segment / hotel / kênh
└───────────┬─────────────┘
            │ quy tắc + cảnh báo Precision
            ▼
┌─────────────────────────┐
│ 11b (file này)          │  Risk tier · Buffer Pool · công thức khung · checklist
└───────────┬─────────────┘
            ▼
     Overbooking Strategy
  (buffer % · cutoff · walk · ROI)
```

**Nguyên tắc:** Strategy không bịa % buffer. Mọi số phải truy về scores (booking) hoặc by_variable / hủy thật theo ô (segment × mùa × hotel — tính thêm từ `v5` khi viết policy).

---

## 3. Risk Tier cho Overbooking (từ `11_scores`)

Hai cách chia trong chuỗi báo cáo — **khi viết strategy dùng cột “Tier overbooking”** (gộp Low vận hành):

| Tier overbooking | Khoảng P (v2) | Số booking | % tổng | Hủy thật | Vai trò |
|------------------|---------------|----------:|-------:|---------:|---------|
| 🟢 **Low** | &lt; 0,35 | 40.294 | 48,7% | **~4,0%** | Không đưa vào buffer |
| 🟡 **Medium** | 0,35–0,55 | 13.957 | 16,9% | **24,1%** | Theo dõi / nhắc — **chưa** bán buffer |
| 🔴 **High** | ≥ 0,55 | 28.560 | 34,5% | **64,0%** | **Ứng viên chính** Buffer Pool |

Đối chiếu bucket chi tiết trong scores (4 nhóm):

| `risk_bucket` (file 11) | Mean P | Hủy thật | Map sang tier OB |
|-------------------------|-------:|---------:|------------------|
| Thấp (&lt; 0,20) | 0,072 | 1,7% | → Low |
| Trung bình (0,20–0,35) | 0,274 | 9,5% | → Low |
| Cao (0,35–0,55) | 0,446 | 24,1% | → Medium |
| Rất cao (≥ 0,55) | 0,766 | **64,0%** | → **High** |

**Takeaway viết strategy:** Chỉ bán / mở buffer trên nền **Tier High**. Medium = vùng xám (hủy ~1/4) — đủ để CRM nhắc, chưa đủ chắc để overbook.

Nguồn: [`11_cancellation_probability_scores.md`](11_cancellation_probability_scores.md).

---

## 4. Cảnh báo bắt buộc trước khi đặt buffer %

Model **v2 @ 0,35** (đúng bản đã xuất scores):

| Chỉ số | Giá trị | Hệ quả cho overbooking |
|--------|--------:|------------------------|
| Precision Hủy | **~0,49** | ~một nửa booking bị gắn “sẽ hủy” thực ra **không hủy** |
| Recall Hủy | ~0,90 | Bắt được phần lớn hủy — tốt cho không bỏ sót |
| FP (test ~16.563) | ~4.329 | Nhóm gây **walk** nếu bán buffer 1:1 theo cờ model |

→ **Cấm** đặt `Buffer % = tỷ lệ hủy thô` hoặc bán lại 100% Tier High.  
→ Strategy phải có **Safety Factor** (chiết khấu) + **cap tuyệt đối** (ví dụ không vượt 15–20% inventory/ngày — do RM chốt).

Gợi ý khung (tham số chính sách, không phải output model):

```text
Buffer % đề xuất (ô) = Tỷ lệ hủy thực tế (ô) × Safety Factor
Safety Factor gợi ý khởi điểm ≈ 0,6   (bù Precision ~0,49)
Cap gợi ý ≈ 15–20% phòng/hạng/ngày
```

Ô = **segment × mùa × hotel** (tính từ `hotel_bookings_v5.csv` khi viết strategy; không có sẵn trong file 11 by_variable theo mùa).

---

## 5. Phân hóa buffer theo segment (từ `11_by_variable`)

Mean P = điểm mô hình trung bình trên nhóm — dùng để **ưu tiên ô nào cần buffer cao**, không thay tỷ lệ hủy thật khi tính %.

### 5.1 Bảng ưu tiên (dễ nhớ)

| Chiều | Ưu tiên buffer cao hơn | Mean P | Hủy thật | Buffer thấp hơn / thận trọng | Mean P | Hủy thật |
|-------|------------------------|-------:|---------:|------------------------------|-------:|---------:|
| Hotel | City Hotel | 0,44 | 30,7% | Resort Hotel | 0,35 | 24,1% |
| Segment | Online TA | 0,50 | 35,5% | Offline TA/TO · Corporate · Direct | 0,20–0,27 | 13–15% |
| Kênh | TA/TO | 0,44 | 31,5% | Corporate · Direct | 0,23–0,27 | 14–15% |
| Loại khách | Transient | 0,44 | 30,4% | Group · Contract | 0,16–0,20 | 11–17% |
| Cọc | Non Refund* | 0,95 | 95% | Refundable / No Deposit | 0,29–0,40 | ~27–28% |

\*Non Refund: hủy cực cao nhưng **n nhỏ (963)** và đặc thù chính sách — không lấy làm mẫu overbooking đại trà; xử lý riêng hợp đồng / accounting.

### 5.2 Quy tắc ưu tiên khi viết strategy

1. **Online TA × Transient × City** = hotspot chính cho Buffer Pool.  
2. **Corporate / Direct / Group** = buffer thấp hoặc không overbook trên booking Low/Medium.  
3. **Groups:** hủy có thể theo *block* — buffer % nên **cap thấp hơn** Online TA và bổ trợ attrition clause, không thay hợp đồng.  
4. `country` nhiều mức hiếm: **không** dựng buffer theo từng nước ít booking; gom thị trường lớn (vd. PRT) nếu cần.

Nguồn đầy đủ: [`11_cancellation_probability_by_variable.md`](11_cancellation_probability_by_variable.md).

---

## 6. Chọn model khi vận hành overbooking

| Việc | Model | Ngưỡng | Vì sao |
|------|-------|-------:|--------|
| Tier hóa toàn bộ booking (đã có CSV) | **LightGBM v2** | 0,35 | Khớp file `11_scores` · Precision tốt hơn RF |
| Chốt ứng viên bán buffer (Tier High) | **LightGBM v2.1** | **0,28** | Recall ~0,95 — giảm bỏ sót hủy trước khi bán lại phòng |
| Scoring / cảnh báo cân bằng (ít FP) | **LightGBM v2.2** | 0,25 | AUC 0,896 · FP thấp hơn — nên **re-score** khi nâng cấp production |
| Giải thích stakeholder (RF) | RF v1.2 | 0,35 | Tham chiếu, không dùng làm engine buffer chính |

**Luồng đề xuất (khung cho strategy):**

```text
Booking mới
  → chấm P bằng v2 (hoặc v2.2 khi đã migrate scores)
  → gán Tier Low / Medium / High
  → nếu High: re-score v2.1
       → vẫn High → đưa vào Buffer Pool (theo ô segment × mùa × hotel)
       → không còn High → hạ xuống theo dõi Medium
  → cutoff (vd. T-3; hotspot OTA lead dài có thể T-14): xác nhận / hủy / mở bán buffer
  → T-1: đối soát phòng · nếu thiếu → Walk Protocol
```

Chi tiết chọn bản: [`13_cancellation_model_version_selection.md`](13_cancellation_model_version_selection.md).

---

## 7. Driver ổn định (giải thích vì sao P cao)

Dùng trong phần “rationale” của strategy / BRD — không thay số buffer:

| Hướng | Tín hiệu | Gợi ý hành động kèm overbooking |
|-------|----------|----------------------------------|
| ↑ | Lead dài (&gt; 30–180 ngày) | Cutoff sớm hơn · yêu cầu reconfirm |
| ↑ | Online TA · Transient · PRT | Ưu tiên Buffer Pool |
| ↑ | No Deposit · ít special request | Soft deposit / guarantee song song |
| ↓ | Parking · nhiều request · Offline/Direct/Corporate | Ít đưa vào pool |
| ↓ | Group / Contract | Ưu tiên hợp đồng attrition hơn overbook |

---

## 8. Checklist viết Overbooking Strategy (dùng bộ 11 + 11b)

Đánh dấu khi có đủ — nếu thiếu thì tính thêm từ `v5`, không đoán:

### A. Đầu vào đã có sẵn (ba file này)

- [x] P(hủy) từng booking + `actual_cancel` + `risk_bucket`  
- [x] Tỷ lệ hủy thật theo bucket / tier (≥ 0,55 → 64%)  
- [x] Mean P & hủy thật theo hotel, segment, kênh, customer_type, deposit  
- [x] Cảnh báo Precision ~0,49 → bắt buộc Safety Factor  
- [x] Quy tắc dual-model v2 (tier) + v2.1 (chốt buffer)  
- [x] Công thức khung `hủy thật × Safety Factor` + gợi ý cap  

### B. Phải bổ sung khi viết strategy (không nằm trong 11)

- [ ] Bảng **hủy thật × mùa** (Peak / Shoulder / Low) × segment × hotel từ `v5`  
- [ ] Chốt **Safety Factor** và **cap %** (RM / BA)  
- [ ] **Cutoff** (T-3 / T-14 hotspot) và SLA reconfirm  
- [ ] **Walk Protocol** + ước walk cost vs ADR phục hồi  
- [ ] ROI / doanh thu phục hồi (có thể neo `12_brd_gap_analysis`)  
- [ ] Pilot scope (1 property / 1 mùa) + KPI: walk rate, RevPAR, cancel materialize  

### C. Cấu trúc đề xuất cho tài liệu strategy

1. Mục tiêu & phạm vi (City / Resort, kênh nào)  
2. Risk Tier (mục 3 file này) + nguồn scores  
3. Buffer sizing theo ô (công thức mục 4 + số từ `v5`)  
4. Playbook theo tier + dual model (mục 6)  
5. Walk Protocol & giới hạn an toàn  
6. Cost–benefit & KPI pilot  
7. Phụ lục: join `booking_index`, mẫu Tier High  

Tham chiếu đã viết sẵn (có thể cập nhật theo checklist): [`16_overbooking_policy.md`](16_overbooking_policy.md) · [`15_policy_scenario.md`](15_policy_scenario.md).

---

## 9. Tiến hóa model (ngữ cảnh ngắn)

| Bản | AUC | Vai trò với overbooking |
|-----|----:|-------------------------|
| RF v1 → v1.2 | 0,73→0,84 | Baseline / giải thích |
| LGBM v2 | 0,871 | **Engine scores hiện tại** |
| LGBM v2.1 | 0,872 | **Mode inventory / chốt buffer** |
| LGBM v2.2 | **0,896** | Nâng cấp scoring (ít FP) — nên migrate CSV `11` |

---

## 10. Kết luận

1. **`11_scores` + `11_by_variable` + `11b`** tạo đủ lớp *dữ liệu & quy tắc rủi ro* để viết Overbooking Strategy.  
2. Strategy chỉ overbook trên **Tier High (P ≥ 0,55, hủy thật ~64%)**, phân hóa theo **Online TA / City**, và **luôn** nhân Safety Factor vì Precision ~0,49.  
3. Còn thiếu chủ yếu là số **theo mùa**, tham số **cap / cutoff / walk cost / ROI** — đó là phần BA/RM chốt trên `v5` và pilot, không phải lỗ hổng của bộ xác suất 11.  
4. Khi migrate scoring sang **v2.2**, làm lại tier trên P mới rồi cập nhật strategy — không giữ cứng ngưỡng 0,35/0,55 nếu phân phối P đổi.

---

## Tài liệu liên quan

| File | Vai trò |
|------|---------|
| [`11_cancellation_probability_scores.md`](11_cancellation_probability_scores.md) | P theo booking · bucket |
| [`11_cancellation_probability_by_variable.md`](11_cancellation_probability_by_variable.md) | P / hủy theo segment |
| [`13_cancellation_model_version_selection.md`](13_cancellation_model_version_selection.md) | Chọn v2 / v2.1 / v2.2 |
| [`15_policy_scenario.md`](15_policy_scenario.md) | Kịch bản chính sách hủy / cọc |
| [`16_overbooking_policy.md`](16_overbooking_policy.md) | Playbook overbooking đã dựng từ bộ 11 |
| [`12_brd_gap_analysis.md`](12_brd_gap_analysis.md) | Doanh thu mất do hủy (ROI) |
| `data/11_cancellation_probability_scores.csv` | Bảng điểm đầy đủ (v2) |
