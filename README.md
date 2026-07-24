# Hotel Booking Demand — Tối ưu RevPAR & quy trình đặt phòng

Dự án phân tích nhu cầu đặt phòng khách sạn nhằm trả lời một câu hỏi điều hành:

> **Làm sao tăng doanh thu phòng (RevPAR) mà không đẩy hủy, walk, và xung đột kênh — khi City Hotel và Resort Hotel không cùng một nhịp cầu?**

Kết quả chính là **bộ quy tắc giá (pricing playbook)**, **luồng xử lý booking theo mức rủi ro hủy**, và **lộ trình triển khai có kiểm soát** — đã kiểm chứng trên dữ liệu lịch sử trước khi đề xuất pilot thực tế.

---

## Bài toán nghiệp vụ

Hai cơ sở trong cùng portfolio:

| | City Hotel | Resort Hotel |
|---|------------|--------------|
| Đặc điểm cầu | Ít nhạy giá hơn | Nhạy giá hơn, đặc biệt mùa thấp |
| Cao điểm (Peak) | Có thể **cứng giá / nâng BAR** trong biên an toàn | **Không** nên tăng giá mạnh — dễ mất volume hơn phần thu thêm |
| Mùa thấp (Low) | Kích cầu nhẹ, có kiểm soát | **Giảm giá nhẹ (~5%)** hiệu quả hơn |

Song song, khoảng **28%** booking bị hủy. Phần rủi ro cao vừa là mối đe dọa occupancy, vừa là cơ hội **bán lại đúng giá mục tiêu qua kênh Direct** nếu biết phân loại sớm.

---

## Phát hiện chính

1. **Một chiến lược giá cho cả hai property là sai.** City Peak chịu được tăng giá có kiểm soát (+2,3% RevPAR khi ADR +10%). Resort Peak nếu +10% ADR làm RevPAR giảm (~2,1%).
2. **“Giá tối ưu trên giấy” dễ quá tay.** Mức tăng rất lớn chỉ nên nằm trong **dải giá đề xuất (floor – recommend – ceil)**, không chốt một mức cực đoan lên toàn kênh.
3. **Kênh và phân khúc khác nhau.** Ví dụ Resort Offline nhạy khuyến mãi hơn Online; Groups nên siết hợp đồng / attrition hơn là dump giá.
4. **Hủy có thể quản trị theo tầng rủi ro:** khách an toàn → trải nghiệm đặt nhanh; rủi ro trung bình → nhắc xác nhận; rủi ro cao → đưa vào bộ đệm bán lại, ưu tiên Direct.
5. **Quy tắc hẹp đã qua kiểm chứng lịch sử** (City Peak nâng giá / Resort Low giảm nhẹ) đạt điều kiện “go” trên cửa sổ back-test — đủ cơ sở để pilot, chưa phải cam kết P&L chắc chắn.

---

## Khuyến nghị điều hành (tóm tắt)

| Ưu tiên | Việc làm |
|---------|----------|
| Giá City Peak | Harden / nâng BAR trong dải an toàn |
| Giá Resort Peak | Giữ ổn định — **cấm** shock tăng giá thuần |
| Giá Resort mùa thấp | Giảm nhẹ (~5%), ưu tiên Offline trước online |
| Đặt phòng | Phân luồng theo rủi ro hủy → giảm ma sát Direct |
| Triển khai | Pilot có giai chết (shadow → City Peak → Resort Low → Direct), có nút tắt nếu hủy/walk xấu |

**Tác động kỳ vọng (ước, trên base portfolio ~€2,8M/năm):**

- Thận trọng (chỉ rule đã back-test): khoảng **+€10k**/năm  
- Áp playbook đầy đủ trong guardrail: khoảng **+€59k**/năm  
- Thêm tối ưu mix Direct / bán lại buffer: khoảng **+€70–85k**/năm (có điều kiện pháp lý kênh & vận hành)

Chi tiết số và caveat: [Executive Summary](reports/29_executive_summary.md).

---

## Hành trình phân tích (theo nghiệp vụ)

```text
Hiểu hủy & rủi ro booking
        ↓
Chính sách bán vượt / bộ đệm phòng
        ↓
Dự báo nhu cầu · ADR · RevPAR (tách City / Resort)
        ↓
Độ nhạy giá · tối ưu · dải giá đề xuất
        ↓
Kiểm chứng trên lịch sử → Pricing Playbook
        ↓
Báo cáo điều hành · presentation · hướng dẫn triển khai
```

