# 32 — Lead Stakeholder Presentation · Script & Q&A Playbook

> **Loại:** Speaker notes + xử lý Q&A  
> **Deck:** [`31`](31_stakeholder_presentation.md) (12 slides)  
> **Thời lượng:** 20–25' trình bày · 15–20' Q&A  
> **Cập nhật:** 24/07/2026

---

## 1. Vai trò người dẫn

| Vai trò | Trách nhiệm trong phòng |
|---------|-------------------------|
| **Presenter (Data/BA lead)** | Findings → ROI → xin duyệt |
| **RM co-pilot** | Xác nhận feasibility lịch giá / OTA |
| **FO co-pilot** | Walk Protocol · buffer vận hành |
| **Note-taker** | Ghi câu hỏi → đưa vào Report v2.0 ([`33`](33_final_business_report_v2.md)) |

**Tone:** recommend-only · số có nguồn · thừa nhận hạn chế in-sample · không hứa P&L chắc chắn.

---

## 2. Script theo slide (gợi ý lời nói)

### Slide 1–2 (2')
“Hôm nay không demos model. Chúng ta chốt **luật giá khác nhau cho City và Resort**, gắn với hủy và Direct, rồi xin duyệt pilot có cửa chết.”

### Slide 3 (1')
“Chuỗi 20→27 đã forecast, ước ε, tối ưu, ensemble, rồi **validate**. Back-test go. Chưa live OTA.”

### Slide 4 (3') — finding then stop
“Nếu chỉ nhớ một slide: **City Peak tăng giá có lợi; Resort Peak tăng giá làm tổn RevPAR.** Đó là lý do playbook bất đối xứng.”

*Pause.* Nhìn GM/RM.

### Slide 5 (2')
“Model thuần bảo +21% City — chúng tôi **không** đề xuất chốt mức đó. Band ±15% và dual-objective là lớp an toàn.”

### Slide 6 (2')
“Hủy không chỉ là cost. High-tier là **inventory tạm** nếu bán lại đúng BAR qua Direct.”

### Slide 7 (3')
Đọc 5 recommendations như quyết định, không như wishlist. Kết: “Policy lock: cấm shock Resort Peak.”

### Slide 8 (3') — ROI
“Floor ~€10k đã neo back-test hẹp. Base ~€59k nếu chạy playbook trong guardrail. Upside Direct ~€70–85k **có điều kiện** Legal + UX. Đề nghị Finance lấy A làm floor, B làm base.”

### Slide 9–10 (3')
Roadmap 16 tuần + kill switches. Nhấn: “Chúng ta có nút tắt — không phải phóng không phanh.”

### Slide 11–12 (2')
Xin duyệt 4 checkbox. Mở Q&A.

---

## 3. Q&A — Business implications

### Q1. “Tăng giá City Peak có làm mất market share OTA?”
**A:** Trong biên +10% what-if, RevPAR vẫn +2,3% dù demand −7%. Ensemble không đẩy +21%. Theo dõi share OTA hàng tuần trong pilot; nếu conversion Direct/OTA lệch ngưỡng đã ký với Sales → hạ về cạnh dưới band.

### Q2. “Tại sao không tăng giá Resort Peak khi ADR lịch sử rất cao?”
**A:** Chính vì ADR Peak đã cao — shock thêm +10% làm volume rơi nhanh hơn phần thu được (−2,1% RevPAR). Giữ mix Direct/Groups và bảo vệ trải nghiệm tốt hơn “test giá”.

### Q3. “CUT Resort Low có phá brand / giá tham chiếu?”
**A:** CUT ~−5% trong band, có floor, ưu tiên Offline trước Online, đo cancel. Không phải flash-sale sâu. Member/Direct rate nằm trong floor–recommend.

### Q4. “Direct best-rate có đụng hợp đồng OTA?”
**A:** Có rủi ro parity — đó là **cổng Legal bắt buộc** trước go-live UX (phase W13–14). Pilot giá City Peak có thể chạy shadow/band nội bộ trước khi public best-rate.

