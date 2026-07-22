# 24 — ML dynamic pricing: City vs Resort

> **Loại:** Báo cáo khoa học kỹ thuật (IMRAD) · recommend-only  
> **Đầu vào:** Panel lịch sử + forecast / pressure `20*` + optimization $p^{\star}$ (`23`)  
> **Models:** `HistGradientBoostingRegressor` · `HistGradientBoostingClassifier` (scikit-learn)  
> **Horizon:** 2017-09 → 2018-02  
> **Notebook:** [`notebooks/24_dynamic_pricing_ml_city_resort.ipynb`](../notebooks/24_dynamic_pricing_ml_city_resort.ipynb)  
> **Figures:** [`reports/figures/24_ml_pricing/`](./figures/24_ml_pricing/)  
> **Đầu ra chính:** [`ensemble_rate_recommend.csv`](./figures/24_ml_pricing/ensemble_rate_recommend.csv)  
> **Cập nhật:** 22/07/2026

---

## Tóm tắt

Báo cáo này xây lớp machine learning cho dynamic pricing theo property: dự báo ADR tháng tới và pricing stance ba lớp, rồi ensemble với ADR forecast cổ điển và $p^{\star}$ tối ưu. Trên panel stay theo tháng, mô hình HistGradientBoosting được huấn luyện với time-series cross-validation. Hiệu năng regressor ngoài fold yếu trên mẫu ngắn (MAPE từng fold từ 0,25 đến 0,88; $R^{2}$ âm), và accuracy của stance không ổn định (0,17–0,83 giữa các fold). Trên horizon 2017-09 → 2018-02, classifier gán mọi tháng là PROTECT, trong khi regressor thường nâng ADR Resort về vùng điều chỉnh mùa vụ. Ensemble lấy median của ADR forecast, ML ADR và $p^{\star}$ tạo recommendation BAR với guardrail ±15% và final action theo majority vote. Ensemble làm mềm cực trị của tối ưu thuần: City xen RAISE và HOLD; Resort HOLD tháng 9 rồi CUT các tháng sau — giữ narrative kích cầu mùa đông mà không áp máy mức RAISE $+21\%$ của City từ notebook 23.

---

## 1. Giới thiệu

Forecast cổ điển (notebooks 20–20b) và tối ưu theo elasticity (notebook 23) minh bạch nhưng mang tính tham số. Câu hỏi bổ sung là liệu supervised learning trên trạng thái tháng lịch sử có đề xuất ADR và stance giúp vận hành vững hơn khi các mô hình bất đồng. Nghiên cứu này vì thế huấn luyện hai đầu — regression ADR và classification stance — rồi hợp nhất đầu ra ML với tín hiệu forecast và optimization thành một band BAR recommend-only.

Mục tiêu khoa học không phải tuyên bố độ chính xác dự báo đỉnh trên khoảng hai mươi sáu tháng dữ liệu; mà là ghi nhận tree ensemble bị ràng buộc đóng góp được gì và không được gì, đồng thời công bố quy tắc ensemble có thể kiểm toán để revenue manager đối chiếu với pickup.

---

## 2. Phương pháp

### 2.1 Feature engineering

Panel feature theo tháng được dựng cho từng hotel gồm chỉ báo lịch (`hotel_code`, `month`), lag của demand, ADR, RevPAR, occupancy và lead time tại $t-1$ và $t-12$, trung bình trượt ba tháng của ADR và demand, cùng tỷ trọng mix đồng thời (Online TA, Groups, Transient), tỷ lệ special request, và mean length of stay. Nhãn stance lịch sử lấy cùng công thức pressure như notebook 20 (ngưỡng ánh xạ combined pressure sang STIMULATE / NEUTRAL / PROTECT). Sau khi loại hàng thiếu lag, còn mười ba tháng huấn luyện mỗi hotel.

### 2.2 Mô hình và validation

