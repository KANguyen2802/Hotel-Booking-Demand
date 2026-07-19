# Overbooking Policy — Chuyển hóa xác suất hủy thành chiến lược Overbooking vận hành

> **Loại:** Policy Playbook (BA) — Phase 2 Deliverable, chuẩn bị Internal Review  
> **Dự án:** Hotel Booking Demand Data Analytics  
> **Người lập:** Nguyễn Đăng Khôi — Business Analyst  
> **Dữ liệu:** `hotel_bookings_v5.csv` · **82.811** booking · tỷ lệ hủy **28,12%**  
> **Mô hình nguồn:** LightGBM v2 (scoring, `11_cancellation_probability_scores.md`) · LightGBM v2.1 (khuyến nghị production cho overbooking, `13_cancellation_model_version_selection.md`)  
> **Nguồn chính:** `10`/`12` BRD · `11` Probability scores · `13` Version selection · `15` Policy scenario  
> **Cập nhật:** 16/07/2026

---

## 1. Tóm tắt điều hành

Báo cáo này chuyển hóa output mô hình dự đoán hủy (P(hủy)) thành một **chính sách Overbooking vận hành được**, gồm 5 phần trọng yếu theo đúng phạm vi Phase 2:

| Phần | Nội dung | Kết quả chính |
|---|---|---|
| 1 | Risk Tier Framework | 3 tier Low/Medium/High từ P(hủy), calibrate bằng outcome thực tế (không chỉ ngưỡng lý thuyết) |
| 2 | Overbooking Strategy | Buffer % theo mùa × segment × loại khách sạn, có cap an toàn (walk-cost) |
| 3 | Cancellation Policy Playbook | Quy trình xử lý cụ thể theo tier, từ lúc booking đến ngày check-in |
| 4 | Cost-Benefit Analysis | Ước tính doanh thu phục hồi vs chi phí walk, ROI ròng |
| 5 | Phase 2 Deliverable | Outline trình bày Internal Review + Q&A dự kiến |

**Thông điệp chính:** Không nên overbook đồng loạt theo % cố định. Buffer phải **calibrate theo rủi ro thực tế của từng ô (segment × mùa × hotel)**, và phải **chiết khấu an toàn (safety factor)** so với tỷ lệ hủy thô — vì Precision mô hình v2 chỉ **0,49** ở ngưỡng 0,35 (gần một nửa booking bị gắn cờ "sẽ hủy" thực ra **không hủy**). Đây là rủi ro walk cost cốt lõi mà chính sách phải kiểm soát.

---

## 2. Translate Model Output → Business Risk Tier

### 2.1 Vì sao dùng cả hai bản mô hình

| Mục đích | Mô hình khuyến nghị | Lý do |
|---|---|---|
| Tier hóa rủi ro cho vận hành hàng ngày (báo cáo này) | **LightGBM v2** @ 0,35 | Đã có sẵn scoring toàn bộ dataset (`11_cancellation_probability_scores.md`); Precision tốt hơn → ít gắn cờ sai |
| Chọn booking ưu tiên cho **overbooking / bảo vệ inventory** | **LightGBM v2.1** @ 0,28 | Recall 0,952 — ít bỏ sót hủy nhất (theo khuyến nghị Kịch bản B, `13`) |

**Quy tắc áp dụng:** Dùng **v2** để tier hóa toàn bộ booking (đã có score sẵn). Với riêng nhóm được đưa vào **danh sách ứng viên overbooking** (Tier Cao), re-score bằng **v2.1** trước khi chốt quyết định bán lại phòng, để giảm rủi ro bỏ sót (FN) khi kích hoạt overbooking thật.

### 2.2 Bảng ánh xạ P(hủy) → Risk Tier (dựa trên outcome thực tế)

Thay vì chia tier theo khoảng P(hủy) lý thuyết, nhóm BA **calibrate lại bằng tỷ lệ hủy thực tế** trong từng khoảng (dữ liệu từ `11_cancellation_probability_scores.md`):

