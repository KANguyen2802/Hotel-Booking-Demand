\# BÁO CÁO ĐỀ XUẤT CHIẾN LƯỢC: TỐI ƯU HÓA DOANH THU & QUẢN TRỊ RỦI RO HỦY PHÒNG

\*\*Dự án:\*\* Hotel Booking Demand Data Analytics

\*\*Phiên bản:\*\* 1.0 (Phase 2 Deliverable)

\*\*Người lập (Lead BA):\*\* \[Tên của bạn\]

\*\*Ngày báo cáo:\*\* 01/08/2026

\---

\## TÓM TẮT THỰC TRẠNG (EXECUTIVE SUMMARY)

Dựa trên phân tích 82,811 lượt đặt phòng thực tế, khách sạn đang đối mặt với hai vấn đề lớn cản trở việc tối ưu hóa doanh thu (RevPAR):

1\. \*\*Rủi ro thất thoát từ việc Hủy phòng:\*\* Tỷ lệ hủy chung ở mức 28.1%, đặc biệt lên tới 35.5% ở kênh OTA. Khách sạn đang chịu chi phí cơ hội lớn do chính sách "cào bằng rủi ro".

2\. \*\*Khuyết thiếu Chiến lược Giá Động (Dynamic Pricing):\*\* Khách sạn chưa khai thác triệt để sự chênh lệch về tính thời vụ (Seasonality), thời gian đặt trước (Lead-time) và cơ hội bán chéo (Upsell) giữa các hạng phòng.

\*\*Mục tiêu báo cáo:\*\* Tích hợp các mô hình Machine Learning từ Data Analyst thành các chính sách vận hành thực chiến, ước tính mang lại \*\*Net Benefit \$550,000/năm\*\* thông qua 2 trụ cột: Quản trị Rủi ro Hủy phòng và Định giá Động.

\---

\## PHẦN 1: CHIẾN LƯỢC QUẢN TRỊ RỦI RO HỦY PHÒNG

\### 1.1. Phân tích Nguyên nhân gốc rễ (5 Whys Analysis)

\* \*\*Vấn đề:\*\* Khách hàng OTA có tỷ lệ hủy phòng lên tới 35.5%.

\* \*\*Root Cause:\*\* Khách sạn phụ thuộc quá lớn vào nguồn traffic của OTA nên chấp nhận mở bán hạng phòng "Hủy miễn phí / Không cọc" để lấy thứ hạng hiển thị. Khách hàng lợi dụng điểm này để "đặt giữ chỗ" nhiều khách sạn cùng lúc, dẫn đến hệ thống thiếu một \*\*Khung chính sách định giá rủi ro (Risk-based pricing policy)\*\*.

\### 1.2. Đánh giá Tác động Tài chính (Mô phỏng trên v2.2 Model)

Sử dụng mô hình dự báo LightGBM v2.2 (với ADR trung bình 107.6 USD, độ dài lưu trú 3.7 đêm):

\* \*\*Doanh thu phục hồi dự kiến:\*\* Bắt giữ và xử lý thành công ~6,680 ca hủy ảo hàng năm, ước tính cứu được \*\*\$745,000 / năm\*\* (đã trừ đi tỷ lệ tự bán lại tự nhiên 30%).

\* \*\*Chi phí cảnh báo giả (FP Cost):\*\* Mô hình v2.2 ép cảnh báo giả (False Positives) giảm 50.8%, giúp chi phí "mất lòng khách hàng" do đòi cọc oan chỉ dừng ở mức \*\*\$195,000 / năm\*\*.

\* \*\*Lợi nhuận ròng (Net Benefit):\*\* Chính sách mới mang lại ước tính \*\*\$550,000 / năm\*\*.

\### 1.3. Phân loại Rủi ro (Business Risk Tier) & Cancellation Playbook

Dựa trên điểm xác suất P(hủy) từ mô hình, Lễ tân áp dụng ma trận xử lý sau:

| Cấp độ (Risk Tier) | Đặc điểm nhận diện từ Data                                                                         | Hành động Vận hành (Playbook)                                                                                                 |     |
| ------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --- |
| LOW (< 25%)        | Có yêu cầu bãi đậu xe ô tô, có yêu cầu đặc biệt (Special requests), đặt qua Offline TA.            | Frictionless Checkout: Không yêu cầu cọc. Ưu tiên trải nghiệm nhanh gọn.                                                      |     |
| MEDIUM (25 - 55%)  | Không có lịch sử hủy phòng, kênh Direct.                                                           | Verification: Hệ thống CRM tự động gửi Email/SMS trước 72h yêu cầu xác nhận lịch trình.                                       |     |
| HIGH (> 55%)       | Đặt qua OTA, thời gian chờ (Lead-time) dài, đến từ Bồ Đào Nha (PRT), từng hủy phòng trong quá khứ. | Deposit Required: Bắt buộc gửi Payment Link thu cọc 1 đêm (107.6 USD). Nếu lỗi thẻ, tự động hủy booking để nhả phòng bán lại. |     |

\### 1.4. Đề xuất Kịch bản Chính sách (Policy Scenarios)

