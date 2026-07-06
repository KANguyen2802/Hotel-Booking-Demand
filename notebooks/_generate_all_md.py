"""Generate all MD documentation files from recomputed statistics."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
with open(ROOT / "_stats_output.json", encoding="utf-8") as f:
    S = json.load(f)
with open(ROOT / "_stats_extra.json", encoding="utf-8") as f:
    E = json.load(f)

TODAY = "3/7/2026"
N = S["base"]["n"]
CANCELED = S["base"]["canceled"]
RATE = S["base"]["cancel_rate"]
ADR_N = S["adr"]["n_adr"]
MEAN_ADR = S["adr"]["mean_adr"]
NOT_CANCELED = N - CANCELED


def fi(n):
    return f"{int(n):,}".replace(",", ".")


def fp(x, d=1):
    return f"{x:.{d}f}".replace(".", ",")


def fe(x, d=2):
    return f"{x:.{d}f}".replace(".", ",")


def fr(x, d=3):
    return f"{x:.{d}f}".replace(".", ",")


def feur(x, d=2):
    return f"{fe(x, d)} €"


def transpose_nested(d):
    out = {}
    for k1, inner in d.items():
        for k2, val in inner.items():
            out.setdefault(k2, {})[k1] = val
    return out


def hm_cell(rate_dict, vol_dict, segment, channel):
    r = rate_dict.get(segment, {}).get(channel)
    v = vol_dict.get(segment, {}).get(channel, 0)
    if r is None or v == 0:
        return "—"
    return f"**{fp(r)}**" if r > 30 else fp(r)


def seg_dict():
    return {d["market_segment"]: d for d in S["segment"]}


def ch_dict():
    return {
        d["distribution_channel"]: d
        for d in S["channel"]
        if d["distribution_channel"] != "Undefined"
    }


def dep_dict():
    return {d["deposit_type"]: d for d in S["deposit"]}


HM_R = transpose_nested(E["hm_rate"])
HM_V = transpose_nested(E["hm_vol"])


def build_stage1():
    lt = S["lead_time"]
    bins = lt["bins"]
    box = lt["box"]
    dep = {d["deposit_type"]: d for d in S["deposit"]}
    seg = {d["market_segment"]: d for d in S["segment"]}
    ch = {d["distribution_channel"]: d for d in S["channel"] if d["distribution_channel"] != "Undefined"}
    hm_r = HM_R
    hm_v = HM_V

    ota_tato = S["heatmap"]
    est_cancel_ota = int(ota_tato["ota_tato_vol"] * ota_tato["ota_tato_rate"] / 100)

    lines = [
        "# EDA Stage 1: Cancellation Analysis",
        "",
        f"> **Nguồn dữ liệu:** `hotel_bookings_v4.csv`  ",
        f"> **Phạm vi:** {fi(N)} booking | Tỷ lệ hủy tổng thể: **{fp(RATE, 2)}%** ({fi(CANCELED)} booking bị hủy)  ",
        "> **Notebook tham chiếu:** `eda_cancellation.ipynb`",
        "",
        "---",
        "",
        "## Mục tiêu phân tích",
        "",
        'Giai đoạn EDA Stage 1 tập trung khám phá mối quan hệ giữa **tỷ lệ hủy phòng (`is_canceled`)** và các yếu tố hành vi đặt phòng: thời gian đặt trước (`lead_time`), loại tiền cọc (`deposit_type`), phân khúc thị trường (`market_segment`) và kênh phân phối (`distribution_channel`). Mười một biểu đồ dưới đây được nhóm theo từng chiều phân tích, kèm insight có thể hành động được.',
        "",
        "---",
        "",
        "## Nhóm 1 — Lead time (Biểu đồ 1 → 5)",
        "",
        "### Biểu đồ 1: Histogram số booking theo lead_time bin (tách theo `is_canceled`)",
        "",
        "**Mô tả:** Grouped bar + stacked bar 100% — trục X = khoảng lead_time (0–30, 31–60, 61–90, 91–180, >180 ngày), trục Y = số lượng booking, tách màu theo Không hủy / Đã hủy.",
        "",
        "**Insight:**",
        "",
        "| Lead time bin | Tổng booking | Đã hủy | Tỷ lệ hủy |",
        "|---|---:|---:|---:|",
    ]
    labels = ["0–30 ngày", "31–60 ngày", "61–90 ngày", "91–180 ngày", ">180 ngày"]
    for b, lbl in zip(bins, labels):
        lines.append(f"| {lbl} | {fi(b['total'])} | {fi(b['canceled'])} | {fp(b['rate'])}% |")

    b0 = bins[0]
    share_vol = b0["total"] / N * 100
    share_cancel = b0["canceled"] / CANCELED * 100
    b3 = bins[3]
    share_cancel_b3 = b3["canceled"] / CANCELED * 100

    lines += [
        "",
        f"- Bin **0–30 ngày** chiếm **~{fp(share_vol, 1)}%** tổng booking và có volume không hủy lớn nhất ({fi(b0['not_canceled'])} booking) — đây là nhóm \"an toàn\" nhưng vẫn đóng góp **{fp(share_cancel, 1)}%** tổng số booking bị hủy.",
        f"- Bin **91–180 ngày** có volume cao thứ hai ({fi(b3['total'])}) và đóng góp **{fp(share_cancel_b3, 1)}%** tổng cancellation — rủi ro tập trung ở khoảng đặt trước trung-dài hạn.",
        "- Stacked bar 100% cho thấy tỷ lệ phần \"Đã hủy\" tăng dần rõ rệt từ bin 0–30 sang >180, xác nhận lead_time dài hơn → xác suất hủy cao hơn.",
        "",
        "---",
        "",
        "### Biểu đồ 2: Histogram + KDE overlay (trục Y kép)",
        "",
        "**Mô tả:** Histogram count theo lead_time liên tục (trục Y trái) kết hợp đường KDE density (trục Y phải), tách theo `is_canceled`.",
        "",
        "**Insight:**",
        "",
        "- Phân bố lead_time của booking **không hủy** tập trung mạnh ở vùng **0–100 ngày**, đỉnh density cao nhất quanh **30–60 ngày**.",
        "- Booking **đã hủy** có phân bố dịch sang phải (lead_time cao hơn), đỉnh density nằm ở khoảng **60–120 ngày** và vẫn còn đuôi dài đến >300 ngày.",
        "- Hai đường KDE giao nhau ở khoảng **~45–55 ngày**: dưới ngưỡng này booking không hủy chiếm ưu thế; trên ngưỡng này booking hủy trở nên phổ biến hơn tương đối.",
        "",
        "---",
        "",
        "### Biểu đồ 3: Histogram theo bin + KDE liên tục (2 subplot)",
        "",
        "**Mô tả:** Subplot trái = histogram rời theo bin; subplot phải = KDE lead_time liên tục — cả hai tách theo trạng thái hủy.",
        "",
        "**Insight:**",
        "",
        f"- Histogram theo bin làm rõ **bước nhảy lớn nhất** về tỷ lệ hủy xảy ra giữa bin **0–30** ({fp(bins[0]['rate'])}%) và **31–60** ({fp(bins[1]['rate'])}%) — gần **gấp đôi**.",
        "- KDE liên tục bổ sung góc nhìn: booking hủy không chỉ \"dịch phải\" mà còn **phân tán rộng hơn** (độ lệch chuẩn cao hơn), phản ánh sự không chắc chắn cao hơn ở các booking đặt xa ngày đến.",
        "- Kết hợp hai subplot: rủi ro hủy tăng **đột biến** sau 30 ngày lead_time, không phải tăng tuyến tính mượt.",
        "",
        "---",
        "",
        "### Biểu đồ 4: Boxplot + Violin plot (`lead_time` theo `is_canceled`)",
        "",
        "**Mô tả:** Trục X = trạng thái hủy, trục Y = lead_time (ngày).",
        "",
        "**Insight:**",
        "",
        "| Trạng thái | Số booking | Mean | Median | Std |",
        "|---|---:|---:|---:|---:|",
        f"| Không hủy (0) | {fi(box['not_cancel']['n'])} | {fp(box['not_cancel']['mean'], 1)} ngày | {int(box['not_cancel']['median'])} ngày | {fp(box['not_cancel']['std'], 1)} |",
        f"| Đã hủy (1) | {fi(box['cancel']['n'])} | {fp(box['cancel']['mean'], 1)} ngày | {int(box['cancel']['median'])} ngày | {fp(box['cancel']['std'], 1)} |",
        "",
        f"- Median lead_time của booking hủy (**{int(box['cancel']['median'])} ngày**) cao hơn **gấp ~{box['cancel']['median']/box['not_cancel']['median']:.1f} lần** so với booking không hủy (**{int(box['not_cancel']['median'])} ngày**).",
        "- Violin plot cho thấy phân bố booking hủy **dẹt và rộng hơn** ở vùng 60–150 ngày, trong khi booking không hủy tập trung hơn quanh median thấp.",
        "- Boxplot: IQR của nhóm hủy cao hơn đáng kể; cả hai nhóm đều có outlier (lead_time >400 ngày) nhưng nhóm hủy có nhiều outlier hơn ở vùng cao.",
        "",
        "---",
        "",
        "### Biểu đồ 5: Line chart tỷ lệ hủy theo lead_time bin",
        "",
        "**Mô tả:** Trục X = lead_time bin, trục Y = `cancellation_rate (%)`.",
        "",
        "**Insight:**",
        "",
        f"- Xu hướng **monotonic tăng** rõ rệt: {lt['mono']}.",
        f"- **Bước nhảy lớn nhất:** từ 0–30 lên 31–60 (+{fp(bins[1]['rate']-bins[0]['rate'], 1)} điểm %). Sau 60 ngày, tỷ lệ hủy tăng chậm hơn nhưng vẫn leo thang.",
        f"- Bin **>180 ngày** đạt **{fp(bins[4]['rate'])}%** — gần **{bins[4]['rate']/bins[0]['rate']:.1f} lần** bin 0–30 ngày.",
        "- **Hàm ý vận hành:** ngưỡng lead_time **30 ngày** là ranh giới quan trọng để phân loại rủi ro; booking >180 ngày cần chiến lược giữ chân riêng (cọc, xác nhận, pricing linh hoạt).",
        "",
        "---",
        "",
        "## Nhóm 2 — Deposit type (Biểu đồ 6 → 7)",
        "",
        "### Biểu đồ 6: Bar chart tỷ lệ hủy theo `deposit_type`",
        "",
        "**Mô tả:** Trục X = deposit_type, trục Y = cancellation_rate (%).",
        "",
        "**Insight:**",
        "",
        "| Deposit type | Bookings | Cancellation rate |",
        "|---|---:|---:|",
    ]
    for name in ["No Deposit", "Non Refund", "Refundable"]:
        d = dep[name]
        pct = d["bookings"] / N * 100
        extra = f" ({fp(pct, 1)}%)" if name == "No Deposit" else f" ({fp(pct, 1)}%)" if pct >= 0.1 else " (<0,1%)"
        lines.append(f"| {name} | {fi(d['bookings'])}{extra} | **{fp(d['rate'])}%** |")

    lines += [
        "",
        f"- **Non Refund** có tỷ lệ hủy cực cao (~{fp(dep['Non Refund']['rate'])}%) — gần như mọi booking loại này đều bị hủy trong dataset. Tuy nhiên volume rất nhỏ ({fi(dep['Non Refund']['bookings'])} booking).",
        f"- **No Deposit** chiếm gần toàn bộ dataset và kéo tỷ lệ hủy tổng thể (~{fp(RATE, 2)}%) — đây là nhóm cần ưu tiên can thiệp vì scale lớn.",
        f"- **Refundable** có sample quá nhỏ ({fi(dep['Refundable']['bookings'])}) nên tỷ lệ {fp(dep['Refundable']['rate'])}% cần diễn giải thận trọng.",
        "",
        "---",
        "",
        "### Biểu đồ 7: Stacked bar 100% — Không hủy vs Đã hủy theo `deposit_type`",
        "",
        "**Mô tả:** Trục X = deposit_type, trục Y = tỷ lệ (%), stack theo `is_canceled`.",
        "",
        "**Insight:**",
        "",
        "| Deposit type | Không hủy | Đã hủy |",
        "|---|---:|---:|",
    ]
    for name in ["No Deposit", "Non Refund", "Refundable"]:
        d = dep[name]
        lines.append(f"| {name} | {fp(100-d['rate'])}% | {fp(d['rate'])}% |")

    lines += [
        "",
        f"- **No Deposit:** cứ 4 booking thì hơn 1 booking bị hủy — rủi ro hệ thống cao khi không yêu cầu cọc.",
        "- **Non Refund:** gần như toàn bộ stack là \"Đã hủy\" — loại cọc này **không hiệu quả** trong việc giảm hủy (có thể do cách ghi nhận dữ liệu hoặc chính sách cọc thực tế khác với tên gọi).",
        f"- **Refundable:** tỷ lệ hủy cao hơn No Deposit (~{fp(dep['Refundable']['rate'])}% vs {fp(dep['No Deposit']['rate'])}%), phù hợp kỳ vọng vì khách có thể hủy và được hoàn cọc.",
        f"- **Kết luận chính sách:** yêu cầu cọc (đặc biệt non-refundable) có liên quan mật thiết với hành vi hủy; cần xem xét mở rộng cọc cho segment rủi ro cao thay vì để No Deposit chiếm {fp(S['nd_pct'], 1)}% booking.",
        "",
        "---",
        "",
        "## Nhóm 3 — Market segment (Biểu đồ 8 → 9)",
        "",
        "### Biểu đồ 8: Horizontal bar — tỷ lệ hủy theo `market_segment` (sắp giảm dần)",
        "",
        "**Mô tả:** Trục Y = market_segment, trục X = cancellation_rate (%).",
        "",
        "**Insight (sắp theo tỷ lệ hủy giảm dần):",
        "",
        "| Market segment | Bookings | Cancellation rate |",
        "|---|---:|---:|",
    ]
    for d in sorted(S["segment"], key=lambda x: -x["rate"]):
        star = " *" if d["market_segment"] == "Undefined" else ""
        bold = "**" if d["market_segment"] in ("Online TA", "Groups", "Corporate") else ""
        end = "**" if bold else ""
        lines.append(f"| {d['market_segment']} | {fi(d['bookings'])} | {bold}{fp(d['rate'])}{end}% |{star}")

    lines += [
        "",
        "*\\*Undefined chỉ 2 booking — không có ý nghĩa thống kê.*",
        "",
        f"- **Online TA** vừa có volume lớn nhất (~{fp(S['ota_pct'], 1)}% tổng booking) vừa có tỷ lệ hủy cao nhất trong các segment chính — đây là **điểm nóng rủi ro số 1**.",
        f"- **Groups** cũng thuộc nhóm rủi ro cao ({fp(seg['Groups']['rate'])}%) dù volume nhỏ hơn.",
        f"- **Corporate** có tỷ lệ hủy thấp nhất ({fp(seg['Corporate']['rate'])}%) — segment ổn định, thường là khách doanh nghiệp có cam kết cao hơn.",
        f"- **Direct** và **Offline TA/TO** ở mức trung bình-thấp (~{fp(seg['Direct']['rate'])}–{fp(seg['Offline TA/TO']['rate'])}%), thấp hơn đáng kể so với Online TA.",
        "",
        "---",
        "",
        "### Biểu đồ 9: Dual-axis — Volume vs cancellation rate theo `market_segment`",
        "",
        "**Mô tả:** Cột = số booking (sắp theo volume giảm dần), đường = cancellation_rate (%).",
        "",
        "**Insight:**",
        "",
        f"- **Online TA** nổi bật: cột cao nhất ({fi(seg['Online TA']['bookings'])}) **và** đường cancellation cao ({fp(seg['Online TA']['rate'])}%) — segment \"vừa to vừa rủi ro\".",
        f"- **Offline TA/TO** ({fi(seg['Offline TA/TO']['bookings'])} booking, {fp(seg['Offline TA/TO']['rate'])}%) và **Direct** ({fi(seg['Direct']['bookings'])}, {fp(seg['Direct']['rate'])}%) có volume đáng kể nhưng tỷ lệ hủy thấp hơn nhiều — hiệu quả hơn về mặt giữ booking.",
        f"- **Corporate** ({fi(seg['Corporate']['bookings'])}, {fp(seg['Corporate']['rate'])}%) và **Groups** ({fi(seg['Groups']['bookings'])}, {fp(seg['Groups']['rate'])}%) có volume tương đương nhưng tỷ lệ hủy **chênh lệch gần {seg['Groups']['rate']/seg['Corporate']['rate']:.1f} lần** — cùng quy mô nhưng rủi ro rất khác nhau.",
        f"- **Aviation** ({fi(seg['Aviation']['bookings'])}, {fp(seg['Aviation']['rate'])}%) và **Complementary** ({fi(seg['Complementary']['bookings'])}, {fp(seg['Complementary']['rate'])}%) volume nhỏ, ít ảnh hưởng đến tổng cancellation nhưng vẫn hữu ích cho phân khúc chiến lược.",
        "",
        "**Hàm ý:** ưu tiên can thiệp tại **Online TA** (impact lớn nhất lên tổng số booking hủy) thay vì tập trung đồng đều tất cả segment.",
        "",
        "---",
        "",
        "## Nhóm 4 — Distribution channel (Biểu đồ 10 → 11)",
        "",
        "### Biểu đồ 10: Bar chart tỷ lệ hủy theo `distribution_channel`",
        "",
        "**Mô tả:** Trục X = distribution_channel (Direct, Corporate, TA/TO, GDS), trục Y = cancellation_rate (%).",
        "",
        "**Insight:**",
        "",
        "| Distribution channel | Bookings | Cancellation rate |",
        "|---|---:|---:|",
    ]
    for key in ["TA/TO", "GDS", "Direct", "Corporate"]:
        d = ch[key]
        pct = d["bookings"] / N * 100
        lines.append(f"| {key} | {fi(d['bookings'])} ({fp(pct, 1)}%) | **{fp(d['rate'])}%** |")

    lines += [
        "",
        f"- **TA/TO** chiếm **~{fp(S['tato_pct'], 0)}%** booking và có tỷ lệ hủy cao nhất ({fp(ch['TA/TO']['rate'])}%) — kênh OTA/travel agent là nguồn chính của cancellation.",
        f"- **Direct** ({fp(ch['Direct']['rate'])}%) và **Corporate** ({fp(ch['Corporate']['rate'])}%) có tỷ lệ hủy thấp hơn **~50%** so với TA/TO — đặt trực tiếp hoặc qua kênh doanh nghiệp ổn định hơn.",
        f"- **GDS** có tỷ lệ {fp(ch['GDS']['rate'])}% nhưng sample rất nhỏ ({fi(ch['GDS']['bookings'])} booking) — cần thận trọng khi kết luận.",
        "- Phân tích riêng theo channel chưa phân tách được sự khác biệt **bên trong** từng market segment — cần Biểu đồ 11 để làm rõ.",
        "",
        "---",
        "",
        "### Biểu đồ 11: Heatmap `market_segment` × `distribution_channel`",
        "",
        "**Mô tả:** Trục X = distribution_channel, trục Y = market_segment, màu = `cancellation_rate` trung bình (%) của từng cặp (segment, channel). Ô trống (NaN) = không có booking cho cặp đó.",
        "",
        "**Ma trận cancellation rate (%)**",
        "",
        "| Market segment ↓ / Channel → | Direct | Corporate | TA/TO | GDS | Undefined |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for seg_name in ["Online TA", "Groups", "Offline TA/TO", "Direct", "Complementary", "Corporate", "Aviation", "Undefined"]:
        row = f"| {seg_name} |"
        for col in ["Direct", "Corporate", "TA/TO", "GDS", "Undefined"]:
            row += f" {hm_cell(hm_r, hm_v, seg_name, col)} |"
        lines.append(row)

    lines += [
        "",
        "*\\*Sample rất nhỏ (≤2 booking) — chỉ mang tính tham khảo.*",
        "",
        "**Ma trận volume (số booking)**",
        "",
        "| Market segment ↓ / Channel → | Direct | Corporate | TA/TO | GDS | Undefined |",
        "|---|---:|---:|---:|---:|---:|",
    ]
    for seg_name in ["Online TA", "Groups", "Offline TA/TO", "Direct", "Complementary", "Corporate", "Aviation", "Undefined"]:
        row = f"| {seg_name} |"
        for col in ["Direct", "Corporate", "TA/TO", "GDS", "Undefined"]:
            v = hm_v.get(seg_name, {}).get(col, 0) or 0
            if v == 0:
                row += " — |"
            elif v >= 1000:
                row += f" **{fi(v)}** |"
            else:
                row += f" {fi(v)} |"
        lines.append(row)

    ota_direct_rate = hm_r.get("Online TA", {}).get("Direct", 0)
    ota_direct_vol = hm_v.get("Online TA", {}).get("Direct", 0)
    corp_corp_rate = hm_r.get("Corporate", {}).get("Corporate", 0)
    corp_corp_vol = hm_v.get("Corporate", {}).get("Corporate", 0)
    groups_direct_rate = hm_r.get("Groups", {}).get("Direct", 0)

    lines += [
        "",
        "**Insight:**",
        "",
        f"- **Tổ hợp rủi ro cao nhất (volume lớn):** **Online TA × TA/TO** — {fi(ota_tato['ota_tato_vol'])} booking, tỷ lệ hủy **{fp(ota_tato['ota_tato_rate'])}%** (~{fi(est_cancel_ota)} booking hủy ước tính). Đây là ô \"đỏ\" lớn nhất trên heatmap, giải thích phần lớn cancellation toàn hệ thống.",
        f"- **Tổ hợp rủi ro cao thứ hai:** **Groups × TA/TO** — {fi(hm_v.get('Groups',{}).get('TA/TO',0))} booking, tỷ lệ hủy **{fp(ota_tato['groups_tato_rate'])}%** (cao hơn cả Online TA × TA/TO về mặt tỷ lệ).",
        f"- **Tổ hợp ổn định bất ngờ:** **Direct × TA/TO** — chỉ {fi(ota_tato['direct_tato_vol'])} booking nhưng tỷ lệ hủy **{fp(ota_tato['direct_tato_rate'])}%** (thấp nhất trong các ô có n≥50). Segment Direct đặt qua kênh TA/TO hành xử rất khác so với Online TA qua cùng kênh.",
        f"- **Online TA × Direct** — {fi(ota_direct_vol)} booking, tỷ lệ hủy **{fp(ota_direct_rate)}%**: khi Online TA chuyển sang kênh Direct, rủi ro giảm mạnh so với TA/TO ({fp(ota_tato['ota_tato_rate'])}% → {fp(ota_direct_rate)}%).",
        f"- **Corporate segment** ổn định trên mọi kênh có dữ liệu: Corporate × Corporate ({fi(corp_corp_vol)} booking, {fp(corp_corp_rate)}%), Corporate × Direct ({fp(hm_r.get('Corporate',{}).get('Direct',0))}%), Corporate × TA/TO ({fp(hm_r.get('Corporate',{}).get('TA/TO',0))}%) — đều dưới mức trung bình chung ({fp(RATE, 2)}%).",
        f"- **Offline TA/TO × TA/TO** — {fi(ota_tato['offline_tato_vol'])} booking (volume lớn thứ hai) nhưng tỷ lệ hủy chỉ **{fp(ota_tato['offline_tato_rate'])}%**, thấp hơn nhiều so với Online TA × TA/TO dù cùng kênh TA/TO → **market segment quan trọng hơn channel** trong việc giải thích hủy.",
        f"- **Groups × Direct** ({fi(hm_v.get('Groups',{}).get('Direct',0))} booking, {fp(groups_direct_rate)}%) cao hơn Groups × Corporate ({fp(hm_r.get('Groups',{}).get('Corporate',0))}%) — kênh Direct không luôn \"an toàn\" nếu segment vốn rủi ro cao.",
        "- **Aviation × TA/TO** (10 booking, 10,0%) và **Direct × GDS** (1 booking, 0%) — không đủ sample để kết luận.",
        "",
        "**Hàm ý chiến lược từ heatmap:**",
        "",
        f"- Rủi ro hủy không chỉ do kênh TA/TO mà do **sự giao thoa segment × channel** — cùng kênh TA/TO, Online TA ({fp(ota_tato['ota_tato_rate'])}%) và Offline TA/TO ({fp(ota_tato['offline_tato_rate'])}%) chênh lệch **~{fp(ota_tato['ota_tato_rate']-ota_tato['offline_tato_rate'], 0)} điểm %**.",
        "- Can thiệp nên **target theo ô cụ thể** (vd. Online TA + TA/TO + lead_time dài) thay vì penalize toàn bộ kênh TA/TO.",
        "- Feature interaction **`market_segment × distribution_channel`** là candidate mạnh cho mô hình predictive (Stage 2).",
        "",
        "---",
        "",
        "## Tổng hợp insight xuyên suốt (Biểu đồ 1–11)",
        "",
        "### Các yếu tố rủi ro hủy cao",
        "",
        f"1. **Lead time > 30 ngày** — tỷ lệ hủy tăng mạnh; >180 ngày đạt {fp(bins[4]['rate'])}%.",
        f"2. **No Deposit** — {fp(S['nd_pct'], 1)}% booking không cọc, tỷ lệ hủy ~{fp(dep['No Deposit']['rate'])}%.",
        f"3. **Online TA** — segment lớn nhất, tỷ lệ hủy ~{fp(seg['Online TA']['rate'])}%.",
        f"4. **Kênh TA/TO** — {fp(S['tato_pct'], 0)}% volume, tỷ lệ hủy ~{fp(ch['TA/TO']['rate'])}%.",
        f"5. **Online TA × TA/TO** (heatmap) — {fi(ota_tato['ota_tato_vol'])} booking, tỷ lệ hủy **{fp(ota_tato['ota_tato_rate'])}%** — ô rủi ro lớn nhất toàn dataset.",
        f"6. **Groups × TA/TO** — tỷ lệ hủy **{fp(ota_tato['groups_tato_rate'])}%**, cao nhất trong các ô có volume đáng kể.",
        "",
        "### Các yếu tố ổn định (hủy thấp)",
        "",
        f"1. **Lead time ≤ 30 ngày** — tỷ lệ hủy ~{fp(bins[0]['rate'])}%.",
        f"2. **Corporate segment** — tỷ lệ hủy ~{fp(seg['Corporate']['rate'])}%.",
        f"3. **Kênh Direct / Corporate** — tỷ lệ hủy ~{fp(ch['Direct']['rate'])}–{fp(ch['Corporate']['rate'])}%.",
        f"4. **Direct × TA/TO** — tỷ lệ hủy **{fp(ota_tato['direct_tato_rate'])}%** ({fi(ota_tato['direct_tato_vol'])} booking); **Online TA × Direct** — **{fp(ota_direct_rate)}%** ({fi(ota_direct_vol)} booking).",
        f"5. **Corporate × Corporate** — {fi(corp_corp_vol)} booking, tỷ lệ hủy **{fp(corp_corp_rate)}%** — segment + channel ổn định nhất theo volume.",
        "",
        "### Ma trận ưu tiên can thiệp",
        "",
        "| Mức ưu tiên | Tổ hợp đặc trưng | Lý do |",
        "|---|---|---|",
        f"| **Cao** | Online TA × TA/TO + lead_time > 60 ngày + No Deposit | ~{fi(ota_tato['ota_tato_vol']//1000)}k booking, cancel rate {fp(ota_tato['ota_tato_rate'])}%; impact lớn nhất toàn hệ thống |",
        f"| **Cao** | Groups × TA/TO + lead_time dài | Cancel rate {fp(ota_tato['groups_tato_rate'])}% — cao nhất các ô volume đáng kể |",
        f"| **Trung bình** | Offline TA/TO × TA/TO | Volume lớn ({fi(ota_tato['offline_tato_vol']//1000)}k) nhưng rate thấp hơn ({fp(ota_tato['offline_tato_rate'])}%) — theo dõi, chưa cần can thiệp mạnh |",
        "| **Thấp** | Corporate × Corporate / Direct × TA/TO + lead_time ngắn | Tỷ lệ hủy thấp, ít cần can thiệp khẩn |",
        "",
        "### Gợi ý hướng xử lý (Stage 2+)",
        "",
        "- **Revenue management:** áp dụng chính sách cọc/refund khác nhau theo lead_time bin (đặc biệt >30 và >180 ngày).",
        "- **Channel strategy:** thúc đẩy chuyển dịch từ TA/TO sang Direct cho segment có thể tiếp cận trực tiếp.",
        "- **Segment targeting:** ưu tiên giữ chân Online TA (overbooking policy, deposit, reminder) thay vì can thiệp đồng đều.",
        "- **Feature engineering (modeling):** `lead_time`, `deposit_type`, `market_segment`, `distribution_channel` và các interaction (`lead_time × deposit_type`, **`market_segment × distribution_channel`**) là candidate feature mạnh cho mô hình dự báo hủy.",
        "",
        "---",
        "",
        "## Phụ lục — Định nghĩa biểu đồ",
        "",
        "| # | Loại biểu đồ | Biến phân tích |",
        "|---|---|---|",
        "| 1 | Grouped + Stacked histogram | `lead_time_bin` × `is_canceled` |",
        "| 2 | Histogram + KDE (dual Y) | `lead_time` × `is_canceled` |",
        "| 3 | 2 subplot (histogram bin + KDE) | `lead_time` × `is_canceled` |",
        "| 4 | Boxplot + Violin | `is_canceled` → `lead_time` |",
        "| 5 | Line chart | `lead_time_bin` → cancellation_rate |",
        "| 6 | Bar chart | `deposit_type` → cancellation_rate |",
        "| 7 | Stacked bar 100% | `deposit_type` × `is_canceled` |",
        "| 8 | Horizontal bar | `market_segment` → cancellation_rate |",
        "| 9 | Dual-axis (bar + line) | `market_segment` → volume & rate |",
        "| 10 | Bar chart | `distribution_channel` → cancellation_rate |",
        "| 11 | Heatmap | `market_segment` × `distribution_channel` → cancellation_rate |",
        "",
        "---",
        "",
        f"*Tài liệu được tạo từ kết quả EDA trên `hotel_bookings_v4.csv`. Cập nhật lần cuối: {TODAY} — Stage 1 (key dedup mới, {fi(N)} booking).*",
    ]
    return "\n".join(lines)

# Remaining builder functions — merged into _generate_all_md.py

def compute_yoy_matrix():
    """Mean ADR by month x year (non-canceled, adr>0)."""
    try:
        import pandas as pd
    except ImportError:
        return None
    csv = ROOT.parent / "data" / "hotel_bookings_v5.csv"
    if not csv.exists():
        return None
    df = pd.read_csv(csv)
    df = df[(df["is_canceled"] == 0) & (df["adr"] > 0)]
    g = df.groupby(["arrival_date_month", "arrival_date_year"])["adr"].mean()
    months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ]
    years = sorted(df["arrival_date_year"].unique())
    mat = {}
    for m in months:
        mat[m] = {}
        for y in years:
            try:
                mat[m][int(y)] = float(g.loc[m, y])
            except KeyError:
                mat[m][int(y)] = None
    return mat, years


def build_stage2():
    adr = S["adr"]
    months = adr["months"]
    days = adr["days"]
    rooms = sorted(adr["rooms"], key=lambda x: -x["mean"])
    rm = adr["room_match"]
    customers = sorted(adr["customers"], key=lambda x: -x["mean"])
    ch = adr["cust_hotel"]
    aug = adr["aug_yoy"]
    yoy_data = compute_yoy_matrix()
    transient = next(c for c in adr["customers"] if c["type"] == "Transient")
    group = next(c for c in adr["customers"] if c["type"] == "Group")
    room_a = next(r for r in adr["rooms"] if r["type"] == "A")

    lines = [
        "# EDA Stage 2: ADR Analysis",
        "",
        "> **Nguồn dữ liệu:** `hotel_bookings_v5.csv` (tái tạo từ v4, thêm `day_of_week`)  ",
        f"> **Phạm vi:** {fi(ADR_N)} booking (không hủy, `adr > 0`) / {fi(N)} booking tổng | Mean ADR tổng thể: **{fe(MEAN_ADR)}**  ",
        "> **Notebook tham chiếu:** `eda_adr.ipynb`  ",
        "> **Cột mới trong v5:** `day_of_week` (parse từ `arrival_date_year` + `arrival_date_month` + `arrival_date_day_of_month`)",
        "",
        "---",
        "",
        "## Mục tiêu phân tích",
        "",
        "Giai đoạn EDA Stage 2 tập trung khám phá **Average Daily Rate (`adr`)** — mức giá phòng trung bình mỗi đêm — theo các chiều thời gian, sản phẩm phòng và phân khúc khách hàng: tháng đến (`arrival_date_month`), ngày trong tuần (`day_of_week`), loại phòng (`reserved_room_type` / `assigned_room_type`) và loại khách (`customer_type`). Mười một biểu đồ dưới đây được nhóm theo từng chiều phân tích, kèm insight có thể hành động được cho chiến lược **pricing** và **revenue management**.",
        "",
        "**Lưu ý phạm vi:** Chỉ phân tích booking **không hủy** (`is_canceled = 0`) và **ADR > 0** để phản ánh giá thực tế của các lưu trú hoàn tất. ADR là giá tại thời điểm đặt phòng, không phải giá theo loại phòng thực tế được gán.",
        "",
        "---",
        "",
        "## Nhóm 1 — Arrival month (Biểu đồ 1 → 3)",
        "",
        "### Biểu đồ 1: Box plot ADR theo `arrival_date_month`",
        "",
        "**Mô tả:** Trục X = tháng đến (Jan–Dec, sắp theo thứ tự lịch), trục Y = `adr`. Thể hiện median, IQR và outlier theo từng tháng.",
        "",
        "**Insight:**",
        "",
        "| Tháng | Bookings | Median ADR | Q1 | Q3 |",
        "|---|---:|---:|---:|---:|",
    ]
    month_short = {
        "January": "January", "February": "February", "March": "March",
        "April": "April", "May": "May", "June": "June", "July": "July",
        "August": "August", "September": "September", "October": "October",
        "November": "November", "December": "December",
    }
    for m in months:
        lines.append(
            f"| {month_short[m['month']]} | {fi(m['bookings'])} | {feur(m['median'])} | {feur(m['q1'])} | {feur(m['q3'])} |"
        )

    jan = next(x for x in months if x["month"] == "January")
    nov = next(x for x in months if x["month"] == "November")
    aug_m = next(x for x in months if x["month"] == "August")
    lines += [
        "",
        f"- **August** có median ADR cao nhất (**{feur(aug_m['median'])}**) và IQR rộng nhất (Q3 = {feur(aug_m['q3'])}) — tháng cao điểm mùa hè với biến động giá lớn.",
        f"- **January** và **November** là hai tháng thấp điểm (median ~{fp(jan['median'], 0)}–{fp(nov['median'], 0)} €) — cơ hội promotion / yield management trong mùa thấp.",
        "- IQR mở rộng rõ rệt từ **April** trở đi, phản ánh độ phân tán giá cao hơn trong mùa cao điểm.",
        "- Outlier xuất hiện ở mọi tháng, đặc biệt nhiều ở **July–August** — có thể là suite/premium hoặc booking đặc biệt.",
        "",
        "---",
        "",
        "### Biểu đồ 2: Line chart mean ADR theo tháng (± 1 std)",
        "",
        "**Mô tả:** Trục X = `arrival_date_month`, trục Y = mean(`adr`), vùng tô ± 1 std — thể hiện seasonality và độ không chắc chắn giá.",
        "",
        "**Insight:**",
        "",
        "| Tháng | Mean ADR | Std |",
        "|---|---:|---:|",
    ]
    for m in months:
        star = " **" if m["month"] == "August" else ""
        end = "**" if m["month"] == "August" else ""
        lines.append(f"|{star} {month_short[m['month']]} {end}| {feur(m['mean'])} | {feur(m['std'])} |")

    jan_m = jan["mean"]
    aug_mean = aug_m["mean"]
    pct_season = (aug_mean - jan_m) / jan_m * 100
    jun_m = next(x for x in months if x["month"] == "June")
    jul_m = next(x for x in months if x["month"] == "July")
    lines += [
        "",
        f"- **Seasonality rõ rệt:** mean ADR tăng từ **{feur(jan_m)}** (January) lên đỉnh **{feur(aug_mean)}** (August) — chênh lệch **~{fp(pct_season, 0)}%**, sau đó giảm dần về mùa thu-đông.",
        f"- **August** vừa có mean cao nhất vừa có std cao nhất (**{feur(aug_m['std'])}**) — pricing linh hoạt hơn trong tháng cao điểm.",
        f"- **Bước nhảy lớn nhất** xảy ra từ **June → July** (+{fe(jul_m['mean']-jun_m['mean'])} €) và **July → August** (+{fe(aug_mean-jul_m['mean'])} €) — ranh giới vào mùa cao điểm hè.",
        "- **Hàm ý pricing:** áp dụng rate ladder theo mùa; tăng giá mạnh từ tháng 4–5, peak pricing tháng 7–8, giảm dần từ tháng 10.",
        "",
        "---",
        "",
        "### Biểu đồ 3: Heatmap mean ADR theo `arrival_date_month` × `arrival_date_year`",
        "",
        "**Mô tả:** Trục X = năm đến, trục Y = tháng đến, màu = mean(`adr`). Phát hiện xu hướng year-over-year.",
        "",
        "**Ma trận mean ADR (€)**",
        "",
    ]
    if yoy_data:
        mat, years = yoy_data
        hdr = "| Tháng ↓ / Năm → |" + "|".join(f" {y} |" for y in years)
        lines += [hdr, "|---|" + "---:|" * len(years)]
        for mname in [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
        ]:
            row = f"| {mname} |"
            for y in years:
                v = mat[mname].get(int(y))
                row += f" {fe(v)} |" if v is not None else " — |"
            lines.append(row)
    else:
        lines.append("*(Ma trận YoY được tính từ notebook `eda_adr.ipynb`.)*")

    aug15, aug16, aug17 = aug["2015"], aug["2016"], aug["2017"]
    aug_growth = aug17 - aug15
    jul15 = yoy_data[0]["July"].get(2015) if yoy_data else None
    jul17 = yoy_data[0]["July"].get(2017) if yoy_data else None
    jul_growth = (jul17 - jul15) if jul15 and jul17 else 24.0

    lines += [
        "",
        "**Insight:**",
        "",
        "- Dataset bao phủ **2015 (Jul–Dec)**, **2016 (full year)** và **2017 (Jan–Aug)** — không đối xứng theo năm, cần thận trọng khi so sánh YoY.",
        f"- Xu hướng **tăng trưởng ADR** nhất quán qua các năm ở tháng có đủ dữ liệu: vd. **August** {fe(aug15)} → {fe(aug16)} → {fe(aug17)} (+{fe(aug_growth)} từ 2015 → 2017).",
        f"- **July** tăng **+{fe(jul_growth)}** (2015 → 2017) — mùa hè có growth mạnh.",
        "- Các tháng chỉ có 2016–2017 (Jan–Jun) đều cho thấy ADR 2017 cao hơn 2016 **~8–24 €** — áp lực tăng giá hoặc mix phòng tốt hơn.",
        "- **Hàm ý:** duy trì chiến lược tăng giá có kiểm soát ở mùa cao điểm; theo dõi YoY tại July–August làm benchmark chính.",
        "",
        "---",
        "",
        "## Nhóm 2 — Day of week (Biểu đồ 4 → 5)",
        "",
        "### Biểu đồ 4: Bar chart mean ADR theo `day_of_week`",
        "",
        "**Mô tả:** Trục X = ngày trong tuần (Mon → Sun), trục Y = mean(`adr`).",
        "",
        "**Insight:**",
        "",
        "| Ngày | Bookings | Mean ADR |",
        "|---|---:|---:|",
    ]
    day_order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    day_by = {d["day"]: d for d in days}
    fri = day_by["Friday"]
    tue = day_by["Tuesday"]
    wed = day_by["Wednesday"]
    for dname in day_order:
        d = day_by[dname]
        bold = "**" if dname == "Friday" else ""
        end = "**" if dname == "Friday" else ""
        lines.append(f"| {bold}{dname}{end} | {fi(d['bookings'])} | {feur(d['mean'])} |")

    mid = (tue["mean"] + wed["mean"]) / 2
    diff_weekend = fri["mean"] - mid
    pct_dow = diff_weekend / mid * 100
    mon = day_by["Monday"]
    lines += [
        "",
        f"- **Friday** có mean ADR cao nhất (**{feur(fri['mean'])}**), cao hơn **Tuesday/Wednesday** (~{fe(mid)}) khoảng **~{fe(diff_weekend)} €**.",
        "- **Tuesday** và **Wednesday** là ngày thấp nhất — phù hợp mid-week promotion.",
        f"- Chênh lệch mean ADR giữa các ngày **tương đối nhỏ** (~{fe(diff_weekend)} €, ~{fp(pct_dow, 1)}%) so với seasonality theo tháng — day-of-week ít quan trọng hơn month nhưng vẫn có thể tinh chỉnh giá cuối tuần.",
        f"- **Monday** có volume booking cao nhất ({fi(mon['bookings'])}) — khách business/leisure mix đầu tuần.",
        "",
        "---",
        "",
        "### Biểu đồ 5: Box plot ADR theo `day_of_week`",
        "",
        "**Mô tả:** Trục X = `day_of_week`, trục Y = `adr`. Bổ sung median, IQR và outlier mà bar chart không thể hiện.",
        "",
        "**Insight:**",
        "",
        "| Ngày | Median | Q1 | Q3 |",
        "|---|---:|---:|---:|",
    ]
    for dname in day_order:
        d = day_by[dname]
        lines.append(f"| {dname} | {feur(d['median'])} | {feur(d['q1'])} | {feur(d['q3'])} |")

    lines += [
        "",
        f"- **Friday** có median (**{feur(fri['median'])}**) và Q3 (**{feur(fri['q3'])}**) cao nhất — cuối tuần kéo phân phối giá lên phía trên.",
        f"- **Tuesday/Wednesday** có median thấp nhất (**{feur(tue['median'])}**) và Q1 thấp (~{fe(tue['q1'])}–{fe(wed['q1'])} €) — nhiều booking giá budget hơn giữa tuần.",
        "- Std deviation theo ngày tương đương nhau (~47–52 €) — độ phân tán tổng thể ổn định, khác biệt chủ yếu ở vị trí median.",
        "- **Hàm ý:** weekend premium nhẹ (+3–5 € median); weekday discount target Tuesday–Wednesday.",
        "",
        "---",
        "",
        "## Nhóm 3 — Room type (Biểu đồ 6 → 8)",
        "",
        "### Biểu đồ 6: Bar chart ngang mean ADR theo `reserved_room_type`",
        "",
        "**Mô tả:** Trục Y = loại phòng đặt (A–L), trục X = mean(`adr`), sắp giảm dần.",
        "",
        "**Insight (sắp theo mean ADR giảm dần):**",
        "",
        "| Room type | Bookings | Mean ADR |",
        "|---|---:|---:|",
    ]
    for r in rooms:
        star = " *" if r["type"] == "L" else ""
        bold = "**" if r["type"] == "H" else ""
        end = "**" if r["type"] == "H" else ""
        lines.append(f"| {bold}{r['type']}{end} | {fi(r['bookings'])} | {bold}{feur(r['mean'])}{end} |{star}")

    a_pct = room_a["bookings"] / ADR_N * 100
    d_room = next(r for r in adr["rooms"] if r["type"] == "D")
    lines += [
        "",
        "*\\*L chỉ 3 booking — không có ý nghĩa thống kê.*",
        "",
        "- **H** và **G** là hạng phòng premium (mean >180 €) nhưng volume nhỏ (~1,5k booking).",
        f"- **A** chiếm **~{fp(a_pct, 1)}%** booking phân tích ({fi(room_a['bookings'])}) với mean ADR thấp (**{feur(room_a['mean'])}**) — phòng standard kéo mean tổng thể xuống.",
        f"- **D** là hạng phổ biến thứ hai ({fi(d_room['bookings'])} booking, {feur(d_room['mean'])}) — đóng góp volume lớn ở phân khúc mid-range.",
        "- Gradient giá rõ: A/B (~91–93 €) → D/E (~120–124 €) → F/G/H (~166–185 €).",
        "",
        "---",
        "",
        "### Biểu đồ 7: Box plot ADR theo `room_match`",
        "",
        "**Mô tả:** Tạo `room_match = (reserved_room_type == assigned_room_type)`. Trục X = Khớp (True) / Không khớp (False), trục Y = `adr`.",
        "",
        "**Insight:**",
        "",
        "| room_match | Bookings | Mean ADR | Median ADR |",
        "|---|---:|---:|---:|",
        f"| **True** (khớp) | {fi(rm['true_n'])} ({fp(rm['true_pct'], 1)}%) | **{feur(rm['true_mean'])}** | {feur(rm['true_median'])} |",
        f"| **False** (không khớp) | {fi(rm['false_n'])} ({fp(rm['false_pct'], 1)}%) | **{feur(rm['false_mean'])}** | {feur(rm['false_median'])} |",
        "",
        f"- **{fp(rm['true_pct'], 1)}%** booking nhận đúng loại phòng đặt.",
        f"- Booking **không khớp** có mean ADR **thấp hơn {fe(rm['diff'])} €** so với booking khớp — ngược với giả định \"upgrade = ADR cao hơn\".",
        "- **Giải thích:** ADR phản ánh **giá lúc đặt**, không phải phòng thực tế nhận. Khách đặt phòng giá thấp (A, B) thường bị chuyển phòng (upgrade/downgrade) nhiều hơn; khách premium (F, G, H) thường được gán đúng phòng.",
        "- **Hàm ý vận hành:** room_match là chỉ số **operational** (fulfillment), không phải pricing; cần phân tích riêng upgrade vs downgrade nếu muốn đánh giá impact trải nghiệm khách.",
        "",
        "---",
        "",
        "### Biểu đồ 8: Heatmap mean ADR theo `reserved_room_type` × `hotel`",
        "",
        "**Mô tả:** Trục X = hotel (City Hotel / Resort Hotel), trục Y = `reserved_room_type`, màu = mean(`adr`).",
        "",
        "**Ma trận mean ADR (€)**",
        "",
        "| Room type ↓ / Hotel → | City Hotel | Resort Hotel |",
        "|---|---:|---:|",
    ]
    rh = E["room_hotel"]
    for rt in ["A", "B", "C", "D", "E", "F", "G", "H", "L"]:
        cv = rh["City Hotel"].get(rt)
        rv = rh["Resort Hotel"].get(rt)
        cs = fe(cv) if cv is not None else "—"
        rs = f"{fe(rv)} *" if rt == "L" and rv is not None else (fe(rv) if rv is not None else "—")
        lines.append(f"| {rt} | {cs} | {rs} |")

    lines += [
        "",
        "*\\*Sample rất nhỏ.*",
        "",
        "**Insight:**",
        "",
        f"- **City Hotel** định giá cao hơn ở hầu hết hạng phòng volume lớn: A ({fe(rh['City Hotel']['A'])} vs {fe(rh['Resort Hotel']['A'])}), D ({fe(rh['City Hotel']['D'])} vs {fe(rh['Resort Hotel']['D'])}), E ({fe(rh['City Hotel']['E'])} vs {fe(rh['Resort Hotel']['E'])}), F ({fe(rh['City Hotel']['F'])} vs {fe(rh['Resort Hotel']['F'])}), G ({fe(rh['City Hotel']['G'])} vs {fe(rh['Resort Hotel']['G'])}).",
        f"- **Resort Hotel** chỉ cao hơn ở **B** ({fe(rh['Resort Hotel']['B'])} vs {fe(rh['City Hotel']['B'])}) và **C** ({fe(rh['Resort Hotel']['C'])} vs {fe(rh['City Hotel']['C'])}) — có thể do mix sản phẩm/resort positioning khác.",
        f"- **H** chỉ xuất hiện ở Resort Hotel ({fe(rh['Resort Hotel']['H'])}) — suite premium đặc thù resort.",
        "- **Pricing strategy khác biệt rõ:** City Hotel premium hóa phòng standard/mid (A, D, E, F, G); Resort Hotel tập trung resort experience với giá thấp hơn ở phòng A nhưng cao ở C.",
        "- **Hàm ý:** không áp dụng cùng rate card cho hai khách sạn; cần benchmark theo từng cặp (room_type × hotel).",
        "",
        "---",
        "",
        "## Nhóm 4 — Customer type (Biểu đồ 9 → 11)",
        "",
        "### Biểu đồ 9: Bar chart mean ADR theo `customer_type`",
        "",
        "**Mô tả:** Trục X = customer_type (Transient, Transient-Party, Contract, Group), trục Y = mean(`adr`).",
        "",
        "**Insight:**",
        "",
        "| Customer type | Bookings | Mean ADR |",
        "|---|---:|---:|",
    ]
    for c in customers:
        pct = c["bookings"] / ADR_N * 100
        bold = "**" if c["type"] == "Transient" else ""
        end = "**" if c["type"] == "Transient" else ""
        lines.append(
            f"| {bold}{c['type']}{end} | {fi(c['bookings'])} ({fp(pct, 1)}%) | {bold}{feur(c['mean'])}{end} |"
        )

    diff_tg = transient["mean"] - group["mean"]
    pct_tg = diff_tg / group["mean"] * 100
    contract = next(c for c in adr["customers"] if c["type"] == "Contract")
    tparty = next(c for c in adr["customers"] if c["type"] == "Transient-Party")
    lines += [
        "",
        f"- **Transient** (khách lẻ) đóng góp ADR cao nhất (**{feur(transient['mean'])}**) và chiếm **~{fp(transient['bookings']/ADR_N*100, 1)}%** volume — segment chủ lực về doanh thu.",
        f"- **Group** có mean ADR thấp nhất (**{feur(group['mean'])}**) nhưng sample nhỏ ({fi(group['bookings'])}) — phù hợp kỳ vọng giá ưu đãi theo đoàn.",
        f"- Chênh lệch Transient vs Group: **~{fe(diff_tg)} €** (~{fp(pct_tg, 1)}%) — room for rate fencing giữa retail và group.",
        f"- **Contract** ({feur(contract['mean'])}) gần với Transient-Party — cả hai đều thấp hơn Transient ~{fe(transient['mean']-contract['mean'])}–{fe(transient['mean']-tparty['mean'])} €.",
        "",
        "---",
        "",
        "### Biểu đồ 10: Box plot ADR theo `customer_type`",
        "",
        "**Mô tả:** Trục X = `customer_type`, trục Y = `adr`. Phát hiện độ phân tán.",
        "",
        "**Insight:**",
        "",
        "| Customer type | Median | Q1 | Q3 |",
        "|---|---:|---:|---:|",
    ]
    cq = E["cust_quantiles"]
    for ctype in ["Transient", "Transient-Party", "Contract", "Group"]:
        q = cq[ctype]
        lines.append(f"| {ctype} | {feur(q['median'])} | {feur(q['q1'])} | {feur(q['q3'])} |")

    lines += [
        "",
        f"- **Transient** có median (**{feur(cq['Transient']['median'])}**) và Q3 (**{feur(cq['Transient']['q3'])}**) cao nhất — phân khúc có khả năng chi trả cao nhất.",
        f"- **Group** có median thấp nhất (**{feur(cq['Group']['median'])}**) và Q1 thấp (**{feur(cq['Group']['q1'])}**) — tập trung booking giá budget, nhưng Q3 vẫn đạt {feur(cq['Group']['q3'])} (có booking group premium).",
        f"- **Transient-Party** phân bố tương tự Contract — cả hai thấp hơn Transient ~{fe(cq['Transient']['median']-cq['Transient-Party']['median'])}–{fe(cq['Transient']['median']-cq['Contract']['median'])} € ở median.",
        "- Outlier xuất hiện ở mọi segment — cơ hội upsell/cross-sell đặc biệt ở Transient.",
        "",
        "---",
        "",
        "### Biểu đồ 11: Grouped bar mean ADR theo `customer_type` × `hotel`",
        "",
        "**Mô tả:** Trục X = `customer_type`, nhóm màu = hotel, trục Y = mean(`adr`).",
        "",
        "**Insight:**",
        "",
        "| Customer type | City Hotel | Resort Hotel | Chênh lệch (City − Resort) |",
        "|---|---:|---:|---:|",
    ]
    for ctype in ["Transient", "Transient-Party", "Contract", "Group"]:
        city_v = ch[ctype]["City Hotel"]
        resort_v = ch[ctype]["Resort Hotel"]
        diff = city_v - resort_v
        city_cell = f"**{feur(city_v)}**" if ctype in ("Transient", "Contract") else feur(city_v)
        diff_cell = f"**+{fe(diff)} €**" if ctype == "Contract" else f"+{fe(diff)} €"
        lines.append(f"| {ctype} | {city_cell} | {feur(resort_v)} | {diff_cell} |")

    contract_diff = ch["Contract"]["City Hotel"] - ch["Contract"]["Resort Hotel"]
    lines += [
        "",
        f"- **City Hotel** có mean ADR cao hơn Resort ở **mọi** customer_type — phù hợp với mean tổng (City {feur(adr['city_mean'])} vs Resort {feur(adr['resort_mean'])}).",
        f"- Chênh lệch lớn nhất ở **Contract** (+{fe(contract_diff)} €) — corporate rate tại City Hotel premium hơn đáng kể.",
        f"- **Transient** tại City Hotel đạt **{feur(ch['Transient']['City Hotel'])}** — cao nhất trong toàn bộ ma trận (volume lớn: {fi(transient['bookings'])} booking).",
        f"- Resort Hotel thấp hơn ở Transient (**{feur(ch['Transient']['Resort Hotel'])}**) nhưng vẫn là segment ADR cao thứ hai toàn hệ thống.",
        "- **Hàm ý:** pricing theo segment × hotel; không dùng chung rate cho Contract giữa City và Resort (chênh ~30 €).",
        "",
        "---",
        "",
        "## Tổng hợp insight xuyên suốt (Biểu đồ 1–11)",
        "",
        "### Các yếu tố ADR cao",
        "",
        f"1. **Mùa cao điểm (July–August)** — mean ADR {fe(jul_m['mean'])}–{fe(aug_mean)}, median lên {fp(jul_m['median'], 0)}–{fp(aug_m['median'], 0)} €.",
        "2. **Cuối tuần (Friday–Saturday)** — mean ADR ~108–110 €, cao hơn mid-week ~5 €.",
        "3. **Hạng phòng premium (G, H, F)** — mean ADR 166–185 €.",
        f"4. **Transient tại City Hotel** — mean **{feur(ch['Transient']['City Hotel'])}**, volume lớn nhất.",
        f"5. **City Hotel** nhìn chung — mean **{feur(adr['city_mean'])}** vs Resort **{feur(adr['resort_mean'])}** (+{fe(adr['city_resort_diff'])} €).",
        "",
        "### Các yếu tố ADR thấp",
        "",
        f"1. **Mùa thấp điểm (January, November)** — mean ADR ~{fe(jan_m)}–{fe(nov['mean'])}.",
        "2. **Mid-week (Tuesday–Wednesday)** — mean ~103,5 €.",
        "3. **Phòng standard (A, B)** — mean ~91–93 €, chiếm ~65% booking.",
        "4. **Group / Contract** — mean ~88–93 €.",
        f"5. **Booking không khớp phòng** — mean **{feur(rm['false_mean'])}** (thấp hơn khớp phòng {fe(rm['diff'])} €).",
        "",
        "### Ma trận ưu tiên pricing",
        "",
        "| Mức ưu tiên | Tổ hợp đặc trưng | Hành động gợi ý |",
        "|---|---|---|",
        "| **Cao** | August + City Hotel + Transient + Room F/G | Peak rate, hạn chế discount |",
        "| **Cao** | July–August + Resort + Room H/C | Premium resort pricing |",
        "| **Trung bình** | April–June + weekday + Room D/E | Shoulder season ladder |",
        "| **Thấp** | Jan/Nov + Tuesday + Group/Contract + Room A | Promotion, package deal |",
        "",
        "### Gợi ý hướng xử lý (Stage 3+)",
        "",
        "- **Dynamic pricing:** rate calendar theo month (seasonality) × day_of_week × room_type × hotel.",
        "- **Segment strategy:** bảo vệ margin Transient; rate fence riêng cho Group/Contract (đặc biệt tại City Hotel).",
        "- **Product mix:** upsell từ A → D/E trong mùa cao; phát triển premium tier (G, H) tại Resort.",
        "- **Feature engineering (modeling):** `arrival_date_month`, `day_of_week`, `reserved_room_type`, `customer_type`, `hotel` và các interaction (`month × hotel`, `customer_type × hotel`, `room_type × hotel`) là candidate feature mạnh cho mô hình dự báo ADR/revenue.",
        "",
        "---",
        "",
        "## Phụ lục — Định nghĩa biểu đồ",
        "",
        "| # | Loại biểu đồ | Biến phân tích |",
        "|---|---|---|",
        "| 1 | Box plot | `arrival_date_month` → `adr` |",
        "| 2 | Line chart + error band (±1 std) | `arrival_date_month` → mean(`adr`) |",
        "| 3 | Heatmap | `arrival_date_month` × `arrival_date_year` → mean(`adr`) |",
        "| 4 | Bar chart | `day_of_week` → mean(`adr`) |",
        "| 5 | Box plot | `day_of_week` → `adr` |",
        "| 6 | Horizontal bar | `reserved_room_type` → mean(`adr`) |",
        "| 7 | Box plot | `room_match` → `adr` |",
        "| 8 | Heatmap | `reserved_room_type` × `hotel` → mean(`adr`) |",
        "| 9 | Bar chart | `customer_type` → mean(`adr`) |",
        "| 10 | Box plot | `customer_type` → `adr` |",
        "| 11 | Grouped bar | `customer_type` × `hotel` → mean(`adr`) |",
        "",
        "---",
        "",
        f"*Tài liệu được tạo từ kết quả EDA trên `hotel_bookings_v5.csv`. Cập nhật lần cuối: {TODAY} — Stage 2 (v5 tái tạo từ v4 + day_of_week, {fi(ADR_N)} booking ADR).*",
    ]
    return "\n".join(lines)


# build_summary, build_correlation, build_hypothesis, build_guide, write_all

def build_summary():
    seg = seg_dict()
    ch = ch_dict()
    dep = dep_dict()
    bins = S["lead_time"]["bins"]
    ota = S["heatmap"]
    est_ota = int(ota["ota_tato_vol"] * ota["ota_tato_rate"] / 100)
    adr = S["adr"]
    ch_adr = adr["cust_hotel"]
    aug = adr["aug_yoy"]
    aug_growth = aug["2017"] - aug["2015"]
    jan_m = next(m for m in adr["months"] if m["month"] == "January")
    aug_m = next(m for m in adr["months"] if m["month"] == "August")
    transient = next(c for c in adr["customers"] if c["type"] == "Transient")
    group = next(c for c in adr["customers"] if c["type"] == "Group")
    room_a = next(r for r in adr["rooms"] if r["type"] == "A")
    rm = adr["room_match"]
    lt_jump = bins[1]["rate"] - bins[0]["rate"]
    ota_offline_gap = ota["ota_tato_rate"] - ota["offline_tato_rate"]

    return f"""# EDA Tổng hợp — Key Findings & Hành động đề xuất