### Q5. “Impact €59k có vào budget năm nay không?”
**A:** Đây là proxy panel năm hóa, không phải forecast P&L đã ký. Đề xuất budget nội bộ neo **Conservative ~€10k** cho năm pilot; phần còn lại ghi nhận sau khi đo shadow/pilot thật.

---

## 4. Q&A — Feasibility

### Q6. “RMS hiện tại có nhận được `bar_recommend` không?”
**A:** Phase 0–1 là map rule sheet → calendar/RMS (thủ công hoặc file export). Shadow 2 tuần không đẩy OTA. Automation API là next step sau retrospective ([`35`](35_project_retrospective.md)).

### Q7. “FO có chịu nổi Walk Protocol?”
**A:** Buffer chỉ High-tier + safety factor 0,6; Peak chuyển v2.1 @ 0,28. Kill switch walk &gt; 5%. Chi phí walk tham chiếu ~1,5×ADR + 1 đêm comp — đã nêu trong [`26`](26_overbooking_buffer_strategy.md).

### Q8. “Model hủy có đủ tin cậy?”
**A:** v2 Precision ~0,49 → không overbook bằng điểm số thô. Dùng % hủy thật theo ô × 0,6. Roadmap migrate v2.2 calibrated. Pilot đo lại % hủy thật theo tier.

### Q9. “ε lấy từ đâu — OLS lịch sử toàn dương?”
**A:** OLS bị bias dương nên **không** dùng primary. Prior RM City −0,70 / Resort −1,10; chỉ dùng ε̂ segment khi âm và đủ tháng (vd. Resort Offline −2,24). Đây là giả định có kiểm soát, không phải causal RCT.

### Q10. “16 tuần có quá dài / quá ngắn?”
**A:** Dài hơn ‘bật giá tuần sau’, ngắn hơn full transformation. Có thể rút Direct UX nếu Legal chậm — không được rút Shadow. Không được đảo thứ tự: **không** Resort Peak test trước City Peak validate.

### Q11. “Ai chịu trách nhiệm nếu RevPAR đỏ?”
**A:** RM lead là decision owner; Data cung cấp KPI tuần; FO báo walk. Kill switch kích hoạt theo ngưỡng đã duyệt slide 10 — không cần họp lại để tắt.

### Q12. “Có A/B thật chưa?”
**A:** Chưa. Có simulation + back-test 2015–2016. Bước tiếp theo trong guide: shadow rồi pilot có đối chứng tháng/ô. Report v2.0 ghi rõ hạn chế này.

---

## 5. Câu hỏi khó — khung trả lời 3 lớp

Khi bị dồn:

1. **Số:** trích 27/28 (Δ%, go/no-go).  
2. **Giới hạn:** in-sample / prior / chưa live.  
3. **Hành động:** shadow / kill switch / owner.

Tránh: hứa “chắc chắn +3% RevPAR năm sau”.

---

## 6. Checklist sau presentation (đưa vào v2.0)

| # | Việc | Owner | Due |
|---|------|-------|-----|
| 1 | Ghi mọi câu hỏi + quyết định duyệt/hoãn | Note-taker | Trong ngày |
| 2 | Cập nhật [`33`](33_final_business_report_v2.md) | BA | +3 ngày làm việc |
| 3 | Phát hành rule sheet ký ([`34`](34_implementation_guide.md)) | RM | +5 ngày |
| 4 | Kick-off Legal parity | Legal + RM | +5 ngày |
| 5 | Bật shadow BAR | Data + RM | Theo W3 roadmap |

---

## 7. Mẫu ghi chú phòng họp (paste vào v2.0)

```text
Ngày:
Người tham dự:
Quyết định duyệt: [ ] Playbook [ ] Pilot [ ] Legal gate [ ] ROI floor=A
Câu hỏi mở:
Phản hồi bắt buộc đưa vào v2.0:
Rủi ro mới phát sinh:
```
