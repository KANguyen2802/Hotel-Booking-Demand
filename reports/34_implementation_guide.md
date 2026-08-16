# 34 — Implementation Guide

> **Loại:** Hướng dẫn từng bước áp dụng recommendations  
> **Đối tượng:** RM · Data · FO · CRM/Digital · Legal · Sales  
> **Nguồn quyết định:** [`28`](28_finalize_dynamic_pricing_playbook.md) · [`33`](33_final_business_report_v2.md)  
> **Cập nhật:** 16/08/2026

---

## 0. Trước khi bắt đầu (Definition of Ready)

| # | Điều kiện | Done? |
|---|-----------|:-----:|
| 1 | Stakeholder đã duyệt playbook + pilot ([`29`](29_executive_summary.md) mục 5) | ☐ |
| 2 | RM lead chỉ định là kill-switch owner | ☐ |
| 3 | Có quyền đọc scores v2 + export BAR ensemble | ☐ |
| 4 | Lịch mùa Peak/Shoulder/Low thống nhất Jul–Aug / … | ☐ |
| 5 | Legal được brief về parity (có thể song song phase 0–1) | ☐ |

**Không sẵn sàng thì không sang Phase 1.**

---

## 0.5 Bản cho người duyệt (1 trang)

Pilot 16 tuần là chuỗi **cổng go/no-go**, không phải lịch việc tuần tự bắt buộc. Mỗi phase trả lời một câu hỏi; fail cổng → HOLD, không sang phase sau. Thao tác chi tiết nằm ở các Phase 0–5 bên dưới.

| Phase | Tuần | Quyết định | Làm | Không làm | Cổng sang phase sau |
|-------|------|------------|-----|-----------|---------------------|
| **0 · Foundation** | 1–2 | Tách playbook City / Resort? | Ký rule sheet; workshop FO/Sales | Đổi giá OTA | Chữ ký GM + RM |
| **1 · Shadow** | 3–4 | Dải BAR có đáng tin? | BAR chạy song song nội bộ | Đẩy rate plan OTA | ≥10 ngày làm việc; ≥90% quan sát giải thích được |
| **2 · City Peak** | 5–8 | Harden City Peak? | Nâng BAR trong band; bật buffer High-tier; refill Direct | Shock Resort Peak; overbook Low/Medium | ΔRevPAR ≥ 0 · Δcancel ≤ +1 pp · walk < 5% |
| **3 · Resort Low** | 9–12 | CUT ~−5% mùa thấp? | Promo Offline trước Online | +ADR Resort Peak | Rev không giảm; zero sự cố Peak |
| **4 · Direct UX** | 13–14 | Public best-rate? | Giảm ma sát Low-tier; Legal parity | Best-rate nếu Legal chưa OK (**được trượt**) | Legal memo OK — hoặc giữ refill Direct im lặng |
| **5 · Scale** | 15–16 | Mở Shoulder? | Playbook v1.1; dashboard tuần | Scale khi kill switch từng kích | Post-mortem; scale hoặc HOLD |

**Kill switch (RM lead bấm trong 24h).** Δcancel > +1 pp / 2 tuần → HOLD ô. Walk > 5%/tuần → siết buffer. Resort Peak đỏ sau +ADR → rollback. Khiếu nại parity → tắt best-rate public.

Memo C-level: [`29`](29_executive_summary.md). Playbook: [`28`](28_finalize_dynamic_pricing_playbook.md).

---

## Phase 0 — Foundation (Tuần 1–2)

### Bước 0.1 — Rule sheet một trang

Sao chép ma trận Hotel × Mùa từ [`28`](28_finalize_dynamic_pricing_playbook.md) §1.1 vào file nội bộ `pricing_rule_sheet_v1.xlsx` (hoặc wiki).

Cột tối thiểu: `hotel | season | stance | bar_action | forbidden | owner | effective_from`.