> **Nguồn:** Kết hợp [EDA Stage 1 — Cancellation Analysis](EDA%20Stage%201%20-%20Cancellation%20Analysis.md) và [EDA Stage 2 — ADR Analysis](EDA%20Stage%202%20-%20ADR.md)  
> **Dữ liệu:** `hotel_bookings_v4.csv` (Stage 1) · `hotel_bookings_v5.csv` (Stage 2, tái tạo từ v4 + `day_of_week`)  
> **Notebook:** `eda_cancellation.ipynb` · `eda_adr.ipynb`  
> **Phạm vi:** {fi(N)} booking | {fi(CANCELED)} hủy (**{fp(RATE, 2)}%**) | {fi(ADR_N)} lưu trú thành công (ADR > 0) | Mean ADR **{fe(MEAN_ADR)}**

---

## 1. Bức tranh tổng quan

Hai giai đoạn EDA bổ sung cho nhau hai góc nhìn cốt lõi của **Revenue Management**:

| Góc nhìn | Stage 1 — Cancellation | Stage 2 — ADR |
|---|---|---|
| **Câu hỏi** | Booking nào *không* materialize? | Booking nào *mang giá trị* cao nhất? |
| **Chỉ số** | Tỷ lệ hủy (`is_canceled`) | Average Daily Rate (`adr`) |
| **Biến phân tích** | lead_time, deposit_type, market_segment, distribution_channel | arrival_month, day_of_week, room_type, customer_type, hotel |
| **Số biểu đồ** | 11 | 11 |

