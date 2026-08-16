# 29 — Executive Summary

> **Loại:** Tóm tắt điều hành (C-level / Stakeholder) · 1–2 trang  
> **Dự án:** Hotel Booking Demand — Dynamic Pricing & Booking Optimization  
> **Nguồn:** [`27`](27_validate_simulation_pricing_playbook.md)–[`28`](28_finalize_dynamic_pricing_playbook.md) · pipeline 11→26  
> **Cập nhật:** 16/08/2026 · **Recommend-only**

---

## 1. Key findings

1. **City và Resort không cùng một chiến lược giá.** City kém co giãn (ε ≈ −0,70) → Peak **RAISE/PROTECT** hợp lệ (+2,3% RevPAR khi +10% ADR). Resort co giãn hơn (ε ≈ −1,10) → Peak **không** được shock +10% ADR (−2,1% RevPAR); Low season **CUT ~−5%** tăng nhẹ revenue và giảm proxy hủy.
2. **Tối ưu thuần doanh thu quá aggressive.** Analytic p★ gợi ý City RAISE ~+21%; ensemble BAR (±15%) + dual-objective (hạ ~7–8%) mới an toàn vận hành khi hủy/OTA High cao.
3. **Segment có nuance:** Resort Offline TA/TO rất elastic (ε_ops ≈ −2,24) → promo Offline trước Online; Groups cả hai property inelastic → harden hợp đồng, không dump block.
4. **Hủy 28% tổng thể** tạo cơ hội buffer có kiểm soát: High-tier (P ≥ 0,55, hủy thật ~64%) là nguồn bán lại — **ưu tiên Direct** đúng BAR, không dump OTA.
5. **Back-test 2015–2016 đạt go=True** cho cả City và Resort theo KPI ΔRevPAR ≥ 0 và Δcancel ≤ +1 pp.

---

## 2. Chiến lược & chính sách — ba can thiệp

**Bottom line.** Một chính sách giá đồng nhất cho hai khách sạn đang khiến City mất doanh thu tiềm năng và Resort chịu rủi ro giảm RevPAR — trong khi 28% nhu cầu bị rò rỉ qua kênh hủy chưa được quản trị theo rủi ro. Ba can thiệp dưới đây thu hồi phần giá trị này mà không đánh đổi bằng walk hay xung đột kênh.

**1. Định giá theo đặc thù property, không theo quy tắc chung.** City cho phép nâng giá cao điểm có kiểm soát; Resort thì ngược lại — mọi lần tăng giá mạnh tại Peak đều làm giảm RevPAR.

→ *Quyết định:* tách playbook. City Peak harden BAR trong band. Resort Peak **HOLD**. Resort Low CUT ~−5%, promo Offline trước Online.

**2. Chuyển rủi ro hủy từ tổn thất thành tài sản vận hành.** Hệ thống đang xử lý mọi booking như nhau. Chấm điểm P(hủy) cho phép phân luồng: Low-tier đặt liền mạch; High-tier vào bộ đệm bán lại đúng BAR qua Direct — không dump OTA cận ngày.

→ Đòn bẩy là **kênh bán lại** (margin), không chỉ giảm tỷ lệ hủy.

**3. Can thiệp có chọn lọc, không siết đại trà.** Không cọc bắt buộc hay overbook toàn hệ thống. Chỉ chạm nhóm rủi ro cao (Online TA, lead dài) và hợp đồng đoàn, với trần an toàn để kiểm soát walk.

→ *Nguyên tắc:* rủi ro cục bộ cần giải pháp cục bộ.

| # | Quyết định khóa | Làm ngay | Không làm |
|---|-----------------|----------|-----------|
| R1 | Playbook bất đối xứng | City Peak harden; Resort Peak HOLD; Resort Low CUT −5% | Một rate card cho cả hai property |
| R2 | Không chốt cực trị +21% | Floor–recommend–ceil (±15%); dual α ≤ 0,7 khi Peak + High OTA | Chốt p★ thuần doanh thu |
| R3 | Booking theo tier hủy | Low = frictionless; Medium = CRM confirm; High = buffer → refill Direct | Overbook Low/Medium |
| R4 | Tăng Direct | Best-rate trong band; mở slot buffer Direct trước OTA | Public best-rate trước Legal parity |
| R5 | Pilot có cửa chết | 16 tuần, từng phase một cổng | Big-bang toàn portfolio |

