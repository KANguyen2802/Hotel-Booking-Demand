# Hướng dẫn đọc hiểu chỉ số thống kê

> **Phạm vi:** `hypothesis.ipynb` (kiểm định giả thuyết) và `Cancellation_Prediction_Model_v1.ipynb` (dự báo hủy phòng)  
> **Biến mục tiêu:** `is_canceled` (0 = không hủy, 1 = hủy)  
> **Dữ liệu tham chiếu:** `hotel_bookings_v5.csv` (~82.811 booking, tỷ lệ hủy ~28,12%)

---

## Phân biệt hai notebook

| | `hypothesis.ipynb` | `Cancellation_Prediction_Model_v1.ipynb` |
|---|---|---|
| **Mục đích** | Trả lời *"Biến X có liên quan đến hủy không?"* | Trả lời *"Booking này có khả năng hủy bao nhiêu %?"* |
| **Loại phân tích** | Kiểm định giả thuyết (inferential) | Học máy / dự báo (predictive) |
| **Đầu ra chính** | p-value, effect size, OR, kết luận H₀ | Accuracy, F1, ROC-AUC, confusion matrix |
| **Câu hỏi kinh doanh** | Lead time có ảnh hưởng hủy không? | Booking #12345 có 72% khả năng hủy — có nên overbooking không? |

> **Lưu ý:** `Cancellation_Prediction_Model_v1.ipynb` hiện là notebook trống (theo thiết kế dự án sẽ dùng Logistic Regression / Random Forest). Phần **II** mô tả các chỉ số **dự kiến xuất hiện** khi notebook được triển khai, tham chiếu từ `Correlation Analysis - is_canceled.md`.

---

# PHẦN I — `hypothesis.ipynb` (Kiểm định giả thuyết)

## 1. Khái niệm nền

### 1.1 Giả thuyết H₀ và H₁

| Ký hiệu | Ý nghĩa | Ví dụ (H1 — lead_time) |
|---|---|---|
| **H₀** | Giả thuyết không (không có hiệu ứng / độc lập) | Phân bố lead_time giống nhau giữa booking hủy và không hủy |
| **H₁** | Giả thuyết đối (có hiệu ứng / phụ thuộc) | Hai phân bố lead_time khác nhau |

**Cách đọc kết luận trong notebook:**

- **Bác bỏ H₀** → có bằng chứng thống kê (với α = 0,05) cho thấy biến **có liên quan** đến hủy.
- **Không bác bỏ H₀** → không đủ bằng chứng để kết luận có liên quan (không đồng nghĩa "chắc chắn không liên quan").

### 1.2 p-value (mức ý nghĩa)

| p-value | Diễn giải |
|---|---|
| **p < 0,05** | Kết quả **khó xảy ra ngẫu nhiên** nếu H₀ đúng → thường coi là **có ý nghĩa thống kê** |
| **p ≈ 0** (rất nhỏ) | Với n ≈ 82.811, p gần 0 là **bình thường** — không có nghĩa "quan hệ vô hạn" |
| **p ≥ 0,05** | Không đủ bằng chứng để bác bỏ H₀ |

**Cảnh báo quan trọng:** p-value chỉ nói *có hay không có association*, **không** nói association *mạnh hay yếu*. Luôn đọc kèm **effect size**.

### 1.3 α (alpha) = 0,05

Ngưỡng chấp nhận sai lầm loại I (bác bỏ H₀ oan). Notebook dùng **α = 0,05** (chuẩn 5%).

---

## 2. H1 — Mann-Whitney U (`lead_time`)

**Khi nào dùng:** So sánh biến **số liên tục** (lead_time) giữa **2 nhóm** nhị phân (hủy / không hủy). Không cần giả định phân phối chuẩn.

| Chỉ số | Ý nghĩa | Cách đọc (ví dụ từ data) |
|---|---|---|
| **U** | Thống kê Mann-Whitney | Giá trị lớn; dùng để tính p-value, ít khi diễn giải trực tiếp |
| **p-value** | Xác suất H₀ đúng | p ≈ 0 → bác bỏ H₀ |
| **rank-biserial r** | Effect size (−1 đến +1) | r = **0,299** → mức **trung bình**; dương = nhóm hủy có lead_time cao hơn |
| **Median / Mean** | Mô tả 2 nhóm | Không hủy: median **37** ngày; Hủy: median **79** ngày |
| **Bootstrap 95% CI** | Khoảng tin cậy chênh median | CI dương, không chứa 0 → chênh median có ý nghĩa thực tế |

