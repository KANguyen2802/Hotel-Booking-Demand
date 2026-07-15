# Policy Scenario — Chiến lược quản trị rủi ro hủy phòng & tối ưu RevPAR

> **Loại:** Báo cáo đề xuất chính sách (BA) — 3 kịch bản vận hành  
> **Dự án:** Hotel Booking Demand Data Analytics  
> **Người lập:** Nguyễn Đăng Khôi — Business Analyst  
> **Dữ liệu:** `hotel_bookings_v5.csv` · **82.811** booking · tỷ lệ hủy **28,12%**  
> **Nguồn chính:** `02`/`03` EDA · `12_brd_gap_analysis` · `14_key_findings_after_prediction_models`  
> **Cập nhật:** 15/07/2026

---

## 1. Tóm tắt thực trạng (Executive Summary)

Dựa trên báo cáo phân tích dữ liệu từ Data Analyst, tỷ lệ hủy phòng (Cancellation Rate) toàn hệ thống hiện ở mức **28,12%** — gần 1/3 demand không materialize. Rủi ro tập trung rõ ở phân khúc **Online TA** (OTA / travel agent online): tỷ lệ hủy **35,5%** trên 50.391 booking; tổ hợp **Online TA × TA/TO** đạt **35,7%**. Đặc biệt nghiêm trọng tại **hotspot** Online TA + lead time dài + mùa cao điểm (Jul–Aug), tỷ lệ hủy lên tới **45,8%–46,6%** dù chỉ chiếm ~9% booking nhưng gánh **>22%** doanh thu mất.

Hiện **98,7%** booking là **No Deposit** — thiếu cam kết tài chính mang tính hệ thống. Việc duy trì chính sách nới lỏng để chiều lòng kênh OTA đang gây thất thoát doanh thu tiềm năng (tổng mất do hủy ước **11,25M €**, tương đương **33,74%** doanh thu tiềm năng) và làm giảm hiệu suất phòng thực tế (RevPAR).

**Mục tiêu của báo cáo:** Trình bày nguyên nhân gốc rễ, đối chuẩn với thị trường và đề xuất 3 kịch bản chính sách mới nhằm giảm tỷ lệ hủy, bảo vệ dòng tiền — neo theo số liệu DA đã chốt.

---

## 2. Phân tích nguyên nhân gốc rễ (5 Whys)

Để giải quyết bài toán hủy cao tại kênh Online TA (đặc biệt hotspot ~46%), nhóm BA đã tiến hành truy vết nguyên nhân:

- **Why 1:** Khách hàng Online TA hủy nhiều do thói quen "đặt giữ chỗ" nhiều khách sạn cùng lúc và chốt sát ngày — khớp pattern lead time dài (hủy median 79 ngày vs không hủy 37 ngày; lead > 180 ngày hủy **41,7%**).
- **Why 2:** Thói quen này được củng cố bởi chính sách cam kết yếu: **98,7%** booking **No Deposit**. *(Giả định vận hành AS-IS: hủy miễn phí sát ngày / không bắt buộc thẻ — không đo trực tiếp trong dataset, dùng làm giả định chính sách.)*
- **Why 3:** OTA ưu tiên hiển thị các khách sạn có chính sách linh hoạt để tăng tỷ lệ chuyển đổi (CR) trên nền tảng của họ.
- **Why 4:** Khách sạn chấp nhận luật chơi của OTA vì sợ mất thứ hạng tìm kiếm (Ranking) và volume (TA/TO chiếm **79,6%** booking).
- **Why 5 (Root Cause):** Khách sạn **thiếu khung chính sách định giá rủi ro (Risk-based pricing policy)** — cào bằng rủi ro giữa khách "đặt chơi" và khách có nhu cầu thực, thay vì tier theo segment × lead time × mùa vụ như hotspot DA đã chỉ ra.

### 2.1 Rủi ro phản ứng từ OTA

Siết chính sách đơn phương có thể khiến Booking/Agoda giảm ranking hiển thị khách sạn (theo Why 3/4).

