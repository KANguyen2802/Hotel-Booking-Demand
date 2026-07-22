# 22 — Price elasticity of demand: City vs Resort

> **Loại:** Báo cáo khoa học kỹ thuật (IMRAD) · recommend-only  
> **Dữ liệu:** `hotel_bookings_v5.csv` · stay (`is_canceled = 0`, `adr > 0`) · ~26 tháng/hotel (2015-07 → 2017-08)  
> **Notebook:** [`notebooks/22_dynamic_pricing_elasticity_city_resort.ipynb`](../notebooks/22_dynamic_pricing_elasticity_city_resort.ipynb)  
> **Figures:** [`reports/figures/22_elasticity/`](./figures/22_elasticity/)  
> **Đầu ra chính:** [`elasticity_by_hotel.csv`](./figures/22_elasticity/elasticity_by_hotel.csv) → notebook **23**  
> **Cập nhật:** 22/07/2026

---

## Tóm tắt

Báo cáo kỹ thuật này ước lượng price elasticity của demand stay theo tháng cho City Hotel và Resort Hotel từ panel booking đã làm sạch `hotel_bookings_v5.csv`. Ba đặc tả kinh tế lượng được ước lượng riêng từng property: log–log OLS với month fixed effects, hồi quy first-difference, và log–log cấp segment với month fixed effects. Trên mọi estimator lịch sử, ước lượng điểm đều dương — trái với kỳ vọng lý thuyết $\varepsilon = \partial\log Q/\partial\log P < 0$ — cho thấy seasonality còn sót và price endogeneity chứ không phải độ dốc demand nhân quả. Vì vậy elasticity vận hành được đặt theo RM prior $-0{,}70$ (City) và $-1{,}10$ (Resort) rồi xuất ra cho tối ưu rate. Tham số này hàm ý demand City kém co giãn (ủng hộ động tác PROTECT / harden BAR) và demand Resort co giãn nhẹ (ủng hộ kích cầu sâu hơn khi pressure yếu).

---

## 1. Giới thiệu

Dynamic pricing cho khách sạn cần liên kết định lượng giữa rate và booking volume. Các notebook forecast 20, 20a và 20b cung cấp tín hiệu demand, ADR và RevPAR theo tháng từng property, nhưng chưa nói quantity phản ứng thế nào khi BAR lệch khỏi baseline forecast. Price elasticity of demand lấp khoảng trống đó bằng một tham số điều khiển vô hướng cho bước tối ưu tiếp theo.

Định nghĩa cổ điển dùng ở đây là $\varepsilon = \partial\log Q/\partial\log P$. Theo lý thuyết demand chuẩn, $\varepsilon$ âm; trị tuyệt đối nhỏ hơn 1 nghĩa là demand inelastic (harden rate thường tăng revenue), còn lớn hơn 1 nghĩa là demand elastic (cắt giá promo có thể mở rộng revenue khi occupancy pressure mềm). Ước lượng $\varepsilon$ từ dữ liệu khách sạn quan sát khó vì ADR đồng biến với seasonality, channel mix và inventory control. Nghiên cứu này vì thế so sánh vài estimator reduced-form, ghi nhận bias, và chọn elasticity primary phù hợp cho lập kế hoạch rate recommend-only chứ không nhằm suy luận nhân quả.

Mục tiêu gồm ba phần: dựng panel tháng demand · ADR · occupancy · RevPAR theo hotel; ước lượng elasticity dưới đặc tả log–log, first-difference và market segment; công bố bảng elasticity primary cho notebook 23.

---

## 2. Phương pháp

### 2.1 Dữ liệu và dựng panel

Stay booking có ADR dương được gom theo tháng lịch trong từng hotel. Panel thu được gồm hai mươi sáu tháng mỗi property. City Hotel đóng góp 35.137 stay với ADR trung bình tháng khoảng €106,78; Resort Hotel đóng góp 24.390 stay với ADR trung bình tháng khoảng €94,45. Occupancy và RevPAR giữ làm metric ngữ cảnh nhưng không dùng làm biến phụ thuộc của hồi quy elasticity.

### 2.2 Đặc tả kinh tế lượng

Ba estimator được áp riêng cho từng hotel.