---

## 3. Expected impact

| Kịch bản | Δ doanh thu năm hóa (ước) | Điều kiện |
|----------|--------------------------:|-----------|
| A · Conservative (rule back-test) | **~€10k** | Chỉ Peak City RAISE + Low Resort CUT |
| B · Full p★ trong band | **~€59k** | Áp ε prior + ensemble; base portfolio ~€2,84M |
| C · B + Direct / buffer mix | **~€70–85k** | Thêm tiết kiệm commission + refill đúng BAR |

**Phi doanh thu:** giảm friction Direct, kiểm soát walk < 3–5%, Δcancel ô pilot ≤ +1 pp, governance giá nhất quán City/Resort.

Con số trên **chưa** gồm upside thu hồi biên từ giảm phụ thuộc OTA — đo trong pilot.

> Impact là proxy in-sample — triển khai qua shadow/pilot trước khi coi là target P&L.

---

## 4. Timeline 16 tuần — cổng ra quyết định

Mỗi phase trả lời **một câu hỏi**. Không đạt cổng thì HOLD, không sang phase sau.

| Phase | Tuần | Quyết định | Làm | Không làm | Cổng sang phase sau |
|-------|------|------------|-----|-----------|---------------------|
| **0 · Foundation** | 1–2 | Tách playbook City / Resort? | Ký rule sheet; workshop FO/Sales | Đổi giá OTA | Chữ ký GM + RM |
| **1 · Shadow** | 3–4 | Dải BAR có đáng tin? | BAR chạy song song nội bộ | Đẩy rate plan OTA | ≥10 ngày làm việc; ≥90% quan sát giải thích được |
| **2 · City Peak** | 5–8 | Harden City Peak? | Nâng BAR trong band; bật buffer High-tier; refill Direct | Shock Resort Peak; overbook Low/Medium | ΔRevPAR ≥ 0 · Δcancel ≤ +1 pp · walk < 5% |
| **3 · Resort Low** | 9–12 | CUT ~−5% mùa thấp? | Promo Offline trước Online | +ADR Resort Peak | Rev không giảm; zero sự cố Peak |
| **4 · Direct UX** | 13–14 | Public best-rate? | Giảm ma sát Low-tier; Legal parity | Best-rate nếu Legal chưa OK (**được trượt**) | Legal memo OK — hoặc giữ refill Direct im lặng |
| **5 · Scale** | 15–16 | Mở Shoulder? | Playbook v1.1; dashboard tuần | Scale khi kill switch từng kích | Post-mortem; scale hoặc HOLD |

**Kill switch (mọi phase live).** Δcancel > +1 pp / 2 tuần → HOLD ô. Walk > 5%/tuần → siết buffer. Resort Peak đỏ sau +ADR → rollback. Khiếu nại parity → tắt best-rate public.

Thao tác từng bước: [`34`](34_implementation_guide.md). Playbook: [`28`](28_finalize_dynamic_pricing_playbook.md).

---

## 5. Quyết định cần duyệt hôm nay

1. Approve playbook R1–R2 (policy lock: **cấm** +ADR shock Resort Peak).
2. Approve pilot 16 tuần + ngân KPI / kill switches.
3. Approve Legal review rate-parity trước launch best-rate Direct.
4. Chọn kịch bản ROI báo cáo nội bộ: **A (conservative)** làm floor, **B** làm base case.

---

## Tài liệu đầy đủ

- Narrative: [`30`](30_final_business_report.md) · v2.0: [`33`](33_final_business_report_v2.md)  
- Deck: [`31`](31_stakeholder_presentation.md) · Script/Q&A: [`32`](32_stakeholder_presentation_qa.md)  
- Implementation: [`34`](34_implementation_guide.md) · Retrospective: [`35`](35_project_retrospective.md) · Playbook: [`28`](28_finalize_dynamic_pricing_playbook.md)