**Mitigation:** đàm phán trước với account manager OTA về lộ trình thay đổi; pilot âm thầm (soft launch) trên một phần inventory/mùa thấp điểm trước khi áp dụng toàn diện; theo dõi volume Online TA hàng tuần trong giai đoạn pilot để phát hiện sớm tác động ranking.

---

## 3. Phân tích tác động tài chính (Financial Impact)

Nhóm DA đã định lượng thiệt hại và mô phỏng chính sách cọc trên dữ liệu thật (`12_brd_gap_analysis`), không dùng giả định khách sạn ảo.

### 3.1 Thực trạng doanh thu mất do hủy

| Chỉ số | Giá trị |
|---|---:|
| Doanh thu thực hiện (không hủy) | 22,09M € |
| Doanh thu tiềm năng | 33,34M € |
| **Tổng doanh thu mất do hủy** | **11,25M €** (**33,74%** tiềm năng) |
| Mean mất / đêm (cả năm) | 120,45 € |
| Mean mất / đêm Jul–Aug | **155,21 €** |
| Jul–Aug trong tổng mất | **41,2%** (~4,64M €) |

Mean ADR toàn hệ thống ~**107,6 €**; mean `total_nights` ~**3,7** đêm — mỗi điểm % hủy đều có trọng số doanh thu lớn hơn giả định ADR \$100 / ALOS 2 đêm.

### 3.2 Hotspot rủi ro (nơi can thiệp ưu tiên)

| Tổ hợp | Booking | Tỷ lệ hủy | % doanh thu mất |
|---|---:|---:|---:|
| Online TA + lead > 90 + Jul–Aug | 7.168 | **46,64%** | **22,63%** |
| Online TA × TA/TO + lead > 60 + Jul–Aug | 8.574 | **45,77%** | **26,24%** |
| Online TA (toàn segment) | 50.391 | **35,5%** | — |
| Online TA, lead > 30 (phạm vi mô phỏng cọc) | 32.491 | **43,23%** | — |
| Toàn hệ thống | 82.811 | **28,12%** | 100% |

### 3.3 Mô phỏng Deposit Policy (Online TA, lead_time > 30)

_Giả định DA:_ giảm tỷ lệ hủy **30%** so hiện tại; giảm volume booking **10%** (khách bỏ qua vì rào cọc); kịch bản mở rộng giữ lại ~80% ADR trung bình khi hủy.

| Kịch bản | Booking | Tỷ lệ hủy | Net Revenue |
|---|---:|---:|---:|
| Hiện tại | 32.491 | 43,23% | 8,59M € |
| Sau cọc (chỉ net lưu trú) | 29.241 | 30,26% | 10,11M € |
| Sau cọc (+ giữ một phần cọc) | 29.241 | 30,26% | 12,07M € |

| Chỉ số | Giá trị |
|---|---:|
| Δ Net Revenue (chỉ lưu trú) | **+1,52M €** (**+17,7%**) |
| Δ Net Revenue (+ giữ cọc) | **+3,48M €** (**+40,6%**) |

→ **Kết luận:** Ngay cả khi mất 10% volume do rào cọc, net revenue vẫn tăng mạnh nhờ giảm hủy. Đây là cơ sở định lượng cho **Kịch bản B** (pilot ưu tiên Online TA lead dài / mùa cao điểm), không phải ước tính khách sạn giả định.

### 3.4 Phân khúc bổ sung chưa khai thác

| Chiều | Phát hiện | Hàm ý chính sách |
|---|---|---|
| **Loại khách sạn** | City Hotel hủy **30,68%** vs Resort Hotel **24,08%** | Ưu tiên áp Kịch bản B/A mạnh hơn ở **City Hotel**; Resort có thể giữ ngưỡng nhẹ hơn |
| **Room mis-match (từ `12`)** | **17,95%** booking không khớp phòng đặt; **74,9%** trong đó là free upgrade B→A (7.812 booking) | Lever doanh thu bổ sung: thay free upgrade bằng **upsell có tính phí** — có thể bù một phần doanh thu mất từ Kịch bản A (chưa cọc) |

### 3.5 Chi phí triển khai (ước tính đối trọng ROI)