**Thông điệp chính:** Rủi ro hủy và cơ hội doanh thu **không phân bố đồng đều** — cùng một booking có thể vừa là nguồn doanh thu lớn (ADR cao, mùa cao điểm) vừa là rủi ro hủy cao (Online TA, lead_time dài, không cọc). Chiến lược hiệu quả cần **target theo tổ hợp đặc trưng**, không áp dụng chính sách một kiểu cho toàn bộ portfolio.

```mermaid
quadrantChart
    title Ma trận chiến lược (khái niệm)
    x-axis Thấp rủi ro hủy --> Cao rủi ro hủy
    y-axis Thấp ADR --> Cao ADR
    quadrant-1 Bảo vệ & tối đa hóa
    quadrant-2 Giữ chân + cọc
    quadrant-3 Duy trì / tăng volume
    quadrant-4 Cân nhắc hạn chế / repricing
    Corporate x Corporate: [0.15, 0.55]
    Transient City Aug: [0.35, 0.95]
    Online TA x TA/TO: [0.85, 0.65]
    Group x TA/TO: [0.90, 0.40]
    Jan Nov Room A: [0.25, 0.15]
```

---

## 2. Key findings — Stage 1 (Cancellation)

### 2.1 Số liệu nền

- **{fp(RATE, 2)}%** booking bị hủy — gần **1/3** demand không chuyển thành lưu trú.
- **{fp(S['nd_pct'], 1)}%** booking là **No Deposit** → rủi ro hủy mang tính hệ thống.
- **{fp(S['tato_pct'], 1)}%** booking qua kênh **TA/TO** (tỷ lệ hủy **{fp(ch['TA/TO']['rate'])}%**).

