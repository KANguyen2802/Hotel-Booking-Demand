# 29 — Executive Summary

> **Loại:** Tóm tắt điều hành (C-level / Stakeholder) · 1–2 trang  
> **Dự án:** Hotel Booking Demand — Dynamic Pricing & Booking Optimization  
> **Nguồn:** [`27`](27_validate_simulation_pricing_playbook.md)–[`28`](28_finalize_dynamic_pricing_playbook.md) · pipeline 11→26  
> **Cập nhật:** 24/07/2026 · **Recommend-only**

---

## 1. Key findings

1. **City và Resort không cùng một chiến lược giá.** City kém co giãn (ε ≈ −0,70) → Peak **RAISE/PROTECT** hợp lệ (+2,3% RevPAR khi +10% ADR). Resort co giãn hơn (ε ≈ −1,10) → Peak **không** được shock +10% ADR (−2,1% RevPAR); Low season **CUT ~−5%** tăng nhẹ revenue và giảm proxy hủy.
2. **Tối ưu thuần doanh thu quá aggressive.** Analytic p★ gợi ý City RAISE ~+21%; ensemble BAR (±15%) + dual-objective (hạ ~7–8%) mới an toàn vận hành khi hủy/OTA High cao.
3. **Segment có nuance:** Resort Offline TA/TO rất elastic (ε_ops ≈ −2,24) → promo Offline trước Online; Groups cả hai property inelastic → harden hợp đồng, không dump block.
4. **Hủy 28% tổng thể** tạo cơ hội buffer có kiểm soát: High-tier (P ≥ 0,55, hủy thật ~64%) là nguồn bán lại — **ưu tiên Direct** đúng BAR, không dump OTA.
5. **Back-test 2015–2016 đạt go=True** cho cả City và Resort theo KPI ΔRevPAR ≥ 0 và Δcancel ≤ +1 pp.

---

## 2. Recommendations

| # | Quyết định | Hành động ngay |
|---|------------|----------------|
| R1 | Playbook bất đối xứng | City Peak harden BAR trong band; Resort Peak HOLD; Resort Low CUT −5% |
| R2 | Không chốt cực trị +21% | Luôn dùng floor–recommend–ceil (±15%) + dual α ≤ 0,7 khi Peak + High OTA |
| R3 | Booking theo tier hủy | Low = frictionless; Medium = CRM confirm; High = buffer → refill Direct |
| R4 | Tăng Direct | Best-rate trong band; mở slot buffer Direct trước OTA; giảm friction Low-tier |
| R5 | Pilot có cửa chết | 16 tuần: Shadow → City Peak → Resort Low → Direct UX; kill switch nếu Δcancel / walk vượt ngưỡng |

---

## 3. Expected impact

| Kịch bản | Δ doanh thu năm hóa (ước) | Điều kiện |
|----------|--------------------------:|-----------|
| A · Conservative (rule back-test) | **~€10k** | Chỉ Peak City RAISE + Low Resort CUT |
| B · Full p★ trong band | **~€59k** | Áp ε prior + ensemble; base portfolio ~€2,84M |
| C · B + Direct / buffer mix | **~€70–85k** | Thêm tiết kiệm commission + refill đúng BAR |

**Phi doanh thu:** giảm friction Direct, kiểm soát walk &lt; 3–5%, Δcancel ô pilot ≤ +1 pp, governance giá nhất quán City/Resort.

> Impact là proxy in-sample — triển khai qua shadow/pilot trước khi coi là target P&L.

---

## 4. Quyết định cần stakeholder duyệt

1. Approve playbook R1–R2 (policy lock: **cấm** +ADR shock Resort Peak).  
2. Approve pilot 16 tuần + ngân KPI / kill switches.  
3. Approve Legal review rate-parity trước launch best-rate Direct.  
4. Chọn kịch bản ROI báo cáo nội bộ: **A (conservative)** làm floor, **B** làm base case.

---

## Tài liệu đầy đủ

- Narrative: [`30`](30_final_business_report.md) · v2.0: [`33`](33_final_business_report_v2.md)  
- Deck: [`31`](31_stakeholder_presentation.md) · Script/Q&A: [`32`](32_stakeholder_presentation_qa.md)  
- Implementation: [`34`](34_implementation_guide.md) · Retrospective: [`35`](35_project_retrospective.md) · Playbook: [`28`](28_finalize_dynamic_pricing_playbook.md)