| Hạng mục chi phí | Ước tính | Ghi chú |
|---|---|---|
| Tích hợp cổng thanh toán (Payment Gateway) | One-time, cần chào giá nhà cung cấp | Hold/Charge/Refund tự động qua PMS |
| Phát triển & test BRD (Hold — Charge — Refund) | ~2–4 tuần công IT/BA | Phụ thuộc mức độ tùy biến PMS hiện tại |
| Vận hành (email nhắc, xử lý tranh chấp FO) | Chi phí vận hành định kỳ | Chủ yếu nhân sự Lễ tân/Kế toán hiện có |

→ Ngay cả khi cộng thêm chi phí một lần cho tích hợp, **ROI năm đầu vẫn dương rõ rệt** so với mức tăng net revenue **+1,52M € đến +3,48M €** (mục 3.3) chỉ trên phạm vi Online TA lead > 30. Cần chốt giá nhà cung cấp Payment Gateway trước khi tính ROI chính xác.

---

## 4. Đối chuẩn thị trường (Benchmarking)

Khảo sát định tính các chuỗi khách sạn chuẩn 4–5 sao trong cùng khu vực *(benchmark thị trường — không lấy từ dataset dự án)*:

| Hạng mục | Khách sạn chúng ta (AS-IS) | Chuẩn thị trường (Marriott / Hilton) |
|---|---|---|
| **Hạn chót hủy miễn phí** | Linh hoạt / sát ngày *(giả định vận hành)* | 72h trước ngày Check-in |
| **Yêu cầu đặt cọc** | **98,7%** No Deposit (dữ liệu) | Cọc tối thiểu 1 đêm lưu trú |
| **Phân loại hạng giá** | Chủ yếu 1 mức giá linh hoạt | Tách biệt: Giá linh hoạt (cao) và Giá Non-Refundable (rẻ hơn ~15%) |

---

## 5. Đề xuất 3 kịch bản chính sách (Policy Scenarios)

Dựa trên dữ liệu, BA đề xuất 3 kịch bản vận hành để Ban Giám đốc cân nhắc, đi từ mức độ can thiệp nhẹ đến mạnh. Baseline neo **28,12%** toàn hệ thống; với Online TA dùng **35,5%** (hoặc **43,23%** nếu scope lead > 30).

### 5.1 Kịch bản A — Siết thời hạn hủy (No Deposit Reform)

- **Cơ chế:** Vẫn không yêu cầu khách cọc tiền. Nhưng hạn chót hủy miễn phí dời lên **72h (3 ngày)** trước Check-in *(thay cho chính sách linh hoạt sát ngày hiện tại)*.
- **Mục tiêu:** Cung cấp cho đội Lễ tân và Sales thêm thời gian dọn booking rác và chủ động bán lại phòng Walk-in — đặc biệt hữu ích với lead dài / mùa cao điểm.
- **Phạm vi ưu tiên:** Online TA × lead > 60 × Jul–Aug (hotspot).
- **Dự báo tỷ lệ hủy (ước lượng chính sách):** Toàn hệ thống từ **28,12%** xuống khoảng **24–26%** (giảm ~2–4 điểm %); tác động mạnh hơn tại hotspot nếu siết đúng nhóm rủi ro cao. *Chưa có A/B test trên dataset — cần pilot đo.*

### 5.2 Kịch bản B — Cọc bảo đảm 1 đêm (Partial Deposit) — *[BA khuyến nghị]*

- **Cơ chế:** Booking rủi ro cao (ưu tiên **Online TA, lead_time > 30**; mở rộng mùa cao điểm) phải cung cấp thẻ tín dụng. Hệ thống **Hold** hạn mức tương đương **1 đêm** lưu trú đầu tiên. Khách hủy sau cutoff (vd. 72h) bị charge khoản này.
- **Mục tiêu:** Đánh vào tâm lý mất tiền để loại nhóm "đặt giữ chỗ cho vui"; khớp BR-FIN-01 và mô phỏng DA.
- **Dự báo theo mô phỏng DA (Online TA, lead > 30):** Hủy từ **43,23%** xuống ~**30,3%** (giảm 30% tương đối), chấp nhận mất ~10% volume → net revenue **+1,52M €** (hoặc **+3,48M €** nếu giữ một phần cọc).
- **Dự báo toàn hệ thống (nếu mở rộng dần):** Hướng về dưới **24%** trong 12 tháng (KPI EDA đã đề xuất), tùy mức phủ chính sách.

