# 30 — Final Business Report: từ dữ liệu đến quyết định

> **Loại:** Business narrative (storytelling) · Phase 2 đóng gói  
> **Đối tượng:** GM · Revenue · Sales · FO · Digital · Finance  
> **Nguồn chứng cứ:** notebooks/reports 11 → 28  
> **Cập nhật:** 24/07/2026 · Bản v1.0 (trước presentation)  
> **Bản sau feedback:** [`33`](33_final_business_report_v2.md)

---

## Mở đầu — bài toán

Hai property cùng portfolio nhưng **không cùng nhịp cầu**. City cứng giá ở Peak; Resort rơi sâu từ mùa thấp và phản ứng mạnh khi tăng ADR. Song song, ~**28%** booking hủy — phần lớn tập trung Online TA / High-tier — vừa là rủi ro occupancy vừa là cơ hội bán lại nếu có giá và kênh đúng.

Câu hỏi của ban lãnh đạo không còn là “có nên dynamic pricing không?” mà là: **làm thế nào để tăng RevPAR mà không đẩy hủy, walk, và xung đột OTA?**

Báo cáo này kể hành trình từ dữ liệu → mô hình → rule vận hành → ROI và lộ trình.

---

## Chương 1 — Chúng ta đo gì?

Nguồn: `hotel_bookings_v5.csv` (~82,8k booking). Panel tháng 2015-07 → 2017-08, tách **City Hotel** và **Resort Hotel**.

Ba lớp tín hiệu:

| Lớp | Câu hỏi | Deliverable chính |
|-----|---------|-------------------|
| Demand / ADR / RevPAR | Tháng tới pressure thế nào? | Forecast 20–21 · stance PROTECT / NEUTRAL / STIMULATE |
| Co giãn giá (ε) | Tăng giá mất bao nhiêu volume? | Prior City −0,70 · Resort −1,10 ([`22`](22_dynamic_pricing_elasticity_city_resort.md)) |
| Hủy (P) | Booking nào nên frictionless / buffer? | LightGBM v2 · Low/Med/High ([`11`](11_cancellation_probability_scores.md), [`26`](26_overbooking_buffer_strategy.md)) |

RevPAR vận hành dùng proxy nhất quán **ADR × Occupancy** để so sánh baseline vs mô phỏng giá.

---

## Chương 2 — Phát hiện bất đối xứng

### City: giá có thể harden

Simulation local-linear với ε prior khóa hành động **RAISE** và ΔRevPAR **+3,21%**. What-if Peak +10% ADR vẫn **+2,3%** RevPAR. Back-test Peak win-rate **100%**.

Đọc business: khách City Peak **ít nhảy** khi giá lên trong biên độ kiểm soát → Peak là cửa sổ bảo vệ biên lợi nhuận.

### Resort: tăng giá Peak là bẫy

Cùng shock +10% ADR Peak → RevPAR **−2,1%** (volume rơi nhanh hơn phần giá thu được). Ngược lại, Low CUT **−5%** cho **+0,23%** revenue và giảm proxy cancel (~0,74 pp trên back-test).

Đọc business: Resort Peak cần **giữ mix / Direct / Groups**, không “test giá lên”. Kích cầu để mùa thấp — bắt đầu Offline (ε_ops ≈ −2,24) trước khi đụng Online.

### Ensemble làm mềm cực trị

Tối ưu thuần ([`23`](23_dynamic_pricing_optimization_city_resort.md)) đề xuất City +21% — đẹp trên giấy, rủi ro hủy/walk trên sàn. Ensemble ([`24`](24_dynamic_pricing_ml_city_resort.md)) chốt **band floor · recommend · ceil (±15%)**; dual-objective ([`27`](27_validate_simulation_pricing_playbook.md)) hạ thêm ~7–8% so với p★ thuần revenue.

**Câu chuyện ngắn:** *Data bảo “có thể tăng”; vận hành bảo “đừng tăng hết”. Playbook chọn vùng giao.*

---

## Chương 3 — Từ giá đến booking journey

Giá đúng vẫn thất bại nếu kênh và friction sai.

```text
Booking → P(hủy) → Tier
  Low  → checkout nhanh, không cọc, BAR playbook
  Med  → giữ BAR, CRM confirm T-14/T-7
  High → buffer pool → cutoff → bán lại Direct @ BAR
       → T-1 đối soát → Walk Protocol nếu thiếu phòng
```

Ý nghĩa chiến lược: **Direct không chỉ là marketing** — là đường thoát inventory từ hủy High-tier với đầy đủ ADR và ít commission hơn OTA dump.

Chi tiết rule: [`28`](28_finalize_dynamic_pricing_playbook.md) mục 1–2.

---

## Chương 4 — Quyết định đề xuất

| Quyết định | Vì sao data ủng hộ | Trade-off |
|------------|--------------------|-----------|
| City Peak RAISE trong band | +2,3% RevPAR @ +10%; go=True | Cancel có thể ↑ nhẹ — dual α↓, cạnh dưới band |
| Resort Peak **không** +ADR shock | −2,1% RevPAR đã đo | Bỏ “dễ thu” ảo; giữ occupancy/mix |
| Resort Low CUT −5% | +0,23% + cancel ↓ | Margin/đêm thấp hơn — bù bằng volume & Direct |
| Buffer chỉ High-tier | Hủy thật ~64% | Precision v2 ~0,49 → safety factor 0,6; Peak dùng v2.1 |
| Best-rate Direct | Shift mix + commission | Cần Legal parity trước go-live |

---

## Chương 5 — Tác động kỳ vọng

Base portfolio năm hóa ~**€2,84M** (proxy panel).

| Case | Uplift | Vai trò trong storytelling |
|------|-------:|----------------------------|
| Conservative | ~€10k | “Đã chứng minh bằng back-test rule hẹp” |
| Full p★ + band | ~€59k | “Nếu áp playbook đầy đủ trong guardrail” |
| + Direct mix | ~€70–85k | “Khi booking flow và kênh cùng chạy” |

Finance nên neo **Conservative làm floor**, Full p★ làm **base case quản trị**, Direct mix là **upside có điều kiện**.

---

## Chương 6 — Lộ trình và kiểm soát

16 tuần: Foundation → Shadow → Pilot City Peak → Resort Low → Direct UX → Scale ([`28`](28_finalize_dynamic_pricing_playbook.md) mục 4 · [`34`](34_implementation_guide.md)).

Kill switches: Δcancel &gt; +1 pp / 2 tuần; walk &gt; 5%; Resort Peak đỏ sau +ADR → rollback.

---

## Kết — một câu cho phòng họp

> **Harden City Peak, đừng đụng giá Resort Peak, kích Resort Low, bán lại hủy High qua Direct — tất cả trong band BAR đã validate.**

Đó là đường từ dữ liệu đến quyết định.

---

## Phụ lục — bản đồ chứng cứ

| Claim | Báo cáo / artifact |
|-------|--------------------|
| ε prior & segment | [`22`](22_dynamic_pricing_elasticity_city_resort.md), `elasticity_by_segment.csv` |
| p★ / ensemble | [`23`](23_dynamic_pricing_optimization_city_resort.md), [`24`](24_dynamic_pricing_ml_city_resort.md) |
| Validate + go/no-go | [`27`](27_validate_simulation_pricing_playbook.md) |
| Buffer × tier | [`26`](26_overbooking_buffer_strategy.md) |
| Playbook đóng gói | [`28`](28_finalize_dynamic_pricing_playbook.md) |
| Exec summary | [`29`](29_executive_summary.md) |