| Risk Tier | Khoảng P(hủy) (v2) | Số booking | % tổng | Tỷ lệ hủy thực tế | Hành động chủ đạo |
|---|---|---:|---:|---:|---|
| 🟢 **Low** | < 0,35 | 40.294 | 48,7% | **4,0%** | Xử lý tiêu chuẩn, không cần buffer |
| 🟡 **Medium** | 0,35 – 0,55 | 13.957 | 16,9% | **24,1%** | Theo dõi + nhắc nhở nhẹ, chưa đưa vào overbooking |
| 🔴 **High** | ≥ 0,55 | 28.560 | 34,5% | **64,0%** | Ứng viên chính cho buffer / overbooking, kích hoạt playbook chặt |

> **Đọc nghiệp vụ:** Tier High có tỷ lệ hủy thực tế **64,0%** — nghĩa là gần 2/3 booking trong nhóm này thực sự trống phòng nếu không can thiệp. Đây là **nguồn cung chính** cho buffer overbooking. Tier Medium (24,1%) là vùng "xám" — đủ rủi ro để theo dõi nhưng chưa đủ chắc chắn để bán buffer.

### 2.3 Cảnh báo Precision — vì sao không overbook 100% booking Tier Cao

| Chỉ số mô hình v2 @ 0,35 | Giá trị | Hàm ý cho overbooking |
|---|---:|---|
| Precision (Hủy) | **0,49** | Chỉ ~49% booking bị gắn cờ "sẽ hủy" là thực sự hủy — nếu bán lại 100% slot bị gắn cờ, ~51% sẽ "walk" khách thật |
| Recall (Hủy) | 0,90 | Bắt được 90% ca hủy thật — ít bỏ sót, nhưng không giải quyết vấn đề Precision |
| FP (test) | 4.329 | Số booking không hủy nhưng bị gắn cờ rủi ro — chính là nhóm gây walk cost nếu bán buffer sai |

→ Đây là lý do Overbooking Strategy ở mục 3 dùng **safety factor**, không bán buffer bằng đúng tỷ lệ hủy thô.

---

## 3. Overbooking Strategy — Buffer sizing theo mùa & segment

### 3.1 Công thức tính buffer

```
Buffer % (đề xuất) = Tỷ lệ hủy thực tế (theo ô segment × mùa) × Safety Factor
```

- **Tỷ lệ hủy thực tế:** tính trực tiếp từ `hotel_bookings_v5.csv` (không phải giả định).
- **Safety Factor = 0,6** *(tham số chính sách do BA đề xuất — không lấy từ dữ liệu)*: chiết khấu để bù cho Precision 0,49 và rủi ro dự báo sai; giữ biên an toàn tránh walk cost. Revenue Management có thể điều chỉnh factor này sau khi pilot đo được sai số thực tế.
- **Cap tuyệt đối:** Buffer không vượt **20%** tổng phòng của một hạng/ngày, bất kể công thức ra số cao hơn — để giới hạn rủi ro vận hành nếu mô hình lệch dự báo.

### 3.2 Buffer theo Market Segment × Mùa vụ

_Mùa cao điểm (Peak) = Jul–Aug · Mùa giữa (Shoulder) = Apr–Jun, Sep–Oct · Mùa thấp (Low) = Nov–Mar._

| Segment | Mùa | n | Tỷ lệ hủy thực tế | Buffer đề xuất (×0,6, cap 20%) |
|---|---|---:|---:|---:|
| **Online TA** | Peak | 13.728 | 39,0% | **20%** (cap) |
| Online TA | Shoulder | 21.054 | 35,6% | **20%** (cap) |
| Online TA | Low | 15.609 | 32,4% | **19%** |
| **Groups** | Peak | 372 | 45,4% | **15%*** |
| Groups | Shoulder | 2.140 | 30,7% | **15%*** |
| Groups | Low | 1.178 | 27,7% | **15%*** |
| Offline TA/TO | Peak | 2.916 | 17,3% | 10% |
| Offline TA/TO | Shoulder | 5.914 | 17,0% | 10% |
| Offline TA/TO | Low | 4.030 | 10,6% | 6% |
| Corporate | Peak | 398 | 21,9% | 13% |
| Corporate | Shoulder | 1.486 | 14,0% | 8% |
| Corporate | Low | 1.794 | 9,9% | 6% |
| Direct | Peak | 3.144 | 17,6% | 11% |
| Direct | Shoulder | 4.265 | 15,5% | 9% |
| Direct | Low | 3.942 | 12,1% | 7% |