### 2.2 Findings theo chiều phân tích

| Chiều | Phát hiện chính | Số liệu đáng chú ý |
|---|---|---|
| **Lead time** | Rủi ro hủy tăng **monotonic** theo thời gian đặt trước | 0–30 ngày: **{fp(bins[0]['rate'], 0)}%** → >180 ngày: **{fp(bins[4]['rate'], 0)}%**; bước nhảy lớn nhất sau **30 ngày** (+{fp(lt_jump, 1)} pp) |
| **Deposit** | Không cọc = rủi ro cao ở quy mô lớn | No Deposit: **{fp(dep['No Deposit']['rate'])}%** cancel ({fi(dep['No Deposit']['bookings'])} booking); Non Refund: **{fp(dep['Non Refund']['rate'])}%** ({fi(dep['Non Refund']['bookings'])} booking, volume nhỏ) |
| **Market segment** | Online TA = segment lớn nhất **và** rủi ro cao nhất | {fi(seg['Online TA']['bookings'])} booking, cancel **{fp(seg['Online TA']['rate'])}%**; Corporate thấp nhất: **{fp(seg['Corporate']['rate'])}%** |
| **Distribution channel** | TA/TO chiếm ~{fp(S['tato_pct'], 0)}% volume, cancel cao nhất | TA/TO **{fp(ch['TA/TO']['rate'])}%** vs Direct **{fp(ch['Direct']['rate'])}%**, Corporate **{fp(ch['Corporate']['rate'])}%** |
| **Segment × Channel** | Rủi ro do **giao thoa**, không chỉ do kênh | Online TA × TA/TO: **{fi(ota['ota_tato_vol'])}** booking, **{fp(ota['ota_tato_rate'])}%**; Groups × TA/TO: **{fp(ota['groups_tato_rate'])}%**; Offline TA/TO × TA/TO cùng kênh nhưng chỉ **{fp(ota['offline_tato_rate'])}%** |