**Cấm ghi rõ:** `Resort × Peak → no +ADR shock`.

### Bước 0.2 — Map segment

Gắn `market_segment` PMS/RMS với rule §1.2 (Groups harden; Resort Offline ưu tiên promo Low).

### Bước 0.3 — Đồng bộ team

Họp 45': RM + FO + CRM + Data. Phân owner theo bảng dưới.

| Workstream | Owner | Backup |
|------------|-------|--------|
| BAR calendar | RM | Data |
| Tier / buffer | FO + RM | Data |
| CRM confirm | CRM | FO |
| Direct / parity | Digital + Legal | Sales |
| KPI tuần | Data | RM |

**Exit Phase 0:** Rule sheet có chữ ký RM + GM (hoặc email approve).

---

## Phase 1 — Shadow BAR (Tuần 3–4)

### Bước 1.1 — Tạo `bar_recommend` hàng ngày/tháng

Nguồn ưu tiên: `reports/figures/24_ml_pricing/ensemble_rate_recommend.csv` (horizon) + quy tắc mùa §1.1 cho tháng hiện tại.

Công thức vận hành:

```text
bar_floor = 0.85 × bar_recommend
bar_ceil  = 1.15 × bar_recommend
published_rate ∈ [bar_floor, bar_ceil]   # chưa đổi OTA ở phase này
```

### Bước 1.2 — So sánh shadow vs actual

Mỗi ngày (hoặc 2 lần/tuần): log `actual_ADR`, `bar_recommend`, `delta_pct`, `in_band (Y/N)`.

### Bước 1.3 — Không đẩy kênh

Shadow = báo cáo nội bộ. **Không** đổi rate plan OTA.

**Exit Phase 1:** ≥10 ngày làm việc; ≥90% quan sát giải thích được; không alert ảo kéo dài &gt;3 ngày liên tiếp mà không có ghi chú RM.

---

## Phase 2 — Pilot City Peak (Tuần 5–8)

*Chỉ chạy khi đang / sắp Peak City hoặc ô Peak gần nhất trên lịch.*

### Bước 2.1 — Harden BAR

Đưa published City Peak lên hướng recommend–ceil **bên trong band**, dual α ≤ 0,7 nếu tỷ trọng High-tier OTA cao.

### Bước 2.2 — Bật buffer High-tier

1. Lấy P từ scores v2 @ 0,35.  
2. High (P ≥ 0,55) → pool.  
3. Peak: re-score / chốt ứng viên theo **v2.1 @ 0,28**.  
4. Buffer % = hủy thật ô × 0,6 (cap 20%; Groups 15%) — xem [`26`](26_overbooking_buffer_strategy.md).  
5. Cutoff T-3 (OTA lead dài: T-14) + cọc 1 đêm.  
6. Slot giải phóng → **mở Direct trước** @ `bar_recommend`.

### Bước 2.3 — Đo hàng tuần

| KPI | Ngưỡng giữ pilot |
|-----|------------------|
| ΔRevPAR vs baseline cùng kỳ | ≥ 0 |
| Δcancel (pp) | ≤ +1 |
| Walk rate | &lt; 5% |
| % ngày BAR in-band | 100% |

**Exit Phase 2:** Đạt ngưỡng ≥ 3 tuần liên tiếp **hoặc** kích kill switch → HOLD và post-mortem trước khi mở Phase 3.

---

## Phase 3 — Resort Low CUT (Tuần 9–12)

### Bước 3.1 — Điều kiện vào cổng

Phase 2 pass **hoặc** GM exception bằng văn bản. **Không** dùng phase này để test +ADR Resort Peak.

### Bước 3.2 — Áp CUT ~−5%

Trong Low (Nov–Mar) hoặc từ Oct theo ensemble: hạ về cạnh dưới/recommend, không phá `bar_floor`.

Thứ tự promo: **Offline TA/TO → Direct → Online TA** (ε Offline rất mạnh).

