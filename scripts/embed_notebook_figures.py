"""
Extract PNG figures from notebooks and embed into matching MD reports.
"""
from __future__ import annotations

import base64
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIGURES = ROOT / "reports" / "figures"

NOTEBOOKS = {
    "02": ROOT / "notebooks/02_eda_stage1_cancellation.ipynb",
    "03": ROOT / "notebooks/03_eda_stage2_adr.ipynb",
    "04": ROOT / "notebooks/04_correlation_analysis.ipynb",
    "05": ROOT / "notebooks/05_hypothesis_testing.ipynb",
    "06": ROOT / "models/Cancellation Predict Model v1/06_cancellation_model_v1.ipynb",
    "07": ROOT / "models/Cancellation Predict Model v1/07_cancellation_model_v1_1.ipynb",
    "08": ROOT / "models/Cancellation Predict Model v1/08_cancellation_model_v1_2.ipynb",
    "09": ROOT / "models/Cancellation Predict Model v2/09_cancellation_model_v2.ipynb",
}

REPORTS = {
    "02": ROOT / "reports/02_eda_stage1_cancellation_analysis.md",
    "03": ROOT / "reports/03_eda_stage2_adr_analysis.md",
    "04": ROOT / "reports/04_correlation_analysis_is_canceled.md",
    "05": ROOT / "reports/05_hypothesis_testing_is_canceled.md",
    "06": ROOT / "reports/06_cancellation_model_v1.md",
    "07": ROOT / "reports/07_cancellation_model_v1_1.md",
    "08": ROOT / "reports/08_cancellation_model_v1_2.md",
    "09": ROOT / "reports/09_cancellation_model_v2.md",
}

CHART_RE = re.compile(r"Biểu đồ\s+(\d+)", re.IGNORECASE)
IMG_MD_RE = re.compile(r"!\[[^\]]*\]\(figures/[^\)]+\)\s*\n?", re.MULTILINE)
IMG_HTML_RE = re.compile(
    r'<img src="figures/[^"]+" alt="[^"]*" width="\d+">\s*\n?',
    re.MULTILINE,
)
HEADER_CHART_RE = re.compile(r"^### Biểu đồ (\d+):", re.MULTILINE)
IMG_WIDTH = 800


def html_img(caption: str, rel: str, width: int = IMG_WIDTH) -> str:
    from html import escape

    alt = caption.replace(r"\|", "|")
    return f'\n<img src="{rel}" alt="{escape(alt, quote=True)}" width="{width}">\n\n'


def chart_numbers_from_source(source: str) -> list[int]:
    nums = [int(m.group(1)) for m in CHART_RE.finditer(source)]
    seen: list[int] = []
    for n in nums:
        if n not in seen:
            seen.append(n)
    return seen


def extract_figures(prefix: str, nb_path: Path) -> list[dict]:
    nb = json.loads(nb_path.read_text(encoding="utf-8"))
    out_dir = FIGURES / prefix
    out_dir.mkdir(parents=True, exist_ok=True)

    figures: list[dict] = []
    seq = 0
    for cell in nb["cells"]:
        if cell["cell_type"] != "code":
            continue
        source = "".join(cell.get("source", []))
        chart_nums = chart_numbers_from_source(source)
        png_idx = 0
        for output in cell.get("outputs", []):
            data = output.get("data", {})
            if "image/png" not in data:
                continue
            png_b64 = data["image/png"]
            if isinstance(png_b64, list):
                png_b64 = "".join(png_b64)
            seq += 1
            png_idx += 1

            if chart_nums and png_idx <= len(chart_nums):
                chart_no = chart_nums[png_idx - 1]
            elif chart_nums:
                chart_no = chart_nums[-1]
            else:
                chart_no = seq  # sequential for notebooks without chart comments

            fname = f"chart_{chart_no:02d}.png"
            rel = f"figures/{prefix}/{fname}"
            path = ROOT / "reports" / rel
            path.write_bytes(base64.b64decode(png_b64))
            figures.append(
                {
                    "seq": seq,
                    "chart_no": chart_no,
                    "fname": fname,
                    "rel": rel,
                    "label": f"Biểu đồ {chart_no}",
                }
            )
    return figures


def strip_existing_images(text: str) -> str:
    text = IMG_MD_RE.sub("", text)
    text = IMG_HTML_RE.sub("", text)
    return text.rstrip() + "\n"


def insert_after_header(text: str, header: str, image_md: str) -> str:
    if image_md.strip() in text:
        return text
    idx = text.find(header)
    if idx == -1:
        return text
    line_end = text.find("\n", idx)
    if line_end == -1:
        return text
    pos = line_end + 1
    while pos < len(text) and text[pos] == "\n":
        pos += 1
    return text[:pos] + image_md + text[pos:]


def embed_eda_charts(text: str, figures: list[dict]) -> str:
    by_chart: dict[int, dict] = {}
    for f in figures:
        by_chart[int(f["chart_no"])] = f

    for m in HEADER_CHART_RE.finditer(text):
        chart_no = int(m.group(1))
        f = by_chart.get(chart_no)
        if not f:
            continue
        header = m.group(0)
        image_md = html_img(f["label"], f["rel"])
        text = insert_after_header(text, header, image_md)
    return text


