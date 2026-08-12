# 35 — Project Retrospective · Lessons · Next Steps · Monitoring

> **Loại:** Retrospective đóng Phase 2 analytics → chuẩn bị Phase 3 operations  
> **Phạm vi dự án:** Hotel Booking Demand (hủy · forecast · dynamic pricing · buffer · playbook)  
> **Cập nhật:** 24/07/2026

---

## 1. Project arc (nhìn lại)

```text
Hủy & scoring (11–16)
    → Overbooking / buffer (26)
    → Forecast ADR/RevPAR (18–21)
    → Elasticity · optimize · ML (22–24)
    → Synthesis (25)
    → Validate (27) → Playbook (28)
    → Stakeholder pack (29–34)
```

**Thành công then chốt:** đi hết vòng **forecast → ε → p★ → ensemble → validate → playbook → governance**, tách City/Resort từ đầu.

---

## 2. Lessons learned

### 2.1 Điều làm tốt

| Lesson | Vì sao quan trọng |
|--------|-------------------|
| Tách City / Resort sớm | Tránh “một ε / một RAISE” sai cho cả portfolio |
| Không tin OLS ε dương | Tránh khuyến nghị ngược chiều co giãn |
| Validate trước đóng playbook (27) | Back-test go/no-go tạo uy tín stakeholder |
| Ensemble + dual làm mềm cực trị | Biến insight +21% thành band vận hành |
| Nối giá với hủy/buffer | Pricing không đứng riêng — Direct refill có nghĩa |

### 2.2 Điều sẽ làm khác

| Lesson | Cải thiện lần sau |
|--------|-------------------|
| ROI Direct mix ước quá sớm | Đo commission & mix baseline **trước** slide C |
| Legal parity vào muộn trong narrative | Đưa parity vào exec summary từ đầu |
| ML stance classifier bảo thủ / MAPE cao | Coi ML là một vote, không phải nguồn sự thật |
| Tài liệu nhiều nhánh 18/20 song song | Giữ một “source of truth” facet City/Resort sớm hơn |
| Chưa A/B production | Dành sprint riêng shadow instrumentation |

### 2.3 Kỳ vọng vs thực tế

| Kỳ vọng ban đầu | Thực tế |
|------------------|---------|
| Một elasticity “đúng” từ OLS | Phải dùng RM prior + cổng chọn ε̂ |
| Tối ưu p★ là đáp án cuối | p★ là input; band + dual mới đóng được |
| Buffer giải quyết hủy | Buffer chỉ an toàn với tier + safety factor |
| Uplift lớn đồng đều | City hưởng nhiều; Resort Peak **cấm** shock |

---

## 3. Next steps (90 ngày sau presentation)

| Horizon | Việc | Owner | Liên kết |
|---------|------|-------|----------|
| 0–30 ngày | Ký rule sheet · shadow BAR · kick-off Legal | RM / Data / Legal | [`34`](34_implementation_guide.md) Phase 0–1 |
| 30–60 ngày | Pilot City Peak + buffer High | RM / FO | Phase 2 |
| 60–90 ngày | Resort Low CUT **hoặc** hoàn tất Legal → Direct UX | RM / Sales / Digital | Phase 3–4 |
| Song song | Recalibrate panel nếu có data sau 2017-08 | Data | — |
| Backlog | API RMS · A/B framework · migrate scores v2.2 | Data / IT | [`26`](26_overbooking_buffer_strategy.md) |

---

## 4. Monitoring plan

### 4.1 Nhịp

| Nhịp | Nội dung | Audience |
|------|----------|----------|
| **Daily (Peak pilot)** | BAR in-band · buffer count · cutoff queue | RM + FO |
| **Weekly** | ΔRevPAR · ΔADR · Δcancel pp · walk % · % Direct RN · OTA share | RM + GM |
| **Monthly** | So với case A/B ROI · segment mix · exception log | Finance + GM |
| **Quarterly** | Review ε prior · playbook v1.x · model drift hủy | Data + RM |

### 4.2 KPI dictionary

| KPI | Định nghĩa vận hành | Cảnh báo |
|-----|---------------------|----------|
| ΔRevPAR % | (RevPAR_pilot − RevPAR_baseline) / baseline · ô hotel×mùa | &lt; 0 hai tuần liên tiếp |
| Δcancel pp | cancel_pilot − cancel_baseline (điểm %) | &gt; +1 |
| Walk rate | walk / check-ins tuần | &gt; 5% |
| BAR in-band % | ngày published ∈ [floor, ceil] / ngày | &lt; 100% |
| % Direct RN | Direct room nights / total RN | giảm vs baseline sau UX |
| Kill events | số lần kích kill switch | &gt; 0 → post-mortem 5 ngày |

### 4.3 Dashboard tối thiểu (cột)

```text
week | hotel | season | revpar_base | revpar_actual | delta_revpar_pct |
cancel_pp_delta | walk_pct | bar_in_band_pct | direct_rn_pct |
buffer_sold | kill_flag | notes
```

Gợi ý nguồn: star-schema CSV (`data/star schema/`) / export tuần từ PMS + file shadow · dashboard HTML local · Power BI (đang thực hiện).

### 4.4 Escalation

```text
Xanh  → tiếp tục phase
Vàng  → RM review 48h (KPI sát ngưỡng)
Đỏ    → kill switch (ngưỡng §Kill trong guide 34)
```

---

## 5. Risk còn mở sau đóng analytics

| Risk | Trạng thái | Monitoring |
|------|------------|------------|
| Parity / Legal | Mở đến khi memo OK | Phase 4 gate |
| Drift model hủy | Mở | Quarterly recal |
| Data mới hơn 2017 | Mở | Recalibrate backlog |
| Automation RMS | Chưa có | IT backlog |
| Causal ε | Chưa có | Không scale rule mới trên OLS dương |

---

## 6. Team thank-you / kiến thức giữ lại

Giữ bộ “source of truth” sau dự án:

| Artifact | File |
|----------|------|
| Exec | [`29`](29_executive_summary.md) |
| Narrative v1 / v2 | [`30`](30_final_business_report.md) · [`33`](33_final_business_report_v2.md) |
| Deck + Q&A | [`31`](31_stakeholder_presentation.md) · [`32`](32_stakeholder_presentation_qa.md) |
| Playbook + Guide | [`28`](28_finalize_dynamic_pricing_playbook.md) · [`34`](34_implementation_guide.md) |
| Validation | [`27`](27_validate_simulation_pricing_playbook.md) |

> *Chúng ta học được rằng dynamic pricing chỉ “đúng” khi tách property, làm mềm cực trị model, và gắn giá với hủy + kênh Direct — rồi mới nói đến ROI.*

---

## 7. Retro meeting agenda (60')

1. Timeline & deliverables (10')  
2. What went well / change (15')  
3. KPI monitoring ownership (10')  
4. Next 90 days commit (15')  
5. Parking lot / backlog vote (10')