Hai mô hình HistGradientBoosting (`max_depth=3`, `learning_rate=0.08`, `max_iter=200–250`, `random_state=42`) được fit: regressor nhắm ADR tháng tới và classifier nhắm lớp stance. Validation dùng ba fold time-series mở rộng trên panel gộp hai hotel. Metric là MAPE và $R^{2}$ cho regression, accuracy cho classification. Fit cuối trên toàn bộ lịch sử rồi áp lên horizon forecast sau khi dựng feature horizon từ lag quan sát cuối cùng cộng ngữ cảnh forecast.

### 2.3 Áp dụng horizon và quy tắc ensemble

Mỗi tháng horizon cho ra ML ADR (có điều chỉnh phần trăm mùa vụ, clip để ổn định) và ML stance. Ensemble BAR là median của $\{P_0^{\mathrm{fc}},\,P^{\mathrm{ML}},\,p^{\star}\}$, với floor $0{,}85\times$ và ceiling $1{,}15\times$ median đó. Final action dùng majority vote (≥2/3) giữa tín hiệu đã map từ ML stance, action tối ưu, và hướng pressure ADR, cho ra RAISE, CUT hoặc HOLD.

---

## 3. Kết quả

### 3.1 Hiệu năng cross-validation

**Bảng 1.** Time-series CV — regressor

| Fold | MAPE | $R^{2}$ |
|---:|---:|---:|
| 1 | 0,248 | −3,08 |
| 2 | 0,885 | −7,12 |
| 3 | 0,357 | −0,10 |

**Bảng 2.** Time-series CV — stance classifier

| Fold | Accuracy |
|---:|---:|
| 1 | 0,833 |
| 2 | 0,333 |
| 3 | 0,167 |

MAPE trung bình các fold khoảng 0,50 và accuracy stance trung bình khoảng 0,44. $R^{2}$ âm cho thấy trên fold giữ lại, regressor kém hơn baseline trung bình tầm thường — kết quả kỳ vọng trên mẫu tháng ngắn có seasonality mạnh. Cửa sổ kiểu holdout trên sáu tháng cuối trong mẫu cho MAPE ≈ 0,27 và accuracy stance tổng thể 0,50, với recall hoàn hảo nhưng precision chỉ trung bình trên lớp PROTECT.

### 3.2 Kế hoạch ML trên horizon so với forecast và tối ưu

Hình 1 so sánh ADR forecast, ML ADR và $p^{\star}$ tối ưu trên horizon 6 tháng. Với City, ML ADR bám $P_0$ ở tháng 9–10 rồi đứng gần €110,4 — cao hơn ADR forecast mùa đông yếu và thấp hơn nhiều mức RAISE mạnh của $p^{\star}$. Với Resort, ML ADR nằm trên đường forecast đã sụp từ tháng 10 trở đi (ví dụ €83,4 so với €70,4 tháng 10), trong khi $p^{\star}$ vẫn là CUT nhẹ dưới $P_0$.

![Hình 1. ML ADR so với ADR forecast và BAR tối ưu](./figures/24_ml_pricing/compare/01_ml_vs_forecast_vs_opt.png)

*Hình 1. So sánh trên horizon: ADR forecast ($P_0$), ML ADR và $p^{\star}$ theo hotel.*

Dù forecast pressure thường báo STIMULATE cho ADR/RevPAR Resort mùa đông, classifier đã fit vẫn phát PROTECT cho cả mười hai hotel-tháng trên horizon. Sự bảo thủ này nhất quán với class imbalance và hỗ trợ huấn luyện STIMULATE nhỏ trên panel có lag; đồng thời cảnh báo không nên lock riêng ML stance.

### 3.3 Band ensemble BAR và final action

Hình 2 thể hiện recommendation ensemble kèm floor và ceiling. Bảng 3 tóm tắt final action sau majority vote.

![Hình 2. Ensemble BAR với band ±15%](./figures/24_ml_pricing/compare/02_ensemble_bar_band.png)

*Hình 2. Ensemble BAR (median của forecast, ML và $p^{\star}$) với floor $0{,}85\times$ và ceiling $1{,}15\times$.*

**Bảng 3.** Final action ensemble (2017-09 → 2018-02)