**Quy ước \|r\| (rank-biserial):**

| \|r\| | Mức |
|---:|---|
| ~0,1 | Nhỏ |
| ~0,3 | Trung bình |
| ~0,5+ | Lớn |

**t-test (tham khảo trong notebook):** So sánh **mean** lead_time; kém robust hơn vì phân bố lệch. Mann-Whitney là test chính.

---

## 3. H1b, H2, H3 — Chi-squared (biến phân loại)

**Khi nào dùng:** Kiểm tra **độc lập** giữa biến phân loại (lead_time_bin, deposit_type, market_segment) và `is_canceled`.

| Chỉ số | Ý nghĩa | Cách đọc |
|---|---|---|
| **χ² (chi2)** | Độ lệch tổng giữa observed và expected | Càng lớn → càng lệch khỏi độc lập |
| **df** | Bậc tự do | (số hàng − 1) × (số cột − 1) |
| **p-value** | Ý nghĩa tổng thể | p < 0,05 → bác bỏ H₀ |
| **Cramér's V** | Effect size (0 đến 1) | V = 0 → không association; V = 1 → association hoàn hảo |
| **min expected** | Ô kỳ vọng nhỏ nhất | **< 5** → cảnh báo; kết quả chi-square kém tin cậy ở ô đó |
| **cells expected < 5** | Số ô có E < 5 | Càng nhiều → càng cần thận trọng |

**Quy ước Cramér's V (bảng 2 cột như is_canceled):**

| V | Mức |
|---:|---|
| 0,10 | Yếu |
| 0,20 | Trung bình |
| 0,30+ | Khá mạnh |

**Ví dụ từ notebook:**

| Biến | Cramér's V | Diễn giải |
|---|---:|---|
| market_segment | 0,219 | Mạnh nhất trong nhóm phân loại |
| lead_time_bin | 0,213 | Khá mạnh |
| deposit_type | 0,161 | Trung bình |

### 3.1 Standardized residual (heatmap)

Công thức: `(Observed − Expected) / √Expected`

| \|residual\| | Ý nghĩa |
|---:|---|
| **< 2** | Ô đóng góp bình thường vào χ² |
| **> 2** | Ô đóng góp **bất thường** — nhóm đó hủy nhiều/ít hơn kỳ vọng |

**Ví dụ:** Online TA có residual dương lớn → hủy nhiều hơn expected; Corporate residual âm → hủy ít hơn expected.

### 3.2 Observed vs Expected (biểu đồ cột + dấu ×)

- **Cột màu** = số booking quan sát thực tế.
- **Dấu ×** = số booking kỳ vọng nếu H₀ đúng (hai biến độc lập).
- Khoảng cách lớn giữa cột và × → ô đó kéo χ² lên.

---

## 4. H2 — Post-hoc Z-test & Fisher's exact

Sau khi chi-square tổng thể bác bỏ H₀, so sánh **từng cặp** loại cọc.

| Chỉ số | Ý nghĩa | Cách đọc |
|---|---|---|
| **z_stat** | Thống kê z so 2 tỷ lệ hủy | \|z\| lớn → chênh tỷ lệ lớn |
| **p_value** | Ý nghĩa cặp đơn | p < 0,05 → 2 nhóm khác tỷ lệ hủy |
| **p_bonferroni** | p sau điều chỉnh đa so sánh | **Dùng cột này** để kết luận (tránh false positive) |
| **fisher_p** | Fisher's exact (ô nhỏ) | Thay chi-square khi sample nhỏ (vd. Refundable n=81) |
| **odds_ratio** | Tỷ số odds giữa 2 nhóm | OR > 1 → nhóm A odds hủy cao hơn B |

**Cách đọc bar chart post-hoc:** Thanh **đỏ** = Bonferroni p < 0,05; **xám** = không đủ ý nghĩa sau điều chỉnh.

---