1. Log–log OLS với month fixed effects: $\log Q_{t} = \alpha + \varepsilon\log P_{t} + \sum_{m}\delta_{m} + u_{t}$.  
2. Hồi quy first-difference: $\Delta\log Q_{t} = \varepsilon\Delta\log P_{t} + e_{t}$, nhằm giảm nhiễu trend tần số thấp.  
3. Segment log–log với month fixed effects: quan sát mở rộng thành hotel × year-month × market segment để biến thiên channel/ADR trong cùng tháng có thể identify $\varepsilon$.

Ý nghĩa thống kê đánh giá bằng $t$-statistic thông thường và khoảng tin cậy 95%. Cỡ mẫu là $n = 26$ cho đặc tả tháng, $n = 25$ sau first difference, và $n = 124$ (City) / $n = 113$ (Resort) cho panel segment.

### 2.3 Quy tắc chọn elasticity primary

Vì cả ba estimator lịch sử đều trả $\varepsilon$ dương với ít nhất một hotel (và dương mạnh ở City), quy tắc chọn ưu tiên mọi ước lượng âm có ý nghĩa thống kê theo thứ tự {first-difference, segment, log–log}; nếu không thì áp RM prior. Prior là City $\varepsilon = -0{,}70$ và Resort $\varepsilon = -1{,}10$, phản ánh phán đoán vận hành rằng demand đô thị kém nhạy giá hơn demand nghỉ dưỡng leisure.

---

## 3. Kết quả

### 3.1 Quan hệ mô tả giữa ADR và demand

Hình 1 thể hiện scatter thô của mean ADR so với demand stay tháng theo hotel kèm đường xu hướng tuyến tính. Liên hệ thị giác bị chi phối bởi đồng biến mùa vụ: tháng hè ADR cao cũng thường mang volume cao, nên độ dốc không điều kiện không nhất thiết âm.

![Hình 1. ADR so với demand tháng theo hotel](./figures/22_elasticity/compare/01_adr_vs_demand_scatter.png)

*Hình 1. Scatter mean ADR tháng (€) so với stay demand cho City Hotel và Resort Hotel, kèm đường trend theo hotel.*

### 3.2 Ước lượng kinh tế lượng

Bảng 1 báo cáo mọi elasticity ước lượng. Với City Hotel, log–log month FE cho $\varepsilon = 3{,}50$ (SE $= 0{,}53$, $p < .001$, $R^{2} = 0{,}83$), first-difference cho $\varepsilon = 1{,}93$ (SE $= 0{,}59$, $p = .003$), và segment log–log cho $\varepsilon = 3{,}32$ (SE $= 0{,}45$, $p < .001$). Với Resort Hotel, các ước lượng tương ứng là $0{,}41$ ($p = .096$), $0{,}11$ ($p = .24$) và $1{,}07$ ($p < .001$). Không đặc tả nào tạo ước lượng điểm âm thỏa quy tắc chọn primary.

**Bảng 1.** Ước lượng elasticity theo hotel và method

| Hotel | Method | $\varepsilon$ | SE | $t$ | $p$ | $R^{2}$ | $n$ | 95% CI |
|---|---|---:|---:|---:|---:|---:|---:|---|
| City | loglog_ols_month_fe | 3,50 | 0,53 | 6,55 | <.001 | 0,83 | 26 | [2,45, 4,55] |
| Resort | loglog_ols_month_fe | 0,41 | 0,23 | 1,80 | .096 | 0,72 | 26 | [−0,04, 0,85] |
| City | first_difference | 1,93 | 0,59 | 3,28 | .003 | 0,31 | 25 | [0,77, 3,08] |
| Resort | first_difference | 0,11 | 0,09 | 1,21 | .238 | 0,06 | 25 | [−0,07, 0,30] |
| City | segment_loglog_month_fe | 3,32 | 0,45 | 7,44 | <.001 | 0,34 | 124 | [2,44, 4,19] |
| Resort | segment_loglog_month_fe | 1,07 | 0,28 | 3,81 | <.001 | 0,23 | 113 | [0,52, 1,63] |

### 3.3 Elasticity primary cho vận hành

Bảng 2 ghi tham số primary đã xuất. Cả hai hotel được gán RM prior vì ước lượng OLS vẫn bias dương. City được gắn nhãn inelastic ($|\varepsilon| < 1$), Resort gắn mildly elastic ($|\varepsilon| > 1$).

