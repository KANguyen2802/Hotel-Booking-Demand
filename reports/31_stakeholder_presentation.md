# 31 — Stakeholder Presentation Deck (12 slides)

> **Hình thức:** Markdown slide deck — mỗi `---` = 1 slide · 12 slides (trong khung 10–15)  
> **Thời lượng đề xuất:** 20–25 phút trình bày + 15–20 phút Q&A  
> **Script & Q&A:** [`32`](32_stakeholder_presentation_qa.md)  
> **Cập nhật:** 24/07/2026

---

## Slide 1 — Title

# Hotel Booking Demand  
## Dynamic Pricing & Booking Optimization  
**Final Stakeholder Presentation**

City Hotel · Resort Hotel · Recommend-only  
24/07/2026

*Agenda: Findings → Recommendations → ROI → Roadmap → Quyết định cần duyệt*

---

## Slide 2 — Vì sao họp hôm nay?

### Vấn đề
- Hai property **không cùng** độ co giãn giá  
- ~**28%** booking hủy — rủi ro trống phòng & cơ hội bán lại  
- Cần rule giá + quy trình booking **có chứng cứ**, không thử-sai Peak

### Mục tiêu phiên
1. Chốt **playbook** City vs Resort  
2. Duyệt **pilot 16 tuần** + KPI / kill switch  
3. Neo **ROI** conservative vs base case  

---

## Slide 3 — Hành trình dữ liệu → quyết định

```text
Forecast 20-21  →  ε 22  →  p* 23 / ensemble 24
        ↓
   Validate 27 (sim · what-if · back-test)
        ↓
 Playbook 28 + Buffer 26 + Scoring 11
        ↓
   Quyết định RM hôm nay
```

**Trạng thái:** Back-test **go=True** · chưa đẩy giá live OTA

---

## Slide 4 — Key finding #1: Bất đối xứng City / Resort

| | City | Resort |
|---|------|--------|
| ε vận hành | **−0,70** (inelastic) | **−1,10** (elastic hơn) |
| Peak +10% ADR | RevPAR **+2,3%** | RevPAR **−2,1%** |
| Hành động đúng | Harden / RAISE trong band | **HOLD** Peak · CUT Low |

**Một dòng:** *Cùng portfolio — hai luật giá.*

---

## Slide 5 — Key finding #2: Đừng chốt cực trị +21%

- Tối ưu thuần gợi ý City **RAISE ~+21%** ADR  
- Dual-objective hạ BAR **~7–8%** để giảm rủi ro hủy  
- Ensemble chốt **floor · recommend · ceil (±15%)**

**Guardrail:** Peak + High-tier OTA → ưu tiên **cạnh dưới** band, α ≤ 0,7

---

## Slide 6 — Key finding #3: Hủy → buffer → Direct

| Tier | P(hủy) | Hủy thật | Hành động |
|------|--------|----------|-----------|
| Low | &lt; 0,35 | ~4% | Frictionless |
| Medium | 0,35–0,55 | ~24% | CRM confirm |
| High | ≥ 0,55 | ~64% | Buffer → **Direct @ BAR** |

Walk Protocol sẵn sàng · KPI walk **&lt; 3–5%**

---

## Slide 7 — Recommendations (5 quyết định)

1. **City Peak:** harden BAR trong band 24  
2. **Resort Peak:** cấm shock +ADR thuần  
3. **Resort Low / từ Oct:** CUT ~−5% · promo Offline trước Online  
4. **Booking flow:** tier hủy × BAR × refill Direct  
5. **Pilot có cửa chết:** Shadow → City Peak → Resort Low → Direct UX  

Chi tiết: [`28`](28_finalize_dynamic_pricing_playbook.md) · [`29`](29_executive_summary.md)

---

## Slide 8 — ROI & expected impact

Base portfolio năm hóa ~**€2,84M** (proxy)

| Case | Uplift / năm |
|------|-------------:|
| A Conservative (back-test) | **~€10k** |
| B Full p★ + band | **~€59k** |
| C + Direct mix (ước) | **~€70–85k** |

> Đề xuất báo cáo nội bộ: **A = floor · B = base · C = upside có điều kiện**

---

## Slide 9 — Roadmap 16 tuần

| Phase | Tuần | Exit |
|-------|------|------|
| Foundation | 1–2 | Rule sheet signed-off |
| Shadow BAR | 3–4 | Band ổn, không đẩy OTA |
| Pilot City Peak | 5–8 | ΔRevPAR ≥ 0 · Δcancel ≤ +1 pp |
| Resort Low CUT | 9–12 | Rev ↑ · không Peak +ADR |
| Direct UX | 13–14 | % Direct ↑ |
| Scale | 15–16 | Playbook v1.1 |

---

## Slide 10 — Risks & kill switches

**Top risks:** Resort Peak +ADR · RAISE +21% thuần · ε OLS bias · walk do buffer · OTA parity  

**Tắt máy nếu:**
- Δcancel ô pilot &gt; +1 pp / 2 tuần  
- Walk &gt; 5% / tuần  
- Resort Peak đỏ sau bất kỳ +ADR  
- Complaint parity → tạm best-rate Direct  

---

## Slide 11 — Quyết định cần duyệt hôm nay

- [ ] Approve playbook bất đối xứng (R1–R2)  
- [ ] Approve pilot 16 tuần + KPI pack  
- [ ] Approve Legal review trước best-rate Direct  
- [ ] Chọn ROI floor = Conservative (A)  

**Owner đề xuất:** Revenue lead · hỗ trợ Data / FO / Digital / Legal  

---

## Slide 12 — Next & Q&A

### Next 30 ngày
1. Ký rule sheet ([`34`](34_implementation_guide.md))  
2. Bật shadow `bar_recommend`  
3. Kick-off Legal parity  

### Tài liệu
Exec [`29`](29_executive_summary.md) · Narrative [`30`](30_final_business_report.md) · Q&A [`32`](32_stakeholder_presentation_qa.md)

# Q&A
*Business implications · Feasibility · Timeline · Risk*

---

## Ghi chú thiết kế deck

- Không nhồi công thức OLS trên slide — để appendix lục / Q&A.  
- Số trên slide đã làm tròn theo báo cáo 27–28.  
- Nếu rút còn **10 slides:** gộp 4+5 → một slide “Findings”; gộp 10 vào 9.  
- Nếu mở **15 slides:** tách slide Segment ε; tách Walk Protocol; thêm appendix lục KPI dashboard.