_*Groups: cap riêng ở **15%** (thấp hơn công thức thô) vì rủi ro hủy theo **block** (cả đoàn hủy cùng lúc) — đã có điều khoản **BR-REV-03 Attrition Clause** trong BRD v1.1 xử lý riêng; overbooking buffer cho Groups chỉ nên bổ trợ, không thay thế điều khoản hợp đồng._

### 3.3 Buffer theo loại khách sạn × mùa (tổng hợp, không phân segment)

| Hotel | Mùa | n | Tỷ lệ hủy thực tế | Buffer đề xuất |
|---|---|---:|---:|---:|
| **City Hotel** | Peak | 11.853 | 32,9% | **20%** |
| City Hotel | Shoulder | 22.439 | 31,0% | 18% |
| City Hotel | Low | 16.394 | 28,7% | 17% |
| **Resort Hotel** | Peak | 8.802 | 31,6% | **19%** |
| Resort Hotel | Shoulder | 12.841 | 24,5% | 15% |
| Resort Hotel | Low | 10.482 | 17,2% | 10% |

**Đọc nghiệp vụ:** City Hotel cần buffer cao hơn Resort ở mọi mùa (khớp cancel rate tổng City **30,7%** vs Resort **24,1%** trong `14`). Buffer nên **luôn tham chiếu tổ hợp segment × mùa × hotel cụ thể** (mục 3.2), bảng 3.3 chỉ dùng làm mức sàn tham khảo nhanh khi chưa đủ dữ liệu phân khúc.

### 3.4 Nguyên tắc vận hành buffer

1. Buffer được **cấu hình lại hàng tháng** bởi Revenue Management dựa trên forecast segment mix của tháng tới, không cố định vĩnh viễn.
2. Buffer chỉ **kích hoạt bán thật** khi booking gốc rơi vào **Tier High** (mục 2.2) — không bán buffer trên nền Tier Low/Medium.
3. Ưu tiên bán buffer cho **walk-in / last-minute Direct** (ADR tốt, ít rủi ro hủy tiếp) hơn là bán lại cho OTA giá thấp.
4. Ngày cutoff xác nhận cuối cùng để "khóa" số buffer đã bán: **T-3 ngày** (theo chuẩn thị trường ở `15_policy_scenario.md`), riêng tổ hợp BR-REV-02 (Online TA × TA/TO, lead>60, Jul–Aug) dùng cutoff **T-14 ngày** (đã quy định ở BRD v1.1).

---

## 4. Cancellation Policy Playbook — quy trình theo Risk Tier

### 4.1 Luồng tổng quát

```mermaid
flowchart LR
  A[Booking mới] --> B[Model v2 chấm P(hủy)]
  B --> C{Risk Tier}
  C -->|Low <0,35| D[Xử lý tiêu chuẩn]
  C -->|Medium 0,35-0,55| E[Theo dõi + nhắc nhẹ]
  C -->|High >=0,55| F[Re-score v2.1 + đưa vào Buffer Pool]
  F --> G{Đến cutoff T-3/T-14}
  G -->|Đã hủy hoặc không xác nhận| H[Giải phóng phòng: bán Buffer]
  G -->|Xác nhận / cọc giữ| I[Giữ phòng, rút khỏi Buffer Pool]
  H --> J[Ngày Check-in: đối soát Overbooking]
  J -->|Đủ phòng| K[Hoàn tất]
  J -->|Thiếu phòng - Walk| L[Kích hoạt Walk Protocol]
```

### 4.2 Playbook chi tiết theo Tier