### 2.3 Insight then chốt — Cancellation

1. **Ngưỡng 30 ngày lead_time** là ranh giới phân loại rủi ro quan trọng nhất.
2. **Online TA × TA/TO** là ô rủi ro lớn nhất toàn hệ thống (~{fi(est_ota)} booking hủy ước tính).
3. **Market segment quan trọng hơn channel** trong việc giải thích hủy (cùng TA/TO, Online vs Offline chênh ~{fp(ota_offline_gap, 0)} pp).
4. **Corporate / Direct** là các tổ hợp ổn định — ít cần can thiệp khẩn cấp.

---

## 3. Key findings — Stage 2 (ADR)

### 3.1 Số liệu nền

- Mean ADR toàn portfolio (lưu trú thành công): **{fe(MEAN_ADR)}**.
- **City Hotel** mean **{fe(adr['city_mean'])}** vs **Resort Hotel** **{fe(adr['resort_mean'])}** (+{fe(adr['city_resort_diff'])}).
- **Transient** chiếm **{fp(transient['bookings']/ADR_N*100, 1)}%** booking và có ADR cao nhất (**{fe(transient['mean'])}**).

### 3.2 Findings theo chiều phân tích

| Chiều | Phát hiện chính | Số liệu đáng chú ý |
|---|---|---|
| **Tháng đến** | Seasonality rõ — mùa hè peak | August mean **{fe(aug_m['mean'])}** (median {fp(aug_m['median'], 0)} €); January **{fe(jan_m['mean'])}**; YoY August +{fe(aug_growth)} (2015→2017) |
| **Day of week** | Cuối tuần premium nhẹ | Friday cao nhất **{fe(next(d for d in adr['days'] if d['day']=='Friday')['mean'])}**; Tue/Wed thấp nhất ~103,5 € (~5 € chênh) |
| **Room type** | Gradient giá rõ theo hạng phòng | H **{fe(next(r for r in adr['rooms'] if r['type']=='H')['mean'], 0)}**, G **{fe(next(r for r in adr['rooms'] if r['type']=='G')['mean'], 0)}**, A **{fe(room_a['mean'])}** ({fp(room_a['bookings']/ADR_N*100, 0)}% volume); room_match **{fp(rm['true_pct'], 1)}%** |
| **Room match** | Không khớp phòng ≠ ADR cao hơn | Khớp: **{fe(rm['true_mean'])}** vs Không khớp: **{fe(rm['false_mean'])}** (−{fe(rm['diff'])}) |
| **Room × Hotel** | Pricing strategy khác biệt giữa 2 khách sạn | City premium ở A/D/E/F/G; Resort cao hơn ở B/C |
| **Customer type** | Transient dẫn dắt doanh thu | Transient **{fe(transient['mean'], 0)}** vs Group **{fe(group['mean'])}**; City Transient **{fe(ch_adr['Transient']['City Hotel'])}** |
| **Customer × Hotel** | City cao hơn mọi segment | Contract chênh lớn nhất: City **{fe(ch_adr['Contract']['City Hotel'])}** vs Resort **{fe(ch_adr['Contract']['Resort Hotel'])}** (+{fe(ch_adr['Contract']['City Hotel']-ch_adr['Contract']['Resort Hotel'])}) |

### 3.3 Insight then chốt — ADR

1. **Seasonality theo tháng** là driver ADR mạnh nhất (chênh ~{fp((aug_m['mean']-jan_m['mean'])/jan_m['mean']*100, 0)}% Jan→Aug), mạnh hơn day-of-week (~5%).
2. **City Hotel + Transient + mùa cao điểm** là tổ hợp doanh thu cao nhất.
3. **Phòng A** chiếm volume lớn nhưng kéo ADR xuống — cơ hội upsell A→D/E.
4. **Rate card phải tách theo hotel × segment × room** — không dùng giá chung.

---

## 4. Insight xuyên suốt (Stage 1 × Stage 2)

### 4.1 Nghịch lý và cơ hội

| Hiện tượng | Cancellation | ADR | Hàm ý chiến lược |
|---|---|---|---|
| **Online TA / TA/TO** | Cancel cao ({fp(seg['Online TA']['rate'])}–{fp(ota['groups_tato_rate'])}%), volume cực lớn | Transient ADR cao ({fe(transient['mean'], 0)}) | Segment *vừa lớn vừa giá trị* nhưng *rủi ro hủy cao* → ưu tiên deposit + overbooking policy |
| **Groups** | Cancel **{fp(ota['groups_tato_rate'])}%** (Groups × TA/TO) | ADR thấp nhất (**{fe(group['mean'])}**) | Double penalty: vừa dễ hủy vừa margin thấp → điều kiện hợp đồng chặt, cọc theo lead_time |
| **Corporate / Contract** | Cancel thấp (~{fp(seg['Corporate']['rate'])}%) | ADR trung bình (~{fe(next(c for c in adr['customers'] if c['type']=='Contract')['mean'])} ) nhưng City Contract **{fe(ch_adr['Contract']['City Hotel'])}** | Segment ổn định, đáng giữ — nhưng rate khác biệt lớn City vs Resort |
| **Lead time dài + mùa cao** | Cancel >{fp(bins[3]['rate'], 0)}–{fp(bins[4]['rate'], 0)}% | ADR peak {fe(jan_m['mean'])}–{fe(aug_m['mean'])} (Jul–Aug) | Mỗi booking hủy mùa hè = mất **~130–150 €/đêm** → ROI cao khi giảm hủy |
| **No Deposit** | {fp(S['nd_pct'], 1)}% booking, cancel {fp(dep['No Deposit']['rate'])}% | — | Chính sách cọc là lever lớn nhất chưa được khai thác |
| **Phòng A (standard)** | — (volume lớn → impact hủy lớn) | {fp(room_a['bookings']/ADR_N*100, 0)}% booking, ADR ~{fe(room_a['mean'], 0)} | Tập trung retention + upsell; promotion ở Jan/Nov |

### 4.2 Ma trận ưu tiên tích hợp (Rủi ro hủy × Giá trị ADR)

| Ưu tiên | Tổ hợp | Cancel risk | ADR | Chiến lược |
|:---:|---|:---:|:---:|---|
| 🔴 **P1** | Online TA × TA/TO + lead_time >60 ng + Jul–Aug | Rất cao | Rất cao | Cọc bắt buộc, reminder, overbooking có kiểm soát, rate fence |
| 🔴 **P1** | Groups × TA/TO + lead_time dài | Rất cao | Thấp | Hợp đồng nhóm chặt, attrition clause, cọc tăng dần theo lead_time |
| 🟠 **P2** | Transient × City × Aug × Room F/G | Trung bình | Rất cao | Peak pricing, hạn chế OTA discount, inventory protection |
| 🟠 **P2** | No Deposit + lead_time >30 (toàn hệ thống) | Cao | Hỗn hợp | Tiered deposit policy theo lead_time bin |
| 🟡 **P3** | Offline TA/TO × TA/TO | Trung bình | Trung bình | Theo dõi, A/B test cọc nhẹ |
| 🟢 **P4** | Corporate × Corporate + lead_time ngắn | Thấp | Trung bình–cao (City) | Duy trì quan hệ, ưu đãi loyalty |
| 🟢 **P4** | Jan/Nov + Room A + Group/Contract | Thấp–TB | Thấp | Promotion, package, fill rate |

### 4.3 Ba tension cần cân bằng

1. **Volume vs Margin:** Online TA/TA/TO mang volume nhưng cancel cao; Transient City mang margin cao.
2. **Fill rate vs ADR:** Jan/Nov cần promotion (ADR ~{fe(jan_m['mean'])}) nhưng không nên ảnh hưởng rate fence mùa cao.
3. **Operational vs Pricing:** room_match ({fp(rm['true_pct'], 0)}% khớp) là vấn đề fulfillment; ADR phản ánh giá đặt — upgrade/downgrade cần quản lý riêng khỏi pricing.

---

## 5. Hành động đề xuất

### 5.1 Ngắn hạn (0–3 tháng) — Quick wins