| Tháng | City final | City BAR rec. (€) | Resort final | Resort BAR rec. (€) |
|---|---|---:|---|---:|
| 2017-09 | RAISE | 133,81 | HOLD | 117,22 |
| 2017-10 | HOLD | 123,07 | CUT | 70,37 |
| 2017-11 | HOLD | 110,38 | CUT | 52,53 |
| 2017-12 | RAISE | 110,38 | CUT | 71,41 |
| 2018-01 | RAISE | 110,38 | CUT | 52,09 |
| 2018-02 | RAISE | 110,38 | CUT | 57,75 |

So với City RAISE / Resort CUT đồng nhất của notebook 23, ensemble đưa thêm tháng HOLD cho City (tháng 10–11) và HOLD cho Resort tháng 9 khi pressure ADR/RevPAR còn mạnh. CUT Resort mùa đông được giữ, khớp playbook lệch pha; RAISE City ôn hòa hơn vì median bị kéo về phía forecast/ML thay vì về phía $p^{\star}$ đơn độc.

---

## 4. Thảo luận

Lớp ML hai đầu đóng góp chủ yếu như **bộ điều hòa và trung gian**, không phải forecast độ chính xác cao. Cross-validation cho thấy HistGradientBoosting không học ổn định động lực ADR từ khoảng một năm tháng có lag usable mỗi hotel; vì thế `max_depth` giữ ở 3 để hạn chế overfit. Trên horizon, điều chỉnh mùa vụ của regressor nâng ADR forecast Resort mềm, trong khi classifier luôn-PROTECT phủ quyết ngôn ngữ kích cầu mạnh ngay cả khi pressure cổ điển yếu.

Quy tắc ensemble mới là sản phẩm vận hành. Bằng median của ba ước lượng lệch bias khác nhau và yêu cầu đa số phiếu cho RAISE/CUT, pipeline tránh lock mức RAISE analytic $+21\%$ mà tối ưu local-linear inelastic ưa thích. Đồng thời nó giữ CUT mùa đông Resort khi tối ưu và pressure đồng pha, với HOLD tháng 9 thừa nhận sức mạnh residual của peak. Đây là lớp governance heuristic, không phải reinforcement learning và không thay competitive-set monitoring.

Hạn chế gồm mẫu tháng ngắn, trạng thái lag đóng băng khi suy luận multi-step horizon, thiếu competitor rate và event calendar, cùng ngưỡng vote mang tính heuristic. Nên re-fit khi có thêm tháng actual, và chấm recommendation BAR theo pickup trước khi lock live.

---

## 5. Kết luận

Trên panel tháng hiện có, mô hình HistGradientBoosting cho ADR và stance thống kê mong manh dưới time-series CV, nhưng đầu ra horizon hữu ích để làm mềm cực trị tối ưu khi median-ensemble với ADR forecast và $p^{\star}$. Kế hoạch recommend-only đã công bố RAISE hoặc HOLD BAR City quanh median forecast/ML và CUT BAR Resort từ tháng 10 đến tháng 2 trong band ±15%. Notebook 24 vì thế hoàn tất stack dynamic pricing City–Resort như bề mặt quyết định có quản trị, chứ không như “nhà vô địch dự báo” đứng một mình.

---

## Tài liệu nguồn (artifact dự án)

1. Notebook nguồn: `notebooks/24_dynamic_pricing_ml_city_resort.ipynb`  
2. Đầu ra: `ml_rate_plan.csv`, `ensemble_rate_recommend.csv`, `cv_regressor.csv`, `cv_classifier.csv`  
3. Upstream: reports `20` / `20a` / `20b` / `21`, `22`, `23`  
4. Thư viện: scikit-learn `HistGradientBoostingRegressor` / `HistGradientBoostingClassifier`

---

*Báo cáo theo khung scientific-writing (IMRAD), trình bày tiếng Việt, từ `notebooks/24_dynamic_pricing_ml_city_resort.ipynb`. Cập nhật: 22/07/2026.*