### 5.3 Kịch bản C — Đóng gói không hoàn tiền (Fully Non-Refundable)

- **Cơ chế:** Ra mắt hạng phòng "Thanh toán ngay 100%". Khách không được hoàn/hủy/đổi ngày; bù lại giá rẻ hơn **~15%** so với giá linh hoạt.
- **Mục tiêu:** Chuyển rủi ro hủy thành chiết khấu; khóa cash flow ngay; tạo rate fence song song Kịch bản B.
- **Lưu ý dữ liệu:** Trong lịch sử, nhóm `deposit_type = Non Refund` có tỷ lệ hủy quan sát **95,0%** nhưng **n nhỏ (963)** và **association ≠ causation** (có thể là nhãn/đặc thù nhóm, không phải bằng chứng "cọc làm tăng hủy"). Không dùng con số này để bác bỏ Non-Refundable.
- **Dự báo vận hành:** Với hạng mới thiết kế đúng (thanh toán trước + điều khoản rõ), mục tiêu là **khóa doanh thu đã thu** (hủy sau thanh toán không làm mất tiền phòng), không claim "0% hủy lịch sử" từ dataset cũ.

---

## 6. Đánh giá tác động các bên liên quan (Stakeholder Impact)

| Bộ phận (Stakeholder) | Phản ứng dự kiến với Kịch bản B (Cọc 1 đêm) | Hành động giảm thiểu rủi ro (Mitigation Plan) |
|---|---|---|
| **Khách hàng** | E ngại nhập thẻ trên OTA. | Email nhắc thân thiện trước thời điểm trừ tiền 24h; minh bạch cutoff 72h. |
| **Sales & Marketing** | Lo ngại giảm CR / volume (~10% trong mô phỏng). | Chỉ áp dụng cọc vào **mùa cao điểm** và/hoặc **Online TA lead > 30**; mùa thấp điểm giữ No Deposit linh hoạt hơn. |
| **Lễ tân / Kế toán (FO)** | Quy trình hoàn/hủy/charge thẻ phức tạp. | BA viết **BRD** tích hợp cổng thanh toán tự động vào PMS. |
| **Revenue Management** | Ủng hộ — khớp hotspot Jul–Aug và mô phỏng +1,52M €. | Dùng model dự báo hủy (LightGBM **v2** scoring / **v2.1** bảo vệ inventory) để chọn booking cần hold chặt. |
| **Pháp lý / Compliance** | Rủi ro tranh chấp khi Hold/Charge thẻ không có lưu trú thực tế. | Đảm bảo tuân thủ **PCI-DSS** khi lưu thông tin thẻ; rà soát **luật bảo vệ người tiêu dùng** tại các thị trường khách chính (PRT, GBR, FRA…) trước khi charge; điều khoản cọc phải hiển thị rõ tại thời điểm đặt phòng (tránh khiếu nại "phí ẩn"). |

---

## 7. Khuyến nghị từ Business Analyst và bước tiếp theo

**Khuyến nghị:** Chọn **Kịch bản B (Cọc bảo đảm 1 đêm)** kết hợp **Kịch bản C (hạng Non-Refundable)** — tạo lựa chọn linh hoạt vs khóa giá, tối ưu RevPAR theo đúng hotspot DA đã chứng minh.

**Thứ tự triển khai đề xuất:**

1. **Pilot B** trên Online TA, lead > 30 (và Jul–Aug trước) — đo Δ cancel rate, volume, net revenue so với baseline mô phỏng `12`.
2. **Song song C** như rate fence (chiết khấu ~15%) cho khách chấp nhận khóa tiền.
3. **Kịch bản A** dùng làm bước đệm / cho segment ít rủi ro hơn nếu chưa sẵn sàng cọc toàn phần.