| Risk Tier | Thời điểm | Hành động | Người thực hiện | SLA |
|---|---|---|---|---|
| 🟢 **Low** | Đặt phòng → check-in | Email xác nhận tiêu chuẩn; không nhắc nhở thêm | Hệ thống tự động | Ngay lập tức |
| 🟡 **Medium** | T-14 | Email/SMS nhắc chính sách hủy + gợi ý xác nhận sớm (không ép buộc) | Hệ thống tự động | T-14 |
| 🟡 **Medium** | T-7 | Nếu chưa tương tác: Sales gọi xác nhận nhẹ, giới thiệu ưu đãi giữ chỗ (upsell) | Sales | T-7 |
| 🔴 **High** | Ngay khi lên Tier | Re-score bằng v2.1; nếu vẫn High → đưa vào **Buffer Pool** theo mùa/segment (mục 3) | Revenue Management (hệ thống) | Ngay lập tức |
| 🔴 **High** | T-14 (nếu thuộc BR-REV-02) hoặc T-3 (còn lại) | Gửi yêu cầu **reconfirmation bắt buộc** — nếu không phản hồi trước cutoff, booking coi như rủi ro cao để bán buffer | FO/Sales | Theo cutoff |
| 🔴 **High** | Sau cutoff, chưa xác nhận | **Giải phóng** — mở bán buffer cho slot này (Direct ưu tiên, sau đó Online TA/kênh khác) | Revenue Management | T-1 đến T-cutoff |
| 🔴 **High** | Khách hủy thật | Cập nhật inventory, đưa phòng vào pool bán last-minute | Hệ thống PMS | Ngay lập tức |
| 🔴 **High** | Khách xác nhận / bị charge cọc (nếu có Kịch bản B — `15`) | Rút khỏi Buffer Pool, giữ phòng bình thường | Hệ thống | Ngay lập tức |

### 4.3 Walk Protocol — khi overbooking vượt quá cancellation thực tế

Xảy ra khi số buffer đã bán **> số phòng thực tế trống** do dự báo hủy lệch (rủi ro Precision 0,49 nêu ở mục 2.3).

| Bước | Hành động | Trách nhiệm |
|---|---|---|
| 1 | Phát hiện sớm tại **T-1** qua đối soát booking đã xác nhận vs phòng trống thực tế | Revenue Management |
| 2 | Nếu thiếu phòng: ưu tiên "walk" khách theo thứ tự **ADR thấp nhất → loyalty thấp nhất → đặt muộn nhất** (không walk khách VIP/loyalty cao) | FO Manager |
| 3 | Bố trí khách sạn thay thế cùng hạng hoặc cao hơn trong khu vực; chi trả chênh lệch giá + 1 đêm miễn phí lần sau (comp) | FO/Kế toán |
| 4 | Ghi log đầy đủ ca walk (nguyên nhân, chi phí, segment) để feedback lại mô hình/safety factor | BA + Data Analyst |
| 5 | Báo cáo walk rate hàng tháng cho Ban Giám đốc — nếu walk rate vượt ngưỡng (mục 5.3), giảm buffer % hoặc safety factor kỳ tiếp | BA |

---

## 5. Cost-Benefit Analysis — Ước tính doanh thu phục hồi

### 5.1 Hiện trạng (không có chính sách Overbooking chính thức)

| Chỉ số | Giá trị | Nguồn |
|---|---:|---|
| Tổng doanh thu mất do hủy (toàn năm) | **11,25M €** (33,74% tiềm năng) | `12_brd_gap_analysis` |
| Doanh thu mất mùa cao điểm (Jul–Aug) | **4,64M €** (36,0% tiềm năng mùa đó) | Tính lại từ `v5` theo mùa |
| Doanh thu mất mùa giữa (Apr–Jun, Sep–Oct) | 4,40M € (32,6%) | Tính từ `v5` |
| Doanh thu mất mùa thấp (Nov–Mar) | 2,21M € (31,8%) | Tính từ `v5` |
| Tỷ lệ bán lại thụ động hiện tại *(giả định vận hành, theo `15`)* | ~30% | Ad-hoc, không hệ thống hóa |
| → Phần hiện đang **thực sự mất trắng** | ~**7,87M €/năm** | 11,25M × (1 − 30%) |

### 5.2 Sau khi triển khai Overbooking Policy (buffer theo mục 3)

_Giả định BA (chưa có A/B test thật):_ với buffer được target đúng theo Tier High + safety factor 0,6, chính sách **chủ động** bán lại trước hạn (thay vì chờ hủy rồi mới bán) kỳ vọng nâng tỷ lệ phục hồi từ ~30% (thụ động) lên **55–65%** của phần đang mất, tập trung nhiều nhất ở mùa cao điểm (buffer 20% ở Online TA/City Hotel).