**Bảng 2.** Elasticity primary xuất sang optimization

| Hotel | $\varepsilon_{\mathrm{primary}}$ | Source | Note |
|---|---:|---|---|
| City Hotel | **−0,70** | rm_prior | OLS bias dương (seasonality/endogeneity) |
| Resort Hotel | **−1,10** | rm_prior | OLS bias dương (seasonality/endogeneity) |

Hình 2 vẽ đường demand iso-elastic quanh mean ADR từng hotel với $\varepsilon$ primary. Độ dốc tuyệt đối của Resort dốc hơn, minh họa phản ứng quantity lớn hơn với cùng một thay đổi rate phần trăm.

![Hình 2. Đường demand iso-elastic tại ε primary](./figures/22_elasticity/compare/02_isoelastic_curves.png)

*Hình 2. Đường iso-elastic $Q(P)$ quanh mean ADR dùng $\varepsilon_{\mathrm{primary}}$ cho City (−0,70) và Resort (−1,10).*

---

## 4. Thảo luận

Các elasticity reduced-form đồng loạt dương không nên đọc như bằng chứng khách đặt phòng nhiều hơn khi giá tăng. Thay vào đó, chúng cho thấy panel tháng ngắn không tách được biến thiên giá ngoại sinh khỏi shock demand mùa vụ: tháng hè vừa ADR cao vừa volume cao, và ngay cả month fixed effects hay first difference vẫn để lại endogeneity. Gom cấp segment tăng cỡ mẫu nhưng vẫn không phục hồi được độ dốc âm cho City — củng cố rằng cần thiết kế nhân quả (instrument, natural experiment, hoặc A/B rate có kiểm soát) mới identify được.

Với revenue management, hàm ý thực tế là xem $\varepsilon$ như **tham số điều khiển** kèm prior tường minh, chứ không phải hằng số nhân quả đã ước lượng. Với City $\varepsilon = -0{,}70$, tăng BAR 1% kỳ vọng giảm demand khoảng 0,7%, nên định giá bảo vệ ở tháng pressure cao nhất quán với tăng revenue. Với Resort $\varepsilon = -1{,}10$, cắt giá promo hiệu quả hơn khi pressure ADR và RevPAR rơi dưới baseline mùa — khớp cửa sổ kích cầu Oct–Jan trong playbook forecast (báo cáo 21).

Một số hạn chế giới hạn khả năng khái quát. Panel chỉ khoảng hai mươi sáu tháng mỗi hotel nên power thấp và khoảng tin cậy rộng. Competitive set rate, sự kiện và ràng buộc capacity không quan sát được. Bản thân prior không ước lượng từ dataset này và cần stress-test bằng sensitivity grid trong optimization. Cuối cùng, mọi recommendation vẫn mang tính tư vấn cho đến khi validate với pickup và sell-out.

---

## 5. Kết luận

Estimator log–log và first-difference lịch sử của price elasticity tháng bị bias dương với cả City và Resort nên không dùng làm tham số vận hành. Elasticity primary $-0{,}70$ (City) và $-1{,}10$ (Resort) được chọn từ RM prior và công bố trong `elasticity_by_hotel.csv` cho notebook 23. Các giá trị này mã hóa một property đô thị kém co giãn và một resort co giãn nhẹ, tạo liên kết minh bạch giữa forecast pressure và bước tối ưu BAR tiếp theo.

---

## Tài liệu nguồn (artifact dự án)

1. Notebook nguồn: `notebooks/22_dynamic_pricing_elasticity_city_resort.ipynb`  
2. Bảng đầu ra: `reports/figures/22_elasticity/elasticity_estimates_all.csv`, `elasticity_by_hotel.csv`, `monthly_panel.csv`  
3. Forecast upstream: reports `20`, `20a`, `20b`, tổng hợp `21`  
4. Consumer downstream: notebook `23_dynamic_pricing_optimization_city_resort.ipynb`

---

*Báo cáo theo khung scientific-writing (IMRAD), trình bày tiếng Việt, từ `notebooks/22_dynamic_pricing_elasticity_city_resort.ipynb`. Cập nhật: 22/07/2026.*