Không cần đọc toàn bộ kỹ thuật để nắm quyết định: bắt đầu từ các báo cáo ở mục dưới.

---

## Đọc gì trước? (dành cho lãnh đạo & RM)

| Bạn cần… | Đọc |
|----------|-----|
| 1–2 trang quyết định | [29 — Executive Summary](reports/29_executive_summary.md) |
| Câu chuyện từ dữ liệu đến quyết định | [30 — Final Business Report](reports/30_final_business_report.md) |
| Bản sau góp ý stakeholder | [33 — Business Report v2.0](reports/33_final_business_report_v2.md) |
| Quy tắc giá & booking chi tiết | [28 — Dynamic Pricing Playbook](reports/28_finalize_dynamic_pricing_playbook.md) |
| Slide họp (12 trang) | [31 — Stakeholder Presentation](reports/31_stakeholder_presentation.md) |
| Gợi ý trả lời Q&A | [32 — Presentation & Q&A](reports/32_stakeholder_presentation_qa.md) |
| Làm từng bước khi triển khai | [34 — Implementation Guide](reports/34_implementation_guide.md) |
| Bài học & kế hoạch theo dõi | [35 — Retrospective & Monitoring](reports/35_project_retrospective.md) |

Mục lục đóng gói: [reports/29_35_closing_pack_index.md](reports/29_35_closing_pack_index.md).

### Báo cáo nền (nếu muốn đào sâu hơn)

| Chủ đề | Báo cáo gợi ý |
|--------|----------------|
| Hủy & xác suất rủi ro | `reports/11_*.md`, tổng quan `11b_*` |
| Overbooking / buffer | [26 — Overbooking Buffer Strategy](reports/26_overbooking_buffer_strategy.md) |
| Dự báo & stance giá | `reports/20*` → [21](reports/21_key_findings_after_forecasting_models_city_resort.md) |
| Độ nhạy giá & tối ưu | [22](reports/22_dynamic_pricing_elasticity_city_resort.md)–[25](reports/25_key_findings_dynamic_pricing_pipeline_city_resort.md) |
| Kiểm chứng playbook | [27 — Validate Simulation](reports/27_validate_simulation_pricing_playbook.md) |

---

## Phạm vi & nguyên tắc

- **Hai property:** City Hotel và Resort Hotel — luôn phân tích / khuyến nghị **tách biệt**.  
- **Mùa:** Peak = tháng 7–8 · Shoulder = 4–6 & 9–10 · Low = 11–3.  
- **Recommend-only:** báo cáo đề xuất hành động cho con người duyệt; không tự đẩy giá lên OTA.  
- **Pilot trước khi scale:** shadow → ô ưu tiên → mở rộng; có kill switch khi hủy hoặc walk vượt ngưỡng.

---

## Dashboard (xem số nhanh)

Có giao diện theo dõi RevPAR, hủy, và mô phỏng giá trong thư mục `dashboard/` (dành cho team phân tích / RM khi cần xem biểu đồ). Nội dung quyết định vẫn lấy từ bộ báo cáo `reports/` ở trên.

---

## Liên hệ đọc tiếp theo vai trò

| Vai trò | Bắt đầu từ |
|---------|------------|
| GM / Ban lãnh đạo | [29](reports/29_executive_summary.md) → [31](reports/31_stakeholder_presentation.md) |
| Revenue Management | [28](reports/28_finalize_dynamic_pricing_playbook.md) → [34](reports/34_implementation_guide.md) |
| Front Office / CRM | [26](reports/26_overbooking_buffer_strategy.md) + mục booking trong [28](reports/28_finalize_dynamic_pricing_playbook.md) |
| Finance | Mục ROI trong [29](reports/29_executive_summary.md) và chuẩn báo cáo trong [33](reports/33_final_business_report_v2.md) |
| Legal / Sales (kênh) | Cổng parity & Direct trong [33](reports/33_final_business_report_v2.md) · [34](reports/34_implementation_guide.md) Phase 4 |

---

*Cập nhật: 24/07/2026 · Tập trung nội dung phân tích & nghiệp vụ.*