| Kịch bản | % phục hồi trên phần đang mất (7,87M €) | Doanh thu phục hồi thêm | Ghi chú |
|---|---:|---:|---|
| Cận dưới (55%) | 55% | **+4,33M €** | Rủi ro walk thấp, buffer thận trọng |
| Cận trên (65%) | 65% | **+5,12M €** | Buffer tối ưu theo mùa/segment, ít sai lệch dự báo |

### 5.3 Chi phí walk (rủi ro đối trọng)

| Tham số | Ước tính | Cơ sở |
|---|---:|---|
| Walk rate kỳ vọng (booking overbook không có phòng trống thật) | **3–5%** của buffer đã bán | Suy ra gián tiếp từ Precision 0,49 v2 sau khi áp safety factor 0,6 — cần đo thật qua pilot |
| Chi phí mỗi ca walk (chênh giá KS thay thế + 1 đêm comp) | ~**1,5× ADR mùa đó** | Chuẩn ngành; Peak ADR **144,68 €** → ~217 €/ca; Low ADR 77,38 € → ~116 €/ca |
| Tổng chi phí walk ước tính (nếu buffer bán ~15–20% trên nhóm High, walk rate 4%) | **~80.000–150.000 €/năm** | Tính trên quy mô buffer mục 3; **cần pilot để chốt số thật** |

### 5.4 Net Benefit ước tính

| Chỉ số | Giá trị |
|---|---:|
| Doanh thu phục hồi (cận dưới – cận trên) | +4,33M € → +5,12M € |
| Trừ chi phí walk | −0,08M € → −0,15M € |
| Trừ chi phí vận hành/hệ thống (theo `15`, mục chi phí Payment Gateway/BRD dùng chung hạ tầng) | Không phát sinh thêm đáng kể (tận dụng hạ tầng scoring đã có) |
| **Net Benefit ước tính năm đầu** | **≈ +4,2M € đến +5,0M €** |

→ Ngay ở kịch bản thận trọng nhất, lợi ích ròng vượt xa chi phí walk dự kiến. **Toàn bộ số phục hồi là ước lượng chính sách (chưa pilot thật)** — mục 6 đề xuất chạy pilot đo trước khi mở rộng, theo đúng nguyên tắc đã áp dụng ở `15_policy_scenario.md`.

---

## 6. Phase 2 Deliverable — Chuẩn bị Internal Review

### 6.1 Mục tiêu buổi review

Trình bày framework Risk Tier + Overbooking Strategy + Playbook + Cost-Benefit cho Ban Giám đốc / Revenue Management để xin **go/no-go pilot**.

### 6.2 Outline trình bày (đề xuất 10 slide, ~20 phút)

| # | Slide | Nội dung chính | Nguồn số liệu |
|---:|---|---|---|
| 1 | Trang bìa | Tên dự án, phạm vi Phase 2, ngày | — |
| 2 | Vấn đề & bối cảnh | 28,12% cancel toàn hệ thống; 11,25M € mất; hotspot Online TA + mùa cao điểm | `12`, `14` |
| 3 | Từ mô hình đến quyết định | Risk Tier Low/Medium/High, cảnh báo Precision 0,49 | Mục 2 |
| 4 | Overbooking Strategy | Bảng buffer theo segment × mùa × hotel | Mục 3 |
| 5 | Playbook vận hành | Sơ đồ luồng (mermaid) + bảng hành động theo tier | Mục 4 |
| 6 | Walk Protocol | Quy trình xử lý khi overbook vượt ngưỡng | Mục 4.3 |
| 7 | Cost-Benefit | Net Benefit +4,2M–5,0M €/năm, walk cost 80–150k € | Mục 5 |
| 8 | Rủi ro & Mitigation | Walk cost, phản ứng OTA, compliance (liên kết `15` mục 2.1 & 6) | `15` |
| 9 | Đề xuất pilot | Phạm vi pilot (Online TA, City Hotel, Jul–Aug trước), timeline 8–10 tuần | Mục 6.3 |
| 10 | Ask & Next steps | Xin phê duyệt pilot; RACI; KPI theo dõi | Mục 6.4 |