## 5. H4 — Logistic Regression (mô hình đa biến)

**Mục đích:** Kiểm tra **đồng thời** nhiều biến; mỗi hệ số = hiệu ứng **khi đã kiểm soát** biến còn lại.

### 5.1 Bảng statsmodels (Logit Results)

| Cột | Ý nghĩa | Cách đọc |
|---|---|---|
| **coef** | Hệ số β (log-odds) | β > 0 → tăng log-odds hủy khi biến tăng |
| **std err** | Sai số chuẩn của β | Càng nhỏ → ước lượng càng chính xác |
| **z** | z = coef / std err | \|z\| lớn → hệ số khác 0 rõ |
| **P>\|z\|** | p-value hệ số | **< 0,05** → biến có ý nghĩa trong mô hình |
| **[0.025, 0.975]** | Khoảng tin cậy 95% của β | Không chứa 0 → ý nghĩa thống kê |

### 5.2 Odds Ratio (OR)

`OR = exp(coef)`

| OR | Diễn giải |
|---|---|
| **OR = 1** | Không đổi odds hủy |
| **OR > 1** | Tăng odds hủy |
| **OR < 1** | Giảm odds hủy |

**Ví dụ lead_time:**

- OR (+1 ngày) = **1,005** → mỗi thêm 1 ngày, odds hủy tăng ~0,5%.
- OR (+30 ngày) = **1,158** → mỗi thêm 30 ngày, odds hủy tăng ~15,8%.

**Baseline (mặc định):** `deposit_type = No Deposit`, `market_segment = Direct`. Các dummy khác so với baseline này.

### 5.3 Chỉ số mô hình tổng thể

| Chỉ số | Ý nghĩa | Cách đọc (ví dụ) |
|---|---|---|
| **Pseudo R² (McFadden)** | Độ giải thích tương đối | **0,094** → mô hình giải thích ~9,4% log-likelihood; **thấp–TB** là bình thường với hành vi khách |
| **Log-Likelihood** | Độ khớp mô hình | Càng cao (ít âm) càng tốt |
| **LL-Null** | Log-likelihood mô hình chỉ intercept | So sánh với LL đầy đủ |
| **LLR p-value** | p của Likelihood Ratio Test | p ≈ 0 → mô hình đầy đủ **tốt hơn** mô hình null |
| **LR χ²** | 2 × (LL − LL_null) | **9228,9**, df = 10 → mô hình có giá trị tổng thể |
| **converged** | Hội tụ tối ưu | Phải **True** mới tin kết quả |

### 5.4 Forest plot & đường dự đoán

- **Forest plot:** OR + 95% CI; chấm **đỏ** = p < 0,05; đường đứt OR = 1.
- **Đường dự đoán:** Xác suất hủy (%) theo lead_time khi giữ deposit_type và segment ở baseline → minh họa **hiệu ứng biên** của lead_time.

---

## 6. Dashboard tổng hợp (`hypothesis.ipynb`)

| Biểu đồ | Trục / nội dung | Cách đọc |
|---|---|---|
| **Effect size** | \|r\|, Cramér's V, Pseudo R² | So **tương đối** mức ảnh hưởng (không so trực tiếp đơn vị khác nhau) |
| **−log10(p)** | Biến đổi p-value | Càng cao → càng ý nghĩa; đường đứt = ngưỡng α = 0,05 |
| **Text box tổng hợp** | Tất cả test H1–H4 | Tra cứu nhanh U, χ², V, LR test |

---

## 7. Checklist đọc `hypothesis.ipynb`

1. Xem **p-value** → có bác bỏ H₀ không?
2. Xem **effect size** (r, V, Pseudo R²) → mạnh hay yếu?
3. Với chi-square → kiểm **min expected** và residual heatmap.
4. Với logistic → đọc **OR + CI**, không chỉ p.
5. Nhớ: association **≠** nhân quả (đặc biệt `deposit_type_Non Refund`).

---

# PHẦN II — `Cancellation_Prediction_Model_v1.ipynb` (Dự báo)

> Notebook hiện **chưa có code**. Phần dưới mô tả các chỉ số **theo thiết kế dự án** (Logistic Regression / Random Forest, feature Tier 1–2, loại leakage) để bạn đọc khi notebook được triển khai.

