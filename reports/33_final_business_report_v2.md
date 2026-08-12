# 33 — Final Business Report v2.0

> **Loại:** Business report sau stakeholder presentation · **v2.0**  
> **Thay thế định hướng:** [`30`](30_final_business_report.md) (v1.0) vẫn giữ làm bản narrative gốc  
> **Nguồn feedback:** Log giả định từ phiên trình bày ([`31`](31_stakeholder_presentation.md)–[`32`](32_stakeholder_presentation_qa.md)) + rủi ro đã nêu ở [`28`](28_finalize_dynamic_pricing_playbook.md)  
> **Cập nhật:** 24/07/2026

---

## Change log v1.0 → v2.0

| # | Feedback stakeholder | Thay đổi trong v2.0 |
|---|----------------------|---------------------|
| F1 | “Đừng lấy €59k làm target budget” | Neo **Conservative (~€10k) = floor P&L**; B = base quản trị; C = upside có điều kiện |
| F2 | “Best-rate Direct đụng OTA” | **Legal parity = hard gate** trước phase Direct UX; pilot giá có thể chạy không public best-rate |
| F3 | “+21% nghe nguy hiểm” | Policy: **cấm** publish RAISE ngoài band; dual α ≤ 0,7 là mặc định Peak+High |
| F4 | “FO lo walk” | Thêm SLA walk tuần + kill switch 5%; Peak buffer mode v2.1 bắt buộc |
| F5 | “16 tuần quá nhiều moving parts” | **Stage-gate:** không sang phase sau nếu exit criteria fail; cho phép trượt Direct nếu Legal chậm |
| F6 | “ε / model chưa causal” | Mục hạn chế nổi bật hơn; yêu cầu shadow ≥ 2 tuần trước pilot giá |
| F7 | “Ai quyết định tắt?” | RM lead = kill-switch owner; không cần họp lại khi vượt ngưỡng đã duyệt |

---

## 1. Executive stance (v2.0)

Chúng tôi đề xuất **dynamic pricing bất đối xứng** và **booking flow theo tier hủy**, triển khai qua pilot có cửa chết.

**Không đề xuất:** tăng giá Resort Peak thuần; chốt City +21% lên OTA; overbook bằng điểm số thô; coi ROI case C là cam kết tài chính.

---

## 2. Quyết định đã chốt (proposal đóng gói)

| ID | Quyết định | Trạng thái đề xuất |
|----|------------|--------------------|
| D1 | City Peak harden trong band ±15% | Approve for pilot |
| D2 | Resort Peak: HOLD / cấm +ADR shock | Policy lock |
| D3 | Resort Low CUT ~−5% sau khi City Peak pilot ổn | Approve staged |
| D4 | Buffer chỉ High-tier; refill Direct ưu tiên | Approve with FO SLA |
| D5 | Best-rate public sau Legal OK | Gated |
| D6 | ROI nội bộ: A floor · B base · C upside | Approve reporting standard |

Chi tiết rule: giữ nguyên [`28`](28_finalize_dynamic_pricing_playbook.md); v2.0 chỉ **thắt governance**.

---

## 3. Narrative rút gọn (data → decision)

1. **Đo** demand/ADR/RevPAR và P(hủy) tách City/Resort.  
2. **Thấy** City Peak chịu RAISE; Resort Peak không chịu shock; Resort Low hưởng CUT nhẹ.  
3. **Làm mềm** cực trị bằng ensemble + dual-objective.  
4. **Nối** hủy High → buffer → Direct.  
5. **Pilot** có shadow, KPI, kill switch — không big-bang.

---

## 4. Impact (chuẩn báo cáo v2.0)

| Case | Uplift năm hóa | Cách dùng nội bộ |
|------|---------------:|------------------|
| A Conservative | ~€10k | **Floor** cho kỳ vọng tài chính năm pilot |
| B Full p★ + band | ~€59k | **Base** theo dõi RM (không gắn bonus trừ khi đo được) |
| C + Direct mix | ~€70–85k | **Upside** sau Legal + UX |

Base portfolio proxy ~€2,84M. Mọi số là counterfactual/proxy — ghi chú bắt buộc trên slide Finance.

---

## 5. Operating model sau duyệt

```text
Hàng tuần (pilot):
  Data  → KPI pack (ΔRevPAR, Δcancel, walk, % BAR in-band, % Direct)
  RM    → Giữ / hạ band / HOLD
  FO    → Walk & buffer count
  Digital/Legal → Trạng thái parity (nếu phase Direct)

Kill switch (RM lead, tức thì):
  Δcancel > +1 pp / 2 tuần  → HOLD ô
  Walk > 5% / tuần          → Siết buffer / v2.1
  Resort Peak đỏ sau +ADR   → Rollback + policy reminder
  Parity complaint          → Tắt best-rate public
```

---

## 6. Hạn chế (nổi bật theo F6)

- Chưa RCT / A/B production.  
- ε primary = RM prior (OLS lịch sử bias dương).  
- Risk hủy trong dual = proxy mô tả.  
- ROI Direct mix phụ thuộc commission thực tế và parity.  
- Panel kết thúc 2017-08 — cần recalibrate khi có data mới hơn.

**Yêu cầu bắt buộc trước khi scale:** shadow ≥ 2 tuần + pilot City Peak đạt exit criteria.

---

## 7. Phụ lục — Feedback log (mẫu đã điền giả định)

| Stakeholder | Câu hỏi / ý kiến | Phản hồi tại chỗ | Action v2.0 |
|-------------|------------------|------------------|-------------|
| Finance | Không budget €59k | Neo A làm floor | F1 |
| Legal/Sales | Parity OTA | Gate Direct | F2 |
| GM | Sợ tăng giá mạnh | Band + cấm +21% live | F3 |
| FO | Walk | SLA + kill 5% | F4 |
| Ops | Timeline | Stage-gate | F5 |
| Data skeptics | Causal? | Shadow bắt buộc | F6 |

*Khi có biên bản họp thật: thay bảng này bằng log thực, giữ change log phía trên.*

---

## 8. Tài liệu đi kèm

- Exec: [`29`](29_executive_summary.md)  
- Deck / Q&A: [`31`](31_stakeholder_presentation.md) · [`32`](32_stakeholder_presentation_qa.md)  
- Implementation: [`34`](34_implementation_guide.md)  
- Retrospective: [`35`](35_project_retrospective.md)