**Bước tiếp theo (Next Steps):**

Nếu Ban Giám đốc phê duyệt Kịch bản B & C, BA sẽ triển khai trong tuần tới:

- Họp nhà cung cấp Cổng thanh toán (Payment Gateway).
- Phát hành **BRD** chi tiết quy trình tự động Hold / Charge / Hoàn tiền (bổ sung BRD v1.2).
- Làm việc với Data Analyst để đưa model dự báo hủy (**v2** / **v2.1**) vào scoring vận hành và theo dõi KPI: cancel toàn cục **28,12% → < 24%**; Online TA × TA/TO **35,7% → < 30%**; giảm tỷ lệ No Deposit **98,7% → < 85%**.

### 7.1 Timeline & RACI đề xuất

| Tuần | Hành động | Chịu trách nhiệm (R) | Phê duyệt (A) | Hỗ trợ (C/I) |
|---|---|---|---|---|
| 1 | Họp & chốt nhà cung cấp Payment Gateway; rà soát compliance PCI-DSS | BA | Ban Giám đốc | IT, Pháp lý |
| 2 | Phát hành BRD Hold/Charge/Refund (bổ sung BRD v1.2) | BA | Revenue Management | FO/Kế toán, IT |
| 3–4 | Build & test tích hợp PMS ↔ Payment Gateway | IT | BA | FO/Kế toán |
| 5 | Soft-launch Pilot B (Online TA, lead > 30, phạm vi giới hạn) | Revenue Management | Ban Giám đốc | Sales & Marketing, BA |
| 6–9 | Theo dõi pilot: cancel rate, volume, net revenue, phản ứng OTA | Data Analyst | Revenue Management | BA |
| 10 | Đánh giá go/no-go mở rộng toàn hệ thống + Kịch bản C | BA + Revenue Management | Ban Giám đốc | Tất cả |

**Cổng phê duyệt (go/no-go):** Chỉ mở rộng toàn hệ thống nếu sau pilot (tuần 6–9): net revenue tăng dương, volume giảm không vượt quá 10% giả định, và không ghi nhận sụt giảm ranking OTA rõ rệt.

### 7.2 Theo dõi sau triển khai (Monitoring Cadence)

| Chỉ số | Tần suất theo dõi | Người review | Ngưỡng cảnh báo / rollback |
|---|---|---|---|
| Cancel rate (toàn cục, Online TA) | Hàng tuần | Revenue Management | Không giảm sau 4 tuần pilot |
| Volume booking Online TA | Hàng tuần | Sales & Marketing | Giảm > 10–15% so baseline |
| Net revenue / RevPAR | Hàng tháng | BA + Revenue Management | Net revenue âm so baseline |
| Khiếu nại khách hàng (Hold/Charge) | Hàng tuần | FO/Kế toán | Tỷ lệ khiếu nại tăng bất thường |
| Ranking / visibility trên OTA | Hàng tháng | Sales & Marketing | Sụt giảm rõ rệt vs trước pilot |

---

## 8. Tài liệu nguồn

| File | Nội dung dùng trong báo cáo này |
|---|---|
| [`02_eda_stage1_cancellation_analysis.md`](02_eda_stage1_cancellation_analysis.md) | Cancel rate theo segment / channel / lead time |
| [`03_summary_eda_key_findings.md`](03_summary_eda_key_findings.md) | KPI mục tiêu & ma trận ưu tiên |
| [`12_brd_gap_analysis.md`](12_brd_gap_analysis.md) | Hotspot 3 chiều, revenue loss, deposit simulation, room mis-match |
| [`13_cancellation_model_version_selection.md`](13_cancellation_model_version_selection.md) | Chọn v2 / v2.1 theo mục tiêu vận hành |
| [`14_key_findings_after_prediction_models.md`](14_key_findings_after_prediction_models.md) | Driver hủy & khuyến nghị model |

---

*Báo cáo đề xuất chính sách quản trị rủi ro hủy phòng và tối ưu RevPAR. Cập nhật: 15/07/2026.*