## 1. Mục tiêu khác với hypothesis

| hypothesis | prediction model |
|---|---|
| "lead_time có liên quan hủy không?" | "Booking này có 73% khả năng hủy" |
| p-value, Cramér's V | Accuracy, F1, ROC-AUC |
| Một vài biến kiểm định | Nhiều feature, train/test split |

---

## 2. Confusion Matrix (ma trận nhầm lẫn)

Dự đoán nhị phân: ngưỡng mặc định thường **0,5** (p(hủy) ≥ 0,5 → dự đoán hủy).

```
                    Thực tế
                 Không hủy    Hủy
Dự đoán  Không hủy   TN        FN
         Hủy         FP        TP
```

| Ô | Tên | Ý nghĩa kinh doanh |
|---|---|---|
| **TP** | True Positive | Dự đoán hủy, **đúng** là hủy |
| **TN** | True Negative | Dự đoán không hủy, **đúng** |
| **FP** | False Positive | Dự đoán hủy, **sai** (khách vẫn đến) → overestimate risk |
| **FN** | False Negative | Dự đoán không hủy, **sai** (khách hủy) → **nguy hiểm** cho overbooking |

**Với tỷ lệ hủy ~28%:** Ma trận **lệch class** — model dự đoán "không hủy" cho tất cả vẫn có accuracy ~72% nhưng **vô dụng**.

---

## 3. Chỉ số phân loại chính

| Chỉ số | Công thức | Cách đọc | Ưu tiên khi |
|---|---|---|---|
| **Accuracy** | (TP+TN) / tổng | % dự đoán đúng | Class cân bằng; **dễ misleading** khi lệch 28/72 |
| **Precision** | TP / (TP+FP) | Trong số dự đoán hủy, bao nhiêu % đúng | Giảm **false alarm** (đừng penalize oan) |
| **Recall** | TP / (TP+FN) | Trong số thực sự hủy, bắt được bao nhiêu % | Giảm **bỏ sót** booking sẽ hủy |
| **F1-score** | 2×P×R / (P+R) | Cân bằng Precision & Recall | Metric tổng hợp chính khi class lệch |
| **Specificity** | TN / (TN+FP) | Bắt đúng booking không hủy | Ít dùng riêng lẻ |

**Gợi ý cho hotel cancellation:**

- Nếu mục tiêu **tránh overbooking** → ưu tiên **Recall** cao (bắt được booking sẽ hủy).
- Nếu mục tiêu **không làm phiền khách chắc chắn đến** → cân bằng Precision.

---

## 4. ROC-AUC và PR-AUC

### 4.1 ROC-AUC

- **ROC curve:** Trục X = False Positive Rate; trục Y = True Positive Rate (Recall) khi thay ngưỡng.
- **AUC** (Area Under Curve): 0,5 = đoán ngẫu nhiên; 1,0 = hoàn hảo.

| AUC | Diễn giải |
|---:|---|
| 0,50 | Không phân biệt được hủy / không hủy |
| 0,70–0,80 | Chấp nhận được |
| 0,80+ | Tốt |
| 0,90+ | Rất tốt (hiếm với dữ liệu hành vi thực) |

### 4.2 PR-AUC (Precision-Recall AUC)

- **Quan trọng hơn ROC** khi class thiểu số (hủy ~28%).
- Baseline PR-AUC ≈ tỷ lệ hủy (~0,28) — model phải **vượt** ngưỡng này mới có giá trị.

---

## 5. Xác suất dự đoán & calibration

| Chỉ số | Ý nghĩa |
|---|---|
| **predict_proba** | Xác suất hủy ∈ [0, 1] cho từng booking |
| **Log Loss** | Phạt dự đoán sai và **quá tự tin**; càng thấp càng tốt |
| **Brier Score** | Sai số bình phương xác suất; 0 = hoàn hảo |
| **Calibration plot** | Dự đoán 30% hủy có thực sự hủy ~30% không? |

**Cách dùng:** Xác suất 0,7 → có thể trigger chính sách cọc / theo dõi; cần calibration tốt mới tin số tuyệt đối.

---

## 6. Train vs Test & overfitting