| # | Hành động | Mục tiêu | Dựa trên |
|---|---|---|---|
| 1 | **Triển khai cọc tiered theo lead_time** (>30 ng: cọc 1 đêm; >180 ng: cọc 2 đêm hoặc non-refundable partial) | Giảm cancel ở bin rủi ro cao | Stage 1: bước nhảy cancel sau 30 ngày |
| 2 | **Review chính sách Online TA × TA/TO** — yêu cầu cọc, cutoff modification | Giảm ~{fi(est_ota//1000)}k booking hủy ước tính/năm | Stage 1: ô rủi ro lớn nhất |
| 3 | **Rate calendar mùa cao điểm** — tăng giá Jul–Aug, đặc biệt City + Transient + F/G | Tối đa hóa ADR peak (+40–80 € vs thấp điểm) | Stage 2: August {fe(aug_m['mean'])} |
| 4 | **Weekend premium nhẹ** (+3–5 € Fri–Sat) | Tăng RevPAR cuối tuần | Stage 2: Friday +6 € vs mid-week |
| 5 | **Promotion targeted Jan/Nov** — Room A, Group/Contract, mid-week | Cải thiện occupancy mùa thấp | Stage 2: ADR ~{fe(jan_m['mean'])}; Stage 1: cancel thấp hơn ở segment ổn định |

### 5.2 Trung hạn (3–6 tháng) — Chiến lược

| # | Hành động | Mục tiêu |
|---|---|---|
| 6 | **Rate fence riêng City vs Resort** theo customer_type × room_type | Tránh underpricing Contract tại City (+30 € gap) |
| 7 | **Upsell path A → D/E** trong mùa cao (Apr–Aug) | Tăng ADR trên {fp(room_a['bookings']/ADR_N*100, 0)}% volume phòng standard |
| 8 | **Group booking policy** — cọc, attrition, lead_time cap | Giảm cancel Groups × TA/TO ({fp(ota['groups_tato_rate'])}%) |
| 9 | **Channel shift pilot** — chuyển Online TA sang Direct (cancel {fp(ota['ota_tato_rate'])}% → {fp(HM_R.get('Online TA',{}).get('Direct',5.6))}% ở sample nhỏ) | Giảm dependency TA/TO ({fp(S['tato_pct'], 0)}% volume) |
| 10 | **Dashboard theo dõi** cancel rate + ADR theo segment × channel × month | Ra quyết định data-driven liên tục |

### 5.3 Dài hạn (6–12 tháng) — Modeling & hệ thống

| # | Hành động | Output kỳ vọng |
|---|---|---|
| 11 | **Mô hình dự báo cancellation** — features: lead_time, deposit, segment × channel, lead_time × deposit | Xác suất hủy theo booking → dynamic deposit |
| 12 | **Mô hình dự báo ADR / revenue** — features: month, day_of_week, room_type × hotel, customer_type × hotel | Optimal price recommendation |
| 13 | **Integrated RM system** — kết hợp cancel probability × expected ADR = **expected revenue at risk** | Prioritize inventory protection theo giá trị thực |
| 14 | **Theo dõi YoY ADR** tại July–August làm KPI pricing | Duy trì growth (+{fe(aug_growth)} YoY đã quan sát) |

---

## 6. KPI đề xuất theo dõi

| KPI | Baseline (EDA) | Mục tiêu gợi ý |
|---|---|---|
| Tỷ lệ hủy tổng thể | {fp(RATE, 2)}% | < 24% (12 tháng) |
| Cancel rate Online TA × TA/TO | {fp(ota['ota_tato_rate'])}% | < 30% |
| Cancel rate lead_time >180 ngày | {fp(bins[4]['rate'])}% | < 35% |
| Tỷ lệ booking No Deposit | {fp(S['nd_pct'], 1)}% | < 85% (có cọc tiered) |
| Mean ADR (lưu trú thành công) | {fe(MEAN_ADR)} | +5–8% YoY |
| Mean ADR August | {fe(aug_m['mean'])} | Duy trì premium, std kiểm soát |
| Mean ADR January | {fe(jan_m['mean'])} | Cải thiện occupancy, ADR ≥ 75 € |
| Tỷ lệ room_match | {fp(rm['true_pct'], 1)}% | ≥ 85% |
| ADR Transient City Hotel | {fe(ch_adr['Transient']['City Hotel'])} | Bảo vệ margin, không discount OTA mùa cao |

---

## 7. Lộ trình triển khai gợi ý

```
Giai đoạn 1 (Tháng 1–2)     Giai đoạn 2 (Tháng 3–4)     Giai đoạn 3 (Tháng 5–8)
─────────────────────       ─────────────────────       ─────────────────────
✓ Cọc tiered lead_time      ✓ Rate fence City/Resort    ✓ Peak pricing Jul–Aug
✓ Review Online TA policy   ✓ Upsell A→D/E              ✓ Cancel model v1
✓ Dashboard KPI cơ bản      ✓ Group policy mới          ✓ ADR model v1
                            ✓ Channel shift pilot       ✓ Integrated RM
```

---

## 8. Kết luận

Hai giai đoạn EDA cho thấy bài toán Revenue Management của portfolio này **không phải chọn giữa giảm hủy hay tăng giá** — mà phải **target chính xác** các tổ hợp nơi rủi ro hủy và giá trị ADR giao nhau:

- **Bảo vệ doanh thu mùa cao** (Jul–Aug, City, Transient, premium room) bằng cọc và inventory control — vì mỗi booking hủy ở đây tổn thất ~130–150 €/đêm.
- **Kiểm soát rủi ro hủy hệ thống** (Online TA × TA/TO, lead_time >30 ng, No Deposit) — đây là lever impact lớn nhất trên ~{fp(RATE, 0)}% cancel rate tổng thể.
- **Tối ưu mùa thấp** (Jan/Nov, Room A) bằng promotion có chọn lọc — cải thiện fill rate mà không erode rate fence mùa cao.

Bước tiếp theo tự nhiên là **Stage 3 — Predictive Modeling**: xây dựng mô hình cancellation và ADR/revenue, sử dụng các feature và interaction đã xác định qua 22 biểu đồ EDA, để chuyển từ insight mô tả sang **quyết định tự động hóa**.

---

## Phụ lục — Tham chiếu nhanh

| Tài liệu | Nội dung | Biểu đồ |
|---|---|:---:|
| [EDA Stage 1 — Cancellation](EDA%20Stage%201%20-%20Cancellation%20Analysis.md) | lead_time, deposit, segment, channel | 11 |
| [EDA Stage 2 — ADR](EDA%20Stage%202%20-%20ADR.md) | month, day_of_week, room_type, customer_type | 11 |

---

*Tài liệu tổng hợp từ EDA Stage 1 & Stage 2. Cập nhật lần cuối: {TODAY} — Executive Summary (key dedup mới, {fi(N)} booking).*"""


def pearson_rows():
    p = S["corr"]["pearson"]
    labels = [
        ("revenue", "⚠️ Leakage — hậu quả của hủy"),
        ("lead_time", "Đặt trước xa → hủy cao hơn"),
        ("required_car_parking_spaces", "Kế hoạch cụ thể → ít hủy"),
        ("Occupancy_Rate", "⚠️ Biến tổng hợp"),
        ("total_of_special_requests", "Cam kết cao → ít hủy"),
        ("adr", "Confounded (segment/OTA)"),
        ("booking_changes", "Hướng nhân quả không rõ"),
        ("is_repeated_guest", "Khách quen → ít hủy"),
        ("arrival_date_year", "Xu hướng thời gian"),
        ("RevPAR", "⚠️ Biến tổng hợp"),
        ("stays_in_week_nights", "Confounded (Groups)"),
        ("total_nights", "Confounded"),
        ("adults", "Proxy loại booking"),
        ("children", "Yếu"),
        ("previous_bookings_not_canceled", "Yếu"),
        ("stays_in_weekend_nights", "Yếu"),
        ("previous_cancellations", "Lịch sử hủy (Spearman mạnh hơn: +0,12)"),
        ("babies", "Không đáng kể"),
        ("days_in_waiting_list", "Không đáng kể"),
        ("agent", "Không đáng kể"),
        ("arrival_date_day_of_month", "Không đáng kể"),
        ("arrival_date_week_number", "Không đáng kể"),
    ]
    rows = []
    for key, note in labels:
        v = p[key]
        rows.append(f"| `{key}` | {fr(v)} | {fr(abs(v))} | {note} |")
    return "\n".join(rows)


def build_correlation():
    p = S["corr"]["pearson"]
    sp = S["corr"]["spearman"]
    cr = S["corr"]["cramers"]
    dep = dep_dict()
    seg = seg_dict()
    ch = ch_dict()
    lt_p = E["lt_partial"]
    dep_p = E["dep_partial"]
    ota = S["heatmap"]

    spearman_top = [
        ("revenue", "Phi tuyến mạnh do khối lượng revenue = 0 khi hủy"),
        ("lead_time", f"Cao hơn Pearson ({fr(p['lead_time'])}) → quan hệ monotonic, có thể phi tuyến"),
        ("required_car_parking_spaces", "Ổn định với Pearson"),
        ("total_of_special_requests", "Ổn định"),
        ("adr", "Ổn định"),
        ("previous_cancellations", f"Mạnh hơn Pearson ({fr(p['previous_cancellations'])}) — hiệu ứng ở đuôi phân bố"),
        ("booking_changes", f"Mạnh hơn Pearson ({fr(p['booking_changes'])})"),
    ]

    cram_rows = [
        ("reservation_status", "100,0", "100,0", 3, "⚠️ Leakage"),
        ("reservation_status_date", fr(cr["reservation_status_date"]), "100,0", 925, "⚠️ Hậu quả"),
        ("market_segment", f"**{fr(cr['market_segment'])}**", "87,1", 8, "Online TA vs Corporate chênh ~23 pp"),
        ("country", fr(cr["country"]), "100,0", 178, "Nhiều nước sample < 5 — spurious"),
        ("deposit_type", f"**{fr(cr['deposit_type'])}**", "67,4", 3, "Lever chính sách"),
        ("distribution_channel", f"**{fr(cr['distribution_channel'])}**", "66,2", 5, "TA/TO vs Corporate"),
        ("customer_type", fr(cr["customer_type"]), "20,5", 4, "Transient vs Group"),
        ("assigned_room_type", fr(cr["assigned_room_type"]), "98,5", 12, "Có thể gán sau đặt phòng"),
        ("arrival_date_month", fr(cr["arrival_date_month"]), "10,8", 12, "Seasonality — confounded"),
        ("hotel", fr(cr["hotel"]), "6,6", 2, "City vs Resort"),
        ("meal", fr(cr["meal"]), "17,8", 5, "Yếu–trung bình"),
        ("reserved_room_type", fr(cr["reserved_room_type"]), "72,9", 10, "Sample nhỏ ở một số loại"),
        ("day_of_week", fr(cr["day_of_week"]), "6,3", 7, "Không đáng kể"),
    ]

    cust = {d["customer_type"]: d for d in S["customer_cancel"]}
    hotel = {d["hotel"]: d for d in S["hotel_cancel"]}

    return f"""# Correlation Analysis: `is_canceled` vs tất cả biến

> **Nguồn dữ liệu:** `hotel_bookings_v5.csv` (tái tạo từ v4 + `day_of_week`)  
> **Phạm vi:** {fi(N)} booking | Tỷ lệ hủy tổng thể: **{fp(RATE, 2)}%** ({fi(CANCELED)} booking bị hủy)  
> **Notebook tham chiếu:** `Correlation_matrix_is_canceled.ipynb`  
> **Bổ sung EDA:** [EDA Stage 1 — Cancellation Analysis](EDA%20Stage%201%20-%20Cancellation%20Analysis.md)

---

## Mục tiêu phân tích

Báo cáo này đo mức độ **tương quan thống kê** giữa biến mục tiêu `is_canceled` và toàn bộ 35 biến còn lại trong dataset, sau đó phân loại từng biến theo khả năng **nhân quả (causation)** so với **tương quan giả / leakage / confounding**.

**Phương pháp:**

| Loại biến | Metric | Ghi chú |
|---|---|---|
| Số (22 biến) | **Pearson** r | Tuyến tính; thêm Spearman để kiểm tra phi tuyến |
| Phân loại (13 biến) | **Cramér's V** | Đo mức liên kết với biến nhị phân `is_canceled` |
| Kiểm tra confounding | **Partial correlation** | Kiểm soát `deposit_type` ↔ `lead_time` |

> **Lưu ý quan trọng:** Correlation ≠ Causation. Tương quan cao chỉ cho biết hai biến đồng biến; để gọi là nguyên nhân cần thỏa thứ tự thời gian, cơ chế hợp lý và khả năng can thiệp.

---

## 1. Tổng quan kết quả

### 1.1 Top biến tương quan mạnh nhất (sau khi loại leakage)

| Hạng | Biến | Metric | Giá trị | Hướng |
|:---:|---|:---:|:---:|---|
| 1 | `lead_time` | Pearson r | **{fr(p['lead_time'])}** | Dài hơn → hủy nhiều hơn |
| 2 | `required_car_parking_spaces` | Pearson r | **{fr(p['required_car_parking_spaces'])}** | Cần chỗ đậu xe → ít hủy |
| 3 | `total_of_special_requests` | Pearson r | **{fr(p['total_of_special_requests'])}** | Nhiều yêu cầu đặc biệt → ít hủy |
| 4 | `market_segment` | Cramér's V | **{fr(cr['market_segment'])}** | Segment khác nhau → hủy khác nhau |
| 5 | `adr` | Pearson r | **{fr(p['adr'])}** | Giá cao hơn một chút ở booking hủy |
| 6 | `deposit_type` | Cramér's V | **{fr(cr['deposit_type'])}** | Loại cọc liên quan mạnh đến hủy |
| 7 | `distribution_channel` | Cramér's V | **{fr(cr['distribution_channel'])}** | Kênh OTA hủy cao hơn Direct |
| 8 | `customer_type` | Cramér's V | **{fr(cr['customer_type'])}** | Transient hủy nhiều hơn Contract |

### 1.2 Biến leakage — loại khỏi modeling

| Biến | Metric | Giá trị | Lý do loại |
|---|---|:---:|---|
| `reservation_status` | Cramér's V | **1,000** | Gần như là nhãn của hủy (`Canceled` = 100%) |
| `reservation_status_date` | Cramér's V | {fr(cr['reservation_status_date'])} | Ngày ghi nhận trạng thái — xảy ra **sau** hủy |
| `revenue` | Pearson r | **{fr(p['revenue'])}** | `revenue = adr × total_nights × (1 − is_canceled)` — tương quan cơ học |
| `Occupancy_Rate` | Pearson r | {fr(p['Occupancy_Rate'])} | Biến tổng hợp theo thời gian |
| `RevPAR` | Pearson r | {fr(p['RevPAR'])} | Biến tổng hợp derived |

Xác minh công thức `revenue`: **{fp(S['corr']['revenue_match_pct'], 1)}%** dòng khớp `adr × total_nights × (1 − is_canceled)`.

---

## 2. Tương quan biến số (Pearson & Spearman)

### 2.1 Bảng đầy đủ — Pearson với `is_canceled`

| Biến | Pearson r | |r| | Diễn giải nhanh |
|---|:---:|:---:|---|
{pearson_rows()}

**Quy ước đọc |r|:** < 0,1 yếu · 0,1–0,3 trung bình · > 0,3 mạnh (không tính biến leakage).

### 2.2 Spearman — top 10 (kiểm tra phi tuyến)

| Biến | Spearman ρ | Ghi chú so với Pearson |
|---|:---:|---|
{chr(10).join(f"| `{k}` | {fr(sp[k])} | {note} |" for k, note in spearman_top)}

---

## 3. Tương quan biến phân loại (Cramér's V)

| Biến | Cramér's V | Spread tỷ lệ hủy | Số nhóm | Ghi chú |
|---|:---:|:---:|:---:|---|
{chr(10).join(f"| `{name}` | {v} | {spread} pp | {n} | {note} |" for name, v, spread, n, note in cram_rows)}

### 3.1 Chi tiết nhóm phân loại quan trọng

**`deposit_type`**

| Loại cọc | Booking | Tỷ lệ hủy |
|---|---:|---:|
| Non Refund | {fi(dep['Non Refund']['bookings'])} | **{fp(dep['Non Refund']['rate'])}%** |
| Refundable | {fi(dep['Refundable']['bookings'])} | {fp(dep['Refundable']['rate'])}% |
| No Deposit | {fi(dep['No Deposit']['bookings'])} | **{fp(dep['No Deposit']['rate'])}%** |

- **{fp(S['nd_pct'], 1)}%** booking là No Deposit → rủi ro hủy mang tính hệ thống.
- Non Refund {fp(dep['Non Refund']['rate'])}% hủy cần diễn giải thận trọng: có thể **reverse causality** (booking rủi ro cao mới bị gán non-refundable) hoặc cách ghi nhận dữ liệu.

**`market_segment`** (sắp theo tỷ lệ hủy)

| Segment | Booking | Tỷ lệ hủy |
|---|---:|---:|
{chr(10).join(f"| {d['market_segment']} | {fi(d['bookings'])} | **{fp(d['rate'])}%** |" if d['market_segment'] in ('Online TA','Groups','Corporate') else f"| {d['market_segment']} | {fi(d['bookings'])} | {fp(d['rate'])}% |" for d in sorted(S['segment'], key=lambda x: -x['rate']))}

**`distribution_channel`**

| Kênh | Booking | Tỷ lệ hủy |
|---|---:|---:|
| TA/TO | {fi(ch['TA/TO']['bookings'])} | **{fp(ch['TA/TO']['rate'])}%** |
| GDS | {fi(ch['GDS']['bookings'])} | {fp(ch['GDS']['rate'])}% |
| Direct | {fi(ch['Direct']['bookings'])} | **{fp(ch['Direct']['rate'])}%** |
| Corporate | {fi(ch['Corporate']['bookings'])} | **{fp(ch['Corporate']['rate'])}%** |

**`customer_type`**

| Loại khách | Booking | Tỷ lệ hủy |
|---|---:|---:|
| Transient | {fi(cust['Transient']['bookings'])} | **{fp(cust['Transient']['rate'])}%** |
| Contract | {fi(cust['Contract']['bookings'])} | {fp(cust['Contract']['rate'])}% |
| Transient-Party | {fi(cust['Transient-Party']['bookings'])} | {fp(cust['Transient-Party']['rate'])}% |
| Group | {fi(cust['Group']['bookings'])} | **{fp(cust['Group']['rate'])}%** |

**`hotel`**

| Khách sạn | Booking | Tỷ lệ hủy |
|---|---:|---:|
| City Hotel | {fi(hotel['City Hotel']['bookings'])} | **{fp(hotel['City Hotel']['rate'])}%** |
| Resort Hotel | {fi(hotel['Resort Hotel']['bookings'])} | **{fp(hotel['Resort Hotel']['rate'])}%** |

---

## 4. Partial Correlation — kiểm tra confounding

Kiểm soát một biến khi đo tương quan còn lại giữa hai biến khác:

| Cặp biến | Kiểm soát | r thô | r partial | Kết luận |
|---|---|:---:|:---:|---|
| `lead_time` ↔ `is_canceled` | `deposit_type` | {fr(p['lead_time'])} | **{fr(lt_p)}** | Vẫn dương mạnh — không chỉ do confounding với cọc |
| `deposit_type` ↔ `is_canceled` | `lead_time` | — | **{fr(dep_p)}** | Vẫn có hiệu ứng sau khi kiểm soát lead_time |

→ Cả **`lead_time`** và **`deposit_type`** đều là candidate causation độc lập, không chỉ đồng biến do biến thứ ba.

---

## 5. Phân loại Causation vs Correlation

```mermaid
flowchart LR
    subgraph T1["Tier 1 — Causation cao"]
        A[lead_time]
        B[deposit_type]
    end
    subgraph T2["Tier 2 — Causation TB"]
        C[market_segment]
        D[distribution_channel]
        E[previous_cancellations]
        F[total_of_special_requests]
        G[required_car_parking_spaces]
        H[is_repeated_guest]
    end
    subgraph T3["Tier 3 — Confounded"]
        I[adr / hotel / customer_type]
    end
    subgraph L["Leakage — Không dùng"]
        J[reservation_status / revenue]
    end
    T1 --> X[is_canceled]
    T2 --> X
    T3 --> X
    X --> L
```

### 5.1 Tier 1 — Causation cao (ưu tiên can thiệp chính sách)

| Biến | Metric | Cơ chế nhân quả | Hành động gợi ý |
|---|---|---|---|
| **`lead_time`** | r = {fr(p['lead_time'])} | Đặt xa → nhiều biến cố → hủy tăng. EDA: {fp(S['lead_time']['bins'][0]['rate'], 0)}% (≤30 ngày) → {fp(S['lead_time']['bins'][4]['rate'], 0)}% (>180 ngày) | Cọc tiered theo lead_time; reminder trước ngày đến |
| **`deposit_type`** | V = {fr(cr['deposit_type'])} | Chi phí hủy thay đổi theo chính sách cọc | Mở rộng cọc cho segment rủi ro cao (hiện {fp(S['nd_pct'], 1)}% No Deposit) |

### 5.2 Tier 2 — Causation trung bình (feature model + can thiệp gián tiếp)

| Biến | Metric | Cơ chế | Ghi chú |
|---|---|---|---|
| **`market_segment`** | V = {fr(cr['market_segment'])} | Hành vi khác nhau theo segment (OTA vs Corporate) | Kết hợp với channel: **Online TA × TA/TO = {fp(ota['ota_tato_rate'])}%** |
| **`distribution_channel`** | V = {fr(cr['distribution_channel'])} | OTA cho phép hủy dễ hơn Direct | TA/TO {fp(ch['TA/TO']['rate'])}% vs Direct {fp(ch['Direct']['rate'])}% |
| **`previous_cancellations`** | r = {fr(p['previous_cancellations'])} (ρ = {fr(sp['previous_cancellations'])}) | Lịch sử hủy dự báo hành vi tương lai | Behavioral signal |
| **`total_of_special_requests`** | r = {fr(p['total_of_special_requests'])} | Yêu cầu cụ thể = cam kết cao | Scoring risk |
| **`required_car_parking_spaces`** | r = {fr(p['required_car_parking_spaces'])} | Kế hoạch chuyến đi cụ thể | Scoring risk |
| **`is_repeated_guest`** | r = {fr(p['is_repeated_guest'])} | Loyalty → ít hủy | Retention lever |

### 5.3 Tier 3 — Confounded (tương quan có, nhân quả chưa chắc)

| Biến | Vấn đề |
|---|---|
| `adr` | Giá cao ở booking hủy do mix Online TA + lead_time dài, không phải giá *gây* hủy |
| `customer_type`, `hotel` | Gắn với segment và kênh phân phối |
| `booking_changes` | Hai chiều: đổi vì sắp hủy hoặc đổi vì đã cam kết |
| `stays_in_week_nights`, `total_nights`, `adults` | Proxy cho Groups/segment |
| `arrival_date_month` | Mùa cao điểm ↔ mix OTA |
| `country`, `assigned_room_type`, `reserved_room_type` | Sample nhỏ hoặc thời điểm gán không rõ |

### 5.4 Tier 4 — Tương quan yếu (ít giá trị dự báo)

`agent`, `days_in_waiting_list`, `babies`, `children`, `day_of_week`, `meal`, `arrival_date_year`, `arrival_date_week_number`, `arrival_date_day_of_month`, `previous_bookings_not_canceled`, `stays_in_weekend_nights`

### 5.5 Leakage — tuyệt đối không dùng làm feature

`reservation_status`, `reservation_status_date`, `revenue`, `Occupancy_Rate`, `RevPAR`

---

## 6. Ma trận ưu tiên Feature cho Predictive Modeling

| Ưu tiên | Feature | Lý do |
|:---:|---|---|
| **P1** | `lead_time` | Causation mạnh nhất; partial corr vẫn {fr(lt_p)} sau kiểm soát deposit |
| **P1** | `deposit_type` | Lever chính sách trực tiếp |
| **P1** | `market_segment` × `distribution_channel` | Interaction mạnh hơn từng biến riêng (EDA Stage 1) |
| **P2** | `previous_cancellations`, `is_repeated_guest` | Behavioral history |
| **P2** | `total_of_special_requests`, `required_car_parking_spaces` | Tín hiệu cam kết |
| **P3** | `customer_type`, `hotel`, `adr` | Có giá trị nhưng confounded — dùng kèm regularization |
| **Loại** | `reservation_status`, `revenue`, `Occupancy_Rate`, `RevPAR` | Data leakage |

---

## 7. Kết luận

### 7.1 Insight then chốt

1. Trong 35 biến phân tích, chỉ **~8 biến** có cơ sở hợp lý để coi là **nguyên nhân tiềm năng** của hủy phòng.
2. **`lead_time`** và **`deposit_type`** là hai lever nhân quả mạnh nhất và **có thể can thiệp** trực tiếp bằng chính sách revenue management.
3. **`market_segment`** và **`distribution_channel`** giải thích nhiều variance nhất trong nhóm phân loại (V ≈ 0,15–0,22), nhưng một phần là proxy hành vi — nên dùng **interaction** thay vì từng biến riêng.
4. **`revenue`** (r = {fr(p['revenue'])}) và **`reservation_status`** (V = 1,0) là **leakage** — tuyệt đối loại khỏi mô hình dự báo.
5. Phần lớn biến còn lại có |r| < 0,1 hoặc V < 0,1 — đóng góp dự báo hạn chế nếu không kết hợp engineering (binning `lead_time`, interaction segment × channel).

### 7.2 Liên kết với EDA Stage 1

| Phát hiện Correlation | Khớp EDA Stage 1 |
|---|---|
| `lead_time` r = {fr(p['lead_time'])} | Monotonic {fp(S['lead_time']['bins'][0]['rate'], 0)}% → {fp(S['lead_time']['bins'][4]['rate'], 0)}%; ngưỡng 30 ngày |
| `deposit_type` V = {fr(cr['deposit_type'])} | No Deposit {fp(S['nd_pct'], 1)}% volume, {fp(dep['No Deposit']['rate'])}% cancel |
| `market_segment` V = {fr(cr['market_segment'])} | Online TA {fp(seg['Online TA']['rate'])}% vs Corporate {fp(seg['Corporate']['rate'])}% |
| `distribution_channel` V = {fr(cr['distribution_channel'])} | TA/TO {fp(ch['TA/TO']['rate'])}% vs Direct {fp(ch['Direct']['rate'])}% |
| Interaction segment × channel | Online TA × TA/TO: {fi(ota['ota_tato_vol'])} booking, {fp(ota['ota_tato_rate'])}% |

### 7.3 Bước tiếp theo

- **Feature engineering:** `lead_time_bin` (ngưỡng 30/60/180 ngày), `market_segment × distribution_channel`, `lead_time × deposit_type`
- **Modeling:** `Cancellation_Prediction_Model_v1.ipynb` — Logistic Regression / Random Forest với feature Tier 1–2, loại leakage
- **Đánh giá:** SHAP/feature importance để xác nhận directionality sau khi fit model

---

## Phụ lục — Biểu đồ trong notebook

| # | Loại biểu đồ | Nội dung |
|---|---|---|
| 1 | Horizontal bar | Pearson r biến số vs `is_canceled` |
| 2 | Horizontal bar | Cramér's V biến phân loại |
| 3 | Heatmap | Ma trận Pearson đầy đủ (20 biến số) |
| 4 | Heatmap 1 cột | Tổng hợp tất cả biến vs `is_canceled` |
| 5 | Stacked bar theo tier | Phân loại Causation vs Correlation |
| 6 | Bảng | Partial correlation `lead_time` ↔ `deposit_type` |

---

*Tài liệu được tạo từ kết quả phân tích trên `hotel_bookings_v5.csv`. Cập nhật lần cuối: {TODAY} — Correlation Analysis (key dedup mới, {fi(N)} booking).*"""


# build_hypothesis, build_guide, write_all

def build_hypothesis():
    hyp = S["hyp"]
    logit = E["logit"]
    bins = S["lead_time"]["bins"]
    dep = dep_dict()
    h1 = hyp["h1"]

    seg_rows = "\n".join(
        f"| {d['market_segment']} | {fi(d['bookings'])} | "
        + (f"**{fp(d['rate'])}%**" if d["market_segment"] in ("Online TA", "Groups", "Corporate") else f"{fp(d['rate'])}%")
        + " |"
        for d in sorted(S["segment"], key=lambda x: -x["rate"])
    )
    bin_rows = "\n".join(
        f"| {lbl} | {fi(b['total'])} | **{fp(b['rate'])}%** |"
        for lbl, b in zip(
            ["0–30 ngày", "31–60 ngày", "61–90 ngày", "91–180 ngày", ">180 ngày"],
            bins,
        )
    )

    return f"""# Kiểm định giả thuyết: Ảnh hưởng đến `is_canceled`

> **Nguồn dữ liệu:** `hotel_bookings_v5.csv` (tái tạo từ v4 + `day_of_week`)  
> **Phạm vi:** {fi(N)} booking | Tỷ lệ hủy tổng thể: **{fp(RATE, 2)}%** (~{fi(CANCELED)} booking bị hủy)  
> **Notebook tham chiếu:** `hypothesis.ipynb`  
> **Mức ý nghĩa:** α = 0,05

---

## Mục tiêu

Kiểm định thống kê xem ba biến **`lead_time`**, **`deposit_type`** và **`market_segment`** có ảnh hưởng đến xác suất hủy phòng (`is_canceled`) hay không, bằng các test phù hợp với kiểu dữ liệu từng biến. Bổ sung mô hình **logistic regression** đa biến để đánh giá đồng thời khi đã kiểm soát các yếu tố còn lại.

---

## Tóm tắt phương pháp

| Biến | Kiểu dữ liệu | Test chính | Effect size | Mục đích |
|------|--------------|------------|-------------|----------|
| `lead_time` | Số (liên tục, lệch phải) | Mann-Whitney U | Rank-biserial *r* + bootstrap CI | So sánh phân bố lead_time giữa booking hủy / không hủy |
| `lead_time` (bin) | Phân loại (5 nhóm) | Chi-squared | Cramér's V | Kiểm tra tỷ lệ hủy khác nhau theo nhóm lead_time |
| `deposit_type` | Phân loại (3 mức) | Chi-squared | Cramér's V | Kiểm tra độc lập giữa loại cọc và trạng thái hủy |
| `market_segment` | Phân loại (8 mức) | Chi-squared | Cramér's V | Kiểm tra độc lập giữa phân khúc và trạng thái hủy |
| 3 biến đồng thời | Hỗn hợp | Logistic regression | Odds ratio, Pseudo R² | Mô hình đa biến + LR test |

**Lưu ý phương pháp:** Với *n* ≈ {fi(N)}, p-value rất dễ nhỏ hơn α ngay cả khi chênh lệch nhỏ — cần đọc kết quả kèm **effect size** (rank-biserial *r*, Cramér's V, OR).

---

## Kết quả tổng hợp

| Giả thuyết | Biến | Test | p-value | Effect size | Kết luận (α = 0,05) |
|---|---|---|---|---:|---|
| H1 | `lead_time` | Mann-Whitney U | ≈ 0 | \\|r\\| = {fr(h1['rbiserial'])} | **Bác bỏ H₀** |
| H1b | `lead_time_bin` | Chi-squared | ≈ 0 | V = {fr(hyp['h1b']['cramers_v'])} | **Bác bỏ H₀** |
| H2 | `deposit_type` | Chi-squared | ≈ 0 | V = {fr(hyp['h2']['cramers_v'])} | **Bác bỏ H₀** |
| H3 | `market_segment` | Chi-squared | ≈ 0 | V = {fr(hyp['h3']['cramers_v'])} | **Bác bỏ H₀** |
| H4 | 3 biến đồng thời | Logistic (LR test) | ≈ 0 | Pseudo R² = {fr(logit['pseudo_r2'])} | **Bác bỏ H₀** |

---

## H1 — `lead_time` (Mann-Whitney U)

**H₀:** Phân bố `lead_time` giống nhau giữa booking hủy và không hủy.  
**H₁:** Hai phân bố khác nhau.

| Thống kê | Giá trị |
|---|---:|
| U statistic | {fi(int(h1['u']))} |
| p-value | ≈ 0 |
| Rank-biserial *r* | {fr(h1['rbiserial'])} |
| Median — không hủy | {int(h1['median_not'])} ngày |
| Median — đã hủy | {int(h1['median_cancel'])} ngày |
| Mean — không hủy | {fp(h1['mean_not'], 1)} ngày |
| Mean — đã hủy | {fp(h1['mean_cancel'], 1)} ngày |

**Diễn giải:**

- Booking **đã hủy** có `lead_time` cao hơn rõ rệt: median gấp **~{h1['median_cancel']/h1['median_not']:.1f} lần** ({int(h1['median_cancel'])} vs {int(h1['median_not'])} ngày).
- Effect size \\|r\\| = {fr(h1['rbiserial'])} → mức ảnh hưởng **trung bình** (theo quy ước \\|r\\| ≈ 0,1 / 0,3 / 0,5 cho nhỏ / TB / lớn).
- Bootstrap 95% CI cho chênh median (hủy − không hủy) dương và không chứa 0 → xác nhận chênh lệch có ý nghĩa thực tế.

**Kết luận:** Bác bỏ H₀ — `lead_time` có association với `is_canceled`; đặt trước càng xa ngày đến, rủi ro hủy càng cao.

---

## H1b — `lead_time_bin` (Chi-squared)

**H₀:** Nhóm lead_time bin và `is_canceled` độc lập.  
**H₁:** Tỷ lệ hủy khác nhau giữa các bin.

| Thống kê | Giá trị |
|---|---:|
| χ² | {fe(hyp['h1b']['chi2'], 1)} |
| df | {hyp['h1b']['dof']} |
| p-value | ≈ 0 |
| Cramér's V | {fr(hyp['h1b']['cramers_v'])} |
| Min expected count | {fe(hyp['h1b']['min_expected'], 1)} |

**Tỷ lệ hủy theo bin:**

| Lead time bin | Booking | Tỷ lệ hủy |
|---|---:|---:|
{bin_rows}

**Diễn giải:**

- Bước nhảy lớn nhất: từ bin **0–30** ({fp(bins[0]['rate'], 0)}%) lên **31–60** ({fp(bins[1]['rate'], 0)}%) — gần **gấp đôi**.
- Tỷ lệ hủy tăng dần theo bin; Cramér's V = {fr(hyp['h1b']['cramers_v'])} → association **trung bình–khá** (mạnh nhất trong các test chi-squared trên lead_time).

**Kết luận:** Bác bỏ H₀ — nhóm lead_time có ảnh hưởng đến tỷ lệ hủy.

---

## H2 — `deposit_type` (Chi-squared)

**H₀:** `deposit_type` và `is_canceled` độc lập.  
**H₁:** Có association giữa loại cọc và tỷ lệ hủy.

| Thống kê | Giá trị |
|---|---:|
| χ² | {fe(hyp['h2']['chi2'], 1)} |
| df | {hyp['h2']['dof']} |
| p-value | ≈ 0 |
| Cramér's V | {fr(hyp['h2']['cramers_v'])} |
| Min expected count | {fe(hyp['h2']['min_expected'], 1)} |

**Tỷ lệ hủy theo loại cọc:**

| Loại cọc | Booking | Tỷ lệ hủy |
|---|---:|---:|
| Non Refund | {fi(dep['Non Refund']['bookings'])} | **{fp(dep['Non Refund']['rate'])}%** |
| Refundable | {fi(dep['Refundable']['bookings'])} | {fp(dep['Refundable']['rate'])}% |
| No Deposit | {fi(dep['No Deposit']['bookings'])} | **{fp(dep['No Deposit']['rate'])}%** |

**Diễn giải:**

- **{fp(S['nd_pct'], 1)}%** booking là *No Deposit* → rủi ro hủy mang tính hệ thống ở nhóm không cọc.
- *Non Refund* có tỷ lệ hủy {fp(dep['Non Refund']['rate'])}% cần diễn giải thận trọng: có thể **reverse causality** (booking rủi ro cao mới bị gán non-refundable) hoặc do cách ghi nhận dữ liệu — không nên coi là tác động nhân quả đơn thuần.
- Ô *Refundable* (n = {fi(dep['Refundable']['bookings'])}) có expected count thấp → kết quả chi-squared tổng thể vẫn hợp lệ nhưng post-hoc cho nhóm này cần thận trọng.

**Kết luận:** Bác bỏ H₀ — `deposit_type` liên quan đến `is_canceled` (V = {fr(hyp['h2']['cramers_v'])}, mức trung bình).

---

## H3 — `market_segment` (Chi-squared)

**H₀:** `market_segment` và `is_canceled` độc lập.  
**H₁:** Có association giữa phân khúc thị trường và tỷ lệ hủy.

| Thống kê | Giá trị |
|---|---:|
| χ² | {fe(hyp['h3']['chi2'], 1)} |
| df | {hyp['h3']['dof']} |
| p-value | ≈ 0 |
| Cramér's V | {fr(hyp['h3']['cramers_v'])} |
| Min expected count | {fe(hyp['h3']['min_expected'], 2)} |

**Tỷ lệ hủy theo segment (sắp giảm dần):**

| Segment | Booking | Tỷ lệ hủy |
|---|---:|---:|
{seg_rows}

**Diễn giải:**

- Cramér's V = {fr(hyp['h3']['cramers_v'])} → association **mạnh nhất** trong ba biến phân loại.
- **Online TA** chiếm ~{fp(S['ota_pct'], 0)}% booking và có tỷ lệ hủy cao nhất trong các segment lớn ({fp(seg_dict()['Online TA']['rate'])}%).
- **Corporate** có tỷ lệ hủy thấp nhất ({fp(seg_dict()['Corporate']['rate'])}%) trong nhóm có sample đủ lớn.
- Segment *Undefined* (n = 2) có expected count rất thấp → standardized residual không đáng tin cậy cho nhóm này.

**Kết luận:** Bác bỏ H₀ — `market_segment` ảnh hưởng đến tỷ lệ hủy.

---

## H4 — Logistic Regression đa biến

**Mô hình:** `is_canceled ~ lead_time + deposit_type + market_segment`  
**Baseline:** `deposit_type = No Deposit`, `market_segment = Direct`

| Thống kê mô hình | Giá trị |
|---|---:|
| n | {fi(logit['n'])} |
| Pseudo R² (McFadden) | {fr(logit['pseudo_r2'])} |
| LR χ² (vs null) | {fe(logit['lr_chi2'], 1)} |
| df | 10 |
| p-value (LR test) | ≈ 0 |

**Hệ số đáng chú ý (p < 0,05):**

| Biến | OR (95% CI gần đúng) | Diễn giải |
|---|---|---|
| `lead_time` (+1 ngày) | {fr(logit['lt_or_1day'], 3)} | Mỗi thêm 1 ngày đặt trước → odds hủy tăng ~0,5% |
| `lead_time` (+30 ngày) | **{fr(logit['lt_or_30day'], 3)}** | Mỗi thêm 30 ngày → odds hủy tăng ~15,8% |
| `deposit_type_Non Refund` | Rất cao | Mạnh liên quan hủy (cần diễn giải thận trọng) |
| `market_segment_Online TA` | > 1 | Xác suất hủy cao hơn baseline Direct |
| `market_segment_Offline TA/TO` | < 1 | Xác suất hủy thấp hơn Direct |
| `market_segment_Corporate` | < 1 | Xác suất hủy thấp hơn Direct |
| `market_segment_Groups` | < 1 | Xác suất hủy thấp hơn Direct |

**Biến không có ý nghĩa (p ≥ 0,05):** `deposit_type_Refundable`, `market_segment_Complementary`, `market_segment_Direct` (đã là baseline ẩn), `market_segment_Undefined`.

**Diễn giải:**

- Mô hình giải thích **~{fp(logit['pseudo_r2']*100, 1)}%** biến thiên log-likelihood (Pseudo R²) — hợp lý với bài toán hành vi khách hàng phức tạp; còn nhiều yếu tố chưa đưa vào mô hình.
- Sau khi kiểm soát `deposit_type` và `market_segment`, **`lead_time` vẫn có ý nghĩa** → không phải confounding đơn giản từ hai biến còn lại.
- LR test bác bỏ mô hình null → ít nhất một predictor trong mô hình có giá trị.

**Kết luận:** Bác bỏ H₀ tổng thể — cả ba nhóm biến đều đóng góp vào dự đoán hủy trong mô hình đa biến.

---

## So sánh effect size

| Test | Biến | Metric | Giá trị | Xếp hạng tương đối |
|---|---|---:|---:|---|
| Mann-Whitney U | `lead_time` | \\|rank-biserial r\\| | {fr(h1['rbiserial'])} | Cao |
| Chi-squared | `lead_time_bin` | Cramér's V | {fr(hyp['h1b']['cramers_v'])} | Cao |
| Chi-squared | `market_segment` | Cramér's V | {fr(hyp['h3']['cramers_v'])} | **Cao nhất (phân loại)** |
| Chi-squared | `deposit_type` | Cramér's V | {fr(hyp['h2']['cramers_v'])} | Trung bình |
| Logistic | 3 biến | Pseudo R² | {fr(logit['pseudo_r2'])} | Mô hình tổng hợp |

---

## Kết luận chung

1. **`lead_time`** — Booking hủy có thời gian đặt trước dài hơn đáng kể; rủi ro tăng mạnh sau **30 ngày** và tiếp tục tăng theo bin.
2. **`deposit_type`** — Liên quan thống kê rõ đến hủy; *Non Refund* gắn với tỷ lệ hủy cực cao nhưng cần phân tích nhân quả thêm.
3. **`market_segment`** — Ảnh hưởng mạnh nhất trong các biến phân loại; **Online TA** là nguồn rủi ro hủy chính, **Corporate** tương đối ổn định.
4. **Mô hình đa biến** xác nhận cả ba biến vẫn có ý nghĩa (hoặc đóng góp) khi kiểm soát lẫn nhau.

---

## Khuyến nghị hành động

| Ưu tiên | Hành động | Cơ sở từ kiểm định |
|---|---|---|
| Cao | Theo dõi sát booking **lead_time > 30 ngày**, đặc biệt **> 180 ngày** | H1, H1b |
| Cao | Rà soát chính sách / forecast riêng cho **Online TA** | H3, H4 |
| Trung bình | Phân tích sâu nhóm **Non Refund** (nhân quả vs gán nhãn) | H2 |
| Trung bình | Ưu tiên giữ chỗ / giảm overbooking risk cho **Corporate, Direct** | H3 |
| Thấp | Bổ sung biến (`distribution_channel`, `customer_type`, …) vào mô hình v2 | Pseudo R² còn thấp |

---

## Hạn chế

- **Kích thước mẫu lớn** → p-value gần 0 không đồng nghĩa chênh lệch lớn về mặt kinh doanh; luôn kèm effect size.
- **Non Refund** và **Undefined** segment có thể bị confounding / sample nhỏ.
- Kiểm định mô tả **association**, không khẳng định nhân quả thuần túy.
- Logistic regression giả định quan hệ log-linear trên `lead_time`; quan hệ thực tế có thể phi tuyến (đã phản ánh một phần qua bin ở H1b).

---

## Tài liệu liên quan

- `eda_cancellation.ipynb` — EDA trực quan cancellation  
- `Correlation_matrix_is_canceled.ipynb` — Tương quan tổng hợp  
- `EDA Stage 1 - Cancellation Analysis.md` — Báo cáo EDA Stage 1  
- `Correlation Analysis - is_canceled.md` — Báo cáo correlation

---

*Tài liệu được tạo từ kết quả kiểm định trên `hotel_bookings_v5.csv`. Cập nhật lần cuối: {TODAY} — Hypothesis Testing (key dedup mới, {fi(N)} booking).*"""


def build_guide():
    h1 = S["hyp"]["h1"]
    logit = E["logit"]
    lt_p = E["lt_partial"]
    cr = S["corr"]["cramers"]

    return f"""# Hướng dẫn đọc hiểu chỉ số thống kê

> **Phạm vi:** `hypothesis.ipynb` (kiểm định giả thuyết) và `Cancellation_Prediction_Model_v1.ipynb` (dự báo hủy phòng)  
> **Biến mục tiêu:** `is_canceled` (0 = không hủy, 1 = hủy)  
> **Dữ liệu tham chiếu:** `hotel_bookings_v5.csv` (~{fi(N)} booking, tỷ lệ hủy ~{fp(RATE, 2)}%)

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
| **p ≈ 0** (rất nhỏ) | Với n ≈ {fi(N)}, p gần 0 là **bình thường** — không có nghĩa "quan hệ vô hạn" |
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
| **rank-biserial r** | Effect size (−1 đến +1) | r = **{fr(h1['rbiserial'])}** → mức **trung bình**; dương = nhóm hủy có lead_time cao hơn |
| **Median / Mean** | Mô tả 2 nhóm | Không hủy: median **{int(h1['median_not'])}** ngày; Hủy: median **{int(h1['median_cancel'])}** ngày |
| **Bootstrap 95% CI** | Khoảng tin cậy chênh median | CI dương, không chứa 0 → chênh median có ý nghĩa thực tế |

**Quy ước \\|r\\| (rank-biserial):**

| \\|r\\| | Mức |
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
| market_segment | {fr(cr['market_segment'])} | Mạnh nhất trong nhóm phân loại |
| lead_time_bin | {fr(S['hyp']['h1b']['cramers_v'])} | Khá mạnh |
| deposit_type | {fr(cr['deposit_type'])} | Trung bình |

### 3.1 Standardized residual (heatmap)

Công thức: `(Observed − Expected) / √Expected`

| \\|residual\\| | Ý nghĩa |
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
| **z_stat** | Thống kê z so 2 tỷ lệ hủy | \\|z\\| lớn → chênh tỷ lệ lớn |
| **p_value** | Ý nghĩa cặp đơn | p < 0,05 → 2 nhóm khác tỷ lệ hủy |
| **p_bonferroni** | p sau điều chỉnh đa so sánh | **Dùng cột này** để kết luận (tránh false positive) |
| **fisher_p** | Fisher's exact (ô nhỏ) | Thay chi-square khi sample nhỏ (vd. Refundable n={fi(dep_dict()['Refundable']['bookings'])}) |
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
| **z** | z = coef / std err | \\|z\\| lớn → hệ số khác 0 rõ |
| **P>\\|z\\|** | p-value hệ số | **< 0,05** → biến có ý nghĩa trong mô hình |
| **[0.025, 0.975]** | Khoảng tin cậy 95% của β | Không chứa 0 → ý nghĩa thống kê |

### 5.2 Odds Ratio (OR)

`OR = exp(coef)`

| OR | Diễn giải |
|---|---|
| **OR = 1** | Không đổi odds hủy |
| **OR > 1** | Tăng odds hủy |
| **OR < 1** | Giảm odds hủy |

**Ví dụ lead_time:**

- OR (+1 ngày) = **{fr(logit['lt_or_1day'], 3)}** → mỗi thêm 1 ngày, odds hủy tăng ~0,5%.
- OR (+30 ngày) = **{fr(logit['lt_or_30day'], 3)}** → mỗi thêm 30 ngày, odds hủy tăng ~15,8%.

**Baseline (mặc định):** `deposit_type = No Deposit`, `market_segment = Direct`. Các dummy khác so với baseline này.

### 5.3 Chỉ số mô hình tổng thể

| Chỉ số | Ý nghĩa | Cách đọc (ví dụ) |
|---|---|---|
| **Pseudo R² (McFadden)** | Độ giải thích tương đối | **{fr(logit['pseudo_r2'])}** → mô hình giải thích ~{fp(logit['pseudo_r2']*100, 1)}% log-likelihood; **thấp–TB** là bình thường với hành vi khách |
| **Log-Likelihood** | Độ khớp mô hình | Càng cao (ít âm) càng tốt |
| **LL-Null** | Log-likelihood mô hình chỉ intercept | So sánh với LL đầy đủ |
| **LLR p-value** | p của Likelihood Ratio Test | p ≈ 0 → mô hình đầy đủ **tốt hơn** mô hình null |
| **LR χ²** | 2 × (LL − LL_null) | **{fe(logit['lr_chi2'], 1)}**, df = 10 → mô hình có giá trị tổng thể |
| **converged** | Hội tụ tối ưu | Phải **True** mới tin kết quả |

### 5.4 Forest plot & đường dự đoán

- **Forest plot:** OR + 95% CI; chấm **đỏ** = p < 0,05; đường đứt OR = 1.
- **Đường dự đoán:** Xác suất hủy (%) theo lead_time khi giữ deposit_type và segment ở baseline → minh họa **hiệu ứng biên** của lead_time.

---

## 6. Dashboard tổng hợp (`hypothesis.ipynb`)

| Biểu đồ | Trục / nội dung | Cách đọc |
|---|---|---|
| **Effect size** | \\|r\\|, Cramér's V, Pseudo R² | So **tương đối** mức ảnh hưởng (không so trực tiếp đơn vị khác nhau) |
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

**Với tỷ lệ hủy ~{fp(RATE, 0)}%:** Ma trận **lệch class** — model dự đoán "không hủy" cho tất cả vẫn có accuracy ~{fp(100-RATE, 0)}% nhưng **vô dụng**.

---

## 3. Chỉ số phân loại chính

| Chỉ số | Công thức | Cách đọc | Ưu tiên khi |
|---|---|---|---|
| **Accuracy** | (TP+TN) / tổng | % dự đoán đúng | Class cân bằng; **dễ misleading** khi lệch {fp(RATE, 0)}/{fp(100-RATE, 0)} |
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

- **Quan trọng hơn ROC** khi class thiểu số (hủy ~{fp(RATE, 0)}%).
- Baseline PR-AUC ≈ tỷ lệ hủy (~{fr(RATE/100, 2)}) — model phải **vượt** ngưỡng này mới có giá trị.

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
| lead_time median hủy cao hơn (r = {fr(h1['rbiserial'])}) | Feature importance / SHAP lead_time cao |
| market_segment V = {fr(cr['market_segment'])} | Segment (hoặc interaction) quan trọng |
| deposit_type V = {fr(cr['deposit_type'])} | deposit_type trong top features |
| Pseudo R² = {fr(logit['pseudo_r2'])} (3 biến) | Model đầy đủ Tier 1–2 có thể đạt F1 / AUC cao hơn |

**Không mâu thuẫn:** hypothesis chứng minh **có quan hệ**; prediction model đo **khả năng dự báo đúng** trên dữ liệu mới — hai mục tiêu bổ sung cho nhau.

---

## Tài liệu liên quan

| File | Nội dung |
|---|---|
| `Hypothesis Testing - is_canceled.md` | Báo cáo kết quả kiểm định |
| `Correlation Analysis - is_canceled.md` | Feature tier & leakage |
| `EDA Stage 1 - Cancellation Analysis.md` | Insight trực quan cancellation |

---

*Cập nhật: {TODAY} — hướng dẫn đọc chỉ số (key dedup mới, {fi(N)} booking; v5 tái tạo từ v4 + day_of_week).*"""


def write_all():
    files = {
        "EDA Stage 1 - Cancellation Analysis.md": build_stage1(),
        "EDA Stage 2 - ADR.md": build_stage2(),
        "EDA Summary - Key Findings & Recommended Actions.md": build_summary(),
        "Correlation Analysis - is_canceled.md": build_correlation(),
        "Hypothesis Testing - is_canceled.md": build_hypothesis(),
        "Guide - Cach doc chi so thong ke.md": build_guide(),
    }
    for name, content in files.items():
        (ROOT / name).write_text(content, encoding="utf-8")
        print(f"Wrote {name}")


if __name__ == "__main__":
    write_all()
