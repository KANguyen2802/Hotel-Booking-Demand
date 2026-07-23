Python

**1\. Phân loại Cấp độ Rủi ro (Business Risk Tier Translation)**

Việc áp dụng phương pháp **Isotonic Calibration** trên mô hình LightGBM v2.2 đã giúp xác suất dự đoán bám rất sát với tần suất thực tế, tạo điều kiện thuận lợi để chia nhóm rủi ro. Dựa vào ngưỡng tối ưu mới \$t = 0.25\$ và phân phối dữ liệu, điểm số P(hủy) được quy đổi thành 3 nhóm:

- **Low Risk (P < 0.25):** Là nhóm an toàn và chiếm đa số khối lượng booking. Phân phối của nhóm khách hàng "Không hủy" thực tế tập trung ở vùng xác suất rất thấp, với mức trung vị chỉ đạt 0.084.
- **Medium Risk (0.25 \$\\le\$ P < 0.55):** Điểm số đã vượt qua ngưỡng phân loại P(hủy) ≥ 0,25 để bị gán nhãn dự đoán Hủy. Nhóm này có mức độ rủi ro trung bình, tỷ lệ hủy dao động quanh mức 24.1%.
- **High Risk (P \$\\ge\$ 0.55):** Đây là nhóm báo động đỏ. Tần suất hủy thực tế của nhóm "Rất cao" có thể lên tới 64.0%. Xác suất trung vị của những booking bị hủy trên tập test đạt mức 0.614.

**2\. Thiết kế Chiến lược Overbooking (Overbooking Buffer Strategy)**

Sức mạnh lớn nhất của phiên bản v2.2 là giảm được 50.8% False Positives (so với v2.1@0.28) trong khi vẫn duy trì Recall \$\\ge\$ 0.85, giúp bộ đệm Overbooking trở nên mỏng hơn và an toàn hơn:

- **Tính toán Buffer theo Kênh:** Hệ số Overbooking sẽ được đẩy lên mức tối đa đối với nhóm khách hàng đến từ Online TA, do đây là kênh có đóng góp cực mạnh vào việc tăng xác suất hủy phòng (Mean |SHAP| = 0.433).
- **Kiểm soát rủi ro bằng Tín hiệu Cam kết:** Khách sạn tuyệt đối không áp dụng Overbooking bừa bãi. Ngay khi hệ thống ghi nhận khách hàng có yêu cầu chỗ đậu xe (required_car_parking_spaces > 0), rủi ro hủy phòng lập tức cắm đầu đi xuống (đây là biến số mạnh nhất với Mean |SHAP| = 0.915).
- **Chế độ phòng thủ (Inventory Protection Mode):** Trong các dịp Lễ Tết cao điểm, khi việc để phòng trống do khách hủy là điều tối kỵ, Revenue Manager sẽ chuyển hệ thống sang dùng mô hình dự phòng v2.1 @ 0.28 để tối thiểu hóa lỗi bỏ lọt (False Negative chỉ bằng 225).

**3\. Cancellation Policy Playbook (Quy trình Xử lý Hành động)**

Bộ quy tắc ứng xử dành cho Lễ tân và đội ngũ Chăm sóc Khách hàng:

| **Risk Tier**   | **Dấu hiệu Nhận diện Chính**                                                                                                                      | **Hành động Vận hành (Action)**                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Low Risk**    | Khách có xe ô tô (cần bãi đậu), có yêu cầu đặc biệt (special_requests), đặt phòng qua kênh Offline TA.                                            | Áp dụng "Frictionless Checkout". Không yêu cầu cọc tiền trước. Đảm bảo trải nghiệm đặt phòng nhanh nhất để giữ chân khách.                                 |
| **Medium Risk** | Điểm nằm trong khoảng 0.25 - 0.55. Không có lịch sử hủy phòng trước đây.                                                                          | Hệ thống CRM tự động gửi Email/SMS trước ngày Check-in 72 giờ, yêu cầu khách bấm vào nút "Xác nhận Lịch trình".                                            |
| **High Risk**   | Khách từ Bồ Đào Nha (country_PRT), đặt qua Online TA, thời gian chờ dài (lead_time), hoặc từng hủy phòng trong quá khứ (history_cancel_rate > 0). | Bắt buộc Gửi Payment Link thu cọc 1 đêm lưu trú đầu tiên. Nếu thẻ tín dụng báo lỗi (declined), chủ động hủy booking để nhả phòng cho hệ thống Overbooking. |

**4\. Phân tích Chi phí - Lợi ích (Estimated Revenue Recovery)**

Việc chạy thuật toán LightGBM v2.2 kết hợp Playbook trên tập dữ liệu thực tế (\$ADR = 107.6\$, \$ALOS = 3.7\$ đêm, \$Booking Value \\approx 398\$ USD) mang lại bức tranh tài chính cực kỳ hứa hẹn:

- **Khả năng Chặn đứng Thất thoát:** Dựa trên mức phát hiện 4,008 ca hủy (True Positives) tại tập test, khi quy đổi trên quy mô cả năm, hệ thống định vị được khoảng 6,680 booking ảo.
- **Doanh thu Phục hồi:** Giả định việc thực thi Playbook cứng rắn giúp giữ lại được 40% trong số này (bằng cọc hoặc bán kịp phòng cho người khác), và trừ đi tỷ lệ tự bán lại tự nhiên (30%), hệ thống mang về **~\$745,000 / năm**.
- **Chi phí Mất lòng Khách hàng (FP Cost):** Nhờ thành tích giảm cực mạnh cảnh báo giả xuống chỉ còn 2,939 ca trên test set, số lượng khách "bị oan" quy đổi hàng năm là 4,898 ca. Giả định 10% trong số này hủy luôn phòng vì tức giận với chính sách đòi cọc, chi phí cơ hội là **~\$195,000 / năm**.
- **Dòng tiền Thực dương (Net Benefit):** Chính sách mới mang lại ước tính **~\$550,000 / năm** cho khách sạn, chứng minh giá trị sinh lời khổng lồ của mô hình DA.

**5\. Khung Trình bày Phase 2 Deliverable (Presentation Structure)**

Để bảo vệ thành công dự án trước Ban Giám đốc, file Presentation sẽ được cấu trúc thành 5 slides trọng tâm:

- **The Crisis & The Cause:** Nêu bật bối cảnh thất thoát tiền từ tỷ lệ hủy trung bình 28.12% và sự bất lực của chính sách "cào bằng rủi ro" hiện tại.
- **The AI Solution (LightGBM v2.2):** Báo cáo thành tựu kỹ thuật. Khẳng định thuật toán v2.2 là một "Win-win" khi đạt AUC 0.896 và giảm đồng thời cả cảnh báo giả lẫn số ca bỏ lọt so với baseline v2.1@0.51.
- **Behavioral Insights:** Bóc tách các tín hiệu hủy phòng (Feature Importance). Nhấn mạnh yếu tố "Yêu cầu bãi đỗ xe" và "Số lượng yêu cầu đặc biệt" là kim chỉ nam an toàn để nhận diện khách thực tế.
- **Operational Transformation:** Show bảng Cancellation Policy Playbook và cơ chế tự động chuyển đổi mô hình (fallback) khi áp dụng Overbooking.
- **Financial Impact & Next Steps:** Đưa ra con số Net Benefit **\$550k/năm**. Xin phê duyệt (Sign-off) triển khai tích hợp JSON threshold v2.2 lên hệ thống máy chủ và chạy thử nghiệm A/B Testing trong tháng 8.