| Chỉ số | Cách đọc |
|---|---|
| **Train accuracy / F1** | Hiệu năng trên dữ liệu học |
| **Test accuracy / F1** | Hiệu năng **thực tế** trên dữ liệu mới |
| **Gap train − test** | Gap lớn (>5–10 pp F1) → **overfitting** |

**Quy tắc:** Luôn đánh giá trên **test set** hoặc **cross-validation** — không tin metric train.

---

## 7. Feature importance & SHAP

Dự kiến trong notebook (theo `Correlation Analysis - is_canceled.md`):

| Phương pháp | Ý nghĩa | Cách đọc |
|---|---|---|
| **Coefficient (Logistic)** | Hướng ảnh hưởng (+/−) | Giống OR trong hypothesis nhưng với nhiều feature hơn |
| **Feature importance (Random Forest)** | Độ quan trọng tương đối | Cao = biến tách class tốt; **không** cho hướng +/− |
| **SHAP values** | Đóng góp từng feature vào **từng dự đoán** | Giải thích "vì sao booking này 78% hủy" |

**Feature dự kiến (Tier 1–2):**

- P1: `lead_time`, `deposit_type`, `market_segment × distribution_channel`
- P2: `previous_cancellations`, `is_repeated_guest`, `total_of_special_requests`, …

**Tuyệt đối loại (leakage):** `reservation_status`, `revenue`, `Occupancy_Rate`, `RevPAR` — cho metric ảo cao nhưng không dùng được production.

---

## 8. So sánh hai mô hình dự kiến

| | Logistic Regression | Random Forest |
|---|---|---|
| **Ưu điểm** | OR dễ diễn giải; nhanh | Bắt phi tuyến; interaction tự động |
| **Metric chính** | coef, OR, AIC/BIC | Feature importance, OOB score |
| **Nhược điểm** | Giả định log-linear | Khó giải thích; dễ overfit |

**Cách chọn:** So **test F1** và **PR-AUC** trên cùng split; model cao hơn và ổn định hơn thắng.

---

## 9. Checklist đọc `Cancellation_Prediction_Model_v1.ipynb` (khi có code)

1. **Confusion matrix** trên **test** — TN, TP, FP, FN có hợp lý không?
2. **F1 & PR-AUC** — không chỉ accuracy.
3. **Train vs test gap** — có overfit không?
4. **Feature list** — có biến leakage không?
5. **SHAP / importance** — có khớp insight từ `hypothesis.ipynb` (lead_time, segment, deposit)?
6. **Ngưỡng** — 0,5 có phù hợp mục tiêu kinh doanh không?

---

# PHẦN III — Liên kết hai notebook

```
EDA / Correlation
       │
       ├── hypothesis.ipynb          → Biến nào có association? (p, V, OR)
       │         │
       │         └── Xác nhận: lead_time, deposit_type, market_segment
       │
       └── Cancellation_Prediction     → Dự báo xác suất hủy từng booking
                 Model_v1.ipynb              (F1, AUC, confusion matrix)
```

| Phát hiện hypothesis | Kỳ vọng trong model |
|---|---|
| lead_time median hủy cao hơn (r = 0,299) | Feature importance / SHAP lead_time cao |
| market_segment V = 0,219 | Segment (hoặc interaction) quan trọng |
| deposit_type V = 0,161 | deposit_type trong top features |
| Pseudo R² = 0,094 (3 biến) | Model đầy đủ Tier 1–2 có thể đạt F1 / AUC cao hơn |

**Không mâu thuẫn:** hypothesis chứng minh **có quan hệ**; prediction model đo **khả năng dự báo đúng** trên dữ liệu mới — hai mục tiêu bổ sung cho nhau.

---

## Tài liệu liên quan

| File | Nội dung |
|---|---|
| `Hypothesis Testing - is_canceled.md` | Báo cáo kết quả kiểm định |
| `Correlation Analysis - is_canceled.md` | Feature tier & leakage |
| `EDA Stage 1 - Cancellation Analysis.md` | Insight trực quan cancellation |

---

*Cập nhật: 3/7/2026 — hướng dẫn đọc chỉ số (key dedup mới, 82.811 booking; v5 tái tạo từ v4 + day_of_week).*