### Bước 3.3 — Cap hủy

Theo dõi cancel Offline sau promo; nếu Δcancel &gt; +1 pp → thu hẹp promo / nâng floor.

**Exit Phase 3:** Rev proxy ↑ hoặc ổn định; cancel không xấu hơn ngưỡng; zero sự cố “lỡ +ADR Peak”.

---

## Phase 4 — Direct UX (Tuần 13–14) — *gated*

### Bước 4.1 — Legal parity checklist

| Check | OK? |
|-------|:---:|
| So sánh giá Direct vs OTA cùng hạng/ngày (sau thuế phí) trong policy đã duyệt | ☐ |
| Điều khoản rate parity / marketing “best rate” đã review | ☐ |
| Quy trình xử lý complaint OTA | ☐ |

**Nếu bất kỳ ☐ trống → trượt phase, không public best-rate.** Có thể vẫn giữ refill Direct im lặng từ buffer.

### Bước 4.2 — Frictionless Low-tier

- Low-tier: bỏ cọc nếu policy cho phép.  
- Prefill + mobile checkout.  
- Medium: 1-tap confirm (SMS/email) không redirect OTA.

### Bước 4.3 — Đo mix

Baseline `% Direct room nights` trước phase; target hướng tăng (không hard-code % trong guide — do RM/Sales đặt).

---

## Phase 5 — Scale & governance (Tuần 15–16)

1. Xem xét mở Shoulder theo cùng checklist go-live ([`28`](28_finalize_dynamic_pricing_playbook.md) §4.1).  
2. Xuất **Playbook v1.1** (sửa số ε/ROI nếu pilot lệch).  
3. Gắn dashboard tuần (RevPAR, cancel, walk, in-band, Direct).  
4. Chạy retrospective ([`35`](35_project_retrospective.md)).

---

## Kill switches — cách bấm

| Tín hiệu | Hành động trong 24h | Ai bấm |
|----------|---------------------|--------|
| Δcancel ô &gt; +1 pp / 2 tuần | HOLD giá ô về baseline | RM lead |
| Walk &gt; 5% / tuần | Giảm buffer 50% hoặc tắt pool; bật v2.1 | RM + FO |
| Resort Peak RevPAR đỏ sau +ADR | Rollback ngay + nhắc policy lock | RM lead |
| Parity complaint | Tắt badge/best-rate public | Digital + Legal |

---

## Checklist vận hành ngày Peak

```text
☐ BAR trong [floor, ceil]
☐ Không có rate Resort Peak > ceil do “thử”
☐ High-tier đã score; Peak dùng v2.1 nếu inventory nóng
☐ Buffer count ≤ cap
☐ Cutoff queue CRM đã gửi
☐ Direct refill list sẵn sàng
☐ T-1 tomorrow đã lên lịch đối soát
```

---

## Troubleshooting nhanh

| Triệu chứng | Kiểm tra trước | Xử lý |
|-------------|----------------|-------|
| RevPAR ↓ sau RAISE City | Band có vượt ceil? High OTA share? | Hạ về recommend; tăng α risk |
| Promo Resort không tăng demand | Đúng Low? Đúng Offline trước? | Mở rộng kênh có kiểm soát; không đụng Peak |
| Walk tăng | Buffer % · Precision · cutoff | Siết pool; safety factor |
| Shadow lệch actual lớn | Forecast ADR / calendar event | Ghi chú sự kiện; không auto-push |

---

## Đầu ra bắt buộc mỗi phase

| Phase | Artifact |
|-------|----------|
| 0 | Rule sheet signed |
| 1 | Shadow log CSV + note |
| 2 | Weekly KPI City Peak |
| 3 | Weekly KPI Resort Low |
| 4 | Legal memo + Direct funnel metrics |
| 5 | Playbook v1.1 + retro [`35`](35_project_retrospective.md) |