MODEL_INSERTIONS = {
    "06": [
        ("### 5.1 Confusion Matrix", "chart_01.png", "Confusion Matrix & ROC Curve"),
        ("### 5.2 ROC Curve", "chart_01.png", "ROC Curve (cùng hình với Confusion Matrix)"),
        ("### 5.3 Prediction Probability Distribution", "chart_02.png", "Phân phối xác suất dự đoán"),
        ("### 5.4 Feature Importance", "chart_03.png", "Feature Importance (top 20)"),
    ],
    "07": [
        ("### 6.1 Confusion Matrix", "chart_01.png", "Confusion Matrix & ROC Curve"),
        ("### 6.2 ROC Curve", "chart_01.png", "ROC Curve (cùng hình với Confusion Matrix)"),
        ("### 6.3 Prediction Probability Distribution", "chart_02.png", "Phân phối xác suất dự đoán"),
        ("### 6.4 Feature Importance", "chart_03.png", "Feature Importance (top 20)"),
    ],
    "08": [
        ("### 6.1 Confusion Matrix", "chart_01.png", "Confusion Matrix & ROC Curve"),
        ("### 6.2 ROC Curve", "chart_01.png", "ROC Curve (cùng hình với Confusion Matrix)"),
        ("### 6.3 Prediction Probability Distribution", "chart_02.png", "Phân phối xác suất dự đoán"),
        ("### 6.4 Feature Importance vs SHAP", "chart_03.png", "Feature Importance (Gini)"),
        ("### 5.5 Biểu đồ SHAP trong notebook", "chart_04.png", "SHAP — mean |SHAP| engineered"),
        ("| **Beeswarm** |", "chart_05.png", "SHAP beeswarm"),
        ("| **Dependence (top 3)** |", "chart_06.png", "SHAP dependence"),
        ("| **Dependence (top 3)** |", "chart_07.png", "SHAP dependence (2)"),
        ("| **Dependence (top 3)** |", "chart_08.png", "SHAP dependence (3)"),
        ("| **Waterfall** |", "chart_09.png", "SHAP waterfall"),
        ("| **Bar engineered** |", "chart_10.png", "SHAP engineered bar"),
    ],
    "09": [
        ("### 6.1 Confusion Matrix", "chart_01.png", "Confusion Matrix & ROC Curve"),
        ("### 6.2 ROC Curve", "chart_01.png", "ROC Curve (cùng hình với Confusion Matrix)"),
        ("### 6.3 Prediction Probability Distribution", "chart_02.png", "Phân phối xác suất dự đoán"),
        ("### 6.4 Gain importance vs SHAP", "chart_03.png", "Feature Importance (gain)"),
        ("### 5.2 Mean |SHAP|", "chart_04.png", "SHAP — mean |SHAP| engineered"),
        ("### 5.3 Tổng hợp theo nhóm feature engineering", "chart_05.png", "SHAP — tổng hợp theo nhóm"),
    ],
}

CORRELATION_INSERTIONS = [
    ("## 2. Tương quan biến số", "chart_01.png", "Bar chart — Pearson correlation"),
    ("## 3. Tương quan biến phân loại", "chart_02.png", "Bar chart — Cramér's V"),
    ("## 4. Partial Correlation", "chart_03.png", "Heatmap Pearson (biến số)"),
    ("## Phụ lục — Biểu đồ trong notebook", "chart_04.png", "Heatmap tổng hợp tất cả biến"),
    ("### 5.1 Tier 1", "chart_05.png", "Phân loại Causation vs Correlation"),
]

HYPOTHESIS_INSERTIONS = [
    ("## H1 — `lead_time`", "chart_01.png", "H1 — lead_time"),
    ("## H2 — `deposit_type`", "chart_02.png", "H2 — deposit_type (crosstab)"),
    ("## H3 — `market_segment`", "chart_04.png", "H3 — market_segment"),
    ("## H1b — `lead_time_bin`", "chart_05.png", "H1b — lead_time_bin"),
    ("## H4 — Logistic Regression", "chart_06.png", "H4 — Logistic Regression"),
    ("## So sánh effect size", "chart_07.png", "Dashboard effect size"),
]


def embed_mapped(prefix: str, text: str, insertions: list[tuple]) -> str:
    fig_dir = FIGURES / prefix
    for header, fname, caption in insertions:
        if not (fig_dir / fname).exists():
            continue
        rel = f"figures/{prefix}/{fname}"
        image_md = html_img(caption, rel)
        text = insert_after_header(text, header, image_md)
    return text


def process_report(prefix: str) -> int:
    nb_path = NOTEBOOKS[prefix]
    md_path = REPORTS[prefix]
    figures = extract_figures(prefix, nb_path)
    text = strip_existing_images(md_path.read_text(encoding="utf-8"))

    if prefix in ("02", "03"):
        text = embed_eda_charts(text, figures)
    elif prefix == "04":
        text = embed_mapped(prefix, text, CORRELATION_INSERTIONS)
    elif prefix == "05":
        text = embed_mapped(prefix, text, HYPOTHESIS_INSERTIONS)
    elif prefix in MODEL_INSERTIONS:
        text = embed_mapped(prefix, text, MODEL_INSERTIONS[prefix])

    md_path.write_text(text, encoding="utf-8")
    return len(re.findall(r'<img src="figures/', text))


def main():
    for prefix in NOTEBOOKS:
        n = process_report(prefix)
        print(f"{prefix}: {n} image links embedded")


if __name__ == "__main__":
    main()