BA đề xuất Ban Giám đốc triển khai đồng thời 2 kịch bản:

\* \*\*Partial Deposit (Cọc 1 đêm):\*\* Bắt buộc cung cấp thẻ tín dụng để giữ hạn mức 1 đêm cho mọi booking. Hủy sau 72h trước ngày Check-in sẽ bị trừ tiền.

\* \*\*Fully Non-Refundable (Không hoàn tiền):\*\* Đóng gói hạng phòng thanh toán ngay 100% lúc đặt với mức giá rẻ hơn 15%. Dành riêng tối đa 30% quỹ phòng cho kịch bản này để đảm bảo dòng tiền mặt.

\---

\## PHẦN 2: CHIẾN LƯỢC ĐỊNH GIÁ ĐỘNG & UPSELL (DYNAMIC PRICING)

\### 2.1. Đối chuẩn Chiến lược (City Hotel vs. Resort Hotel)

Dữ liệu chỉ ra hai hành vi tiêu dùng trái ngược, đòi hỏi hai chiến lược BAR (Best Available Rate) riêng biệt:

\* \*\*Resort Hotel (High Volatility BAR):\*\* Biến động mùa vụ cực gắt. Cần tối đa hóa lợi nhuận mùa Hè (Tháng 7 - Tháng 8) và linh hoạt xả giá vào mùa Đông (Tháng 11 - Tháng 1). Phạt giá mạnh với các booking đặt sát ngày (Last-minute).

\* \*\*City Hotel (Flat BAR):\*\* Nhu cầu bình ổn quanh năm. Mức giá trung vị duy trì đường thẳng ngang ở mức ~100 USD. Tập trung giữ giá ổn định để phục vụ khách công tác (Corporate).

\### 2.2. Ma trận Định giá Động (Rule Matrix cho Resort Hotel)

| Mùa vụ                   | Đặc điểm    | Lead-time Triggers (Quy tắc Thời gian)                                             | Upsell / Inventory Triggers (Quy tắc Tồn phòng)                                |
| ------------------------ | ----------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Low (T11 - T2)           | Cầu thấp    | Early Bird: Giảm 15% nếu đặt trước > 90 ngày để tạo Base Occupancy.                | Không tăng giá phòng. Đóng gói (Bundling) Hạng A + Bữa ăn để tăng giá trị.     |
| Peak (T3 - T6, T9 - T10) | Cầu ổn định | Standard BAR: Không giảm giá Early bird. Tăng giá 10% nếu đặt sát ngày (< 7 ngày). | Khi công suất > 70%, tăng Base Rate lên 5%. Đẩy mạnh kịch bản Upsell tại quầy. |
| Ultra-Peak (T7 - T8)     | Cầu bùng nổ | Penalty: Cấm booking < 3 ngày hoặc charge 150% giá gốc. Không khuyến mãi.          | Đóng bán Hạng A. Bắt buộc khách mua từ Hạng D, E trở lên (Non-refundable).     |

\### 2.3. Khai thác mỏ vàng Upsell & Quản trị rủi ro hạ hạng phòng

\* \*\*Tối ưu Upsell (A \$\\rightarrow\$ D):\*\* Phân tích Room Transition cho thấy cặp nâng cấp từ Hạng A (Standard) lên Hạng D (Premium) có khả năng sinh lời lớn nhất (ước tính cơ hội 400,000 USD). Lễ tân áp dụng chiến thuật "Marginal WTP" (thu thêm 20 USD/đêm thay vì mức chênh lệch niêm yết đầy đủ) để dễ dàng chốt sales tại quầy.

\* \*\*Quản trị rủi ro Mismatch:\*\* Hơn 1,800 ca bị "Downgrade" (Hạ hạng phòng) với ADR gốc rất cao tiềm ẩn rủi ro khủng hoảng truyền thông. Hệ thống tự động kích hoạt giá Refund (Hoàn chênh lệch) hoặc cấp Voucher Dịch vụ ngay khi phát hiện khách bị xếp phòng thấp hơn hạng đã đặt.

\---

\## PHẦN 3: KẾ HOẠCH TRIỂN KHAI (NEXT STEPS)

Để hiện thực hóa mức lợi nhuận dự kiến, nhóm Dự án đề xuất lộ trình triển khai trong Quý tới:

1\. \*\*Tích hợp Hệ thống (IT & Data):\*\* Cắm tệp \`threshold_policy_v2_2.json\` vào hệ thống PMS hiện tại. Bổ sung các Trigger tự động tăng/giảm giá theo Ma trận Định giá.

2\. \*\*Đào tạo Vận hành (Training):\*\* Tổ chức Workshop cho bộ phận Lễ tân và Sales về kịch bản Upsell A \$\\rightarrow\$ D và cách đọc cảnh báo rủi ro Low/Med/High từ hệ thống.

3\. \*\*Thử nghiệm (A/B Testing):\*\* Triển khai thử nghiệm chính sách "Cọc 1 đêm" trên 30% lượng booking OTA trong tháng 8 để đo lường tỷ lệ rớt đơn trước khi áp dụng toàn tuyến.