### 6.3 Phạm vi Pilot đề xuất (nếu được duyệt)

- **Phạm vi:** City Hotel × Online TA × Tier High, bắt đầu 1 tháng trước mùa cao điểm để đo trước Jul–Aug.
- **Buffer áp dụng:** 20% (theo mục 3.2/3.3), safety factor 0,6 — **không đổi trong suốt pilot** để đo sạch.
- **Thời gian:** 8–10 tuần (song song với pilot Kịch bản B — Deposit — ở `15_policy_scenario.md` nếu được duyệt cùng lúc).
- **KPI đo:** Δ Occupancy thực tế, walk rate thực tế, net revenue recovered, số khiếu nại.

### 6.4 RACI cho giai đoạn chuẩn bị & review

| Hoạt động | R | A | C/I |
|---|---|---|---|
| Hoàn thiện slide + số liệu | BA | Revenue Management | Data Analyst |
| Review nội bộ trước khi trình BGĐ | Revenue Management | BA | FO/Sales |
| Trình Internal Review | BA | Ban Giám đốc | Tất cả stakeholder |
| Chốt go/no-go pilot | Ban Giám đốc | — | BA, Revenue Management |

### 6.5 Q&A dự kiến (chuẩn bị trước)

| Câu hỏi khả năng cao | Trả lời chuẩn bị sẵn |
|---|---|
| Nếu mô hình dự báo sai, khách sạn có bị "walk" khách oan không? | Có, đây là rủi ro cố hữu của overbooking — đã lượng hóa ở mục 5.3 (walk rate 3–5%, chi phí 80–150k €/năm) và có Walk Protocol (mục 4.3) để xử lý có kiểm soát. |
| Vì sao không overbook toàn bộ Tier Cao (64% tỷ lệ hủy)? | Vì Precision mô hình chỉ 0,49 — bán buffer bằng nguyên tỷ lệ hủy thô sẽ walk quá nhiều khách thật. Safety factor 0,6 và cap 20% là để kiểm soát rủi ro này. |
| Số liệu cost-benefit có chắc chắn không? | Phần chi phí/doanh thu nền (11,25M €, ADR, tỷ lệ hủy) lấy trực tiếp từ dataset thật. Phần % phục hồi và walk rate là **ước lượng chính sách** — đây chính là lý do đề xuất pilot trước khi mở rộng toàn hệ thống. |
| Overbooking có mâu thuẫn với chính sách cọc (Kịch bản B, `15`) không? | Không — bổ trợ nhau. Cọc giảm số lượng booking rủi ro cao đi vào Buffer Pool; Overbooking xử lý phần rủi ro còn lại chưa bị cọc chặn. |

---

## 7. Tài liệu nguồn

| File | Nội dung dùng trong báo cáo này |
|---|---|
| [`10_brd_v1_1.md`](10_brd_v1_1.md) | Tier gốc BRD v1.1 (0,35/0,70), BR-REV-01/02/03, BR-OPS-01 |
| [`11_cancellation_probability_scores.md`](11_cancellation_probability_scores.md) | Phân bố P(hủy) v2, risk bucket thực tế |
| [`11_cancellation_probability_by_variable.md`](11_cancellation_probability_by_variable.md) | Mean P(hủy) theo segment/hotel/channel |
| [`12_brd_gap_analysis.md`](12_brd_gap_analysis.md) | Revenue loss 11,25M €, hotspot 3 chiều, room mis-match |
| [`12_brd_v1_2.md`](12_brd_v1_2.md) | Business rules cập nhật (BR-REV, BR-INV, BR-FIN) |
| [`13_cancellation_model_version_selection.md`](13_cancellation_model_version_selection.md) | Khuyến nghị v2 (scoring) vs v2.1 (inventory protection) |
| [`14_key_findings_after_prediction_models.md`](14_key_findings_after_prediction_models.md) | Cancel rate theo hotel/segment, driver hủy |
| [`15_policy_scenario.md`](15_policy_scenario.md) | Kịch bản Deposit (B), benchmark thị trường, compliance |

---

*Overbooking Policy Playbook — Phase 2 Deliverable. Cập nhật: 16/07/2026.*
