"""
Convert report Markdown files to PDF with embedded figures.

Output: reports/figures/{md_stem}.pdf (overwrites existing PDFs)
"""
from __future__ import annotations

import base64
import mimetypes
import re
import sys
from pathlib import Path

import markdown
from xhtml2pdf import pisa

ROOT = Path(__file__).resolve().parent.parent
REPORTS = ROOT / "reports"
FIGURES = REPORTS / "figures"

IMG_TAG_RE = re.compile(
    r'<img\s+src="([^"]+)"\s+alt="([^"]*)"\s+width="(\d+)"\s*/?>',
    re.IGNORECASE,
)

CSS = """
@page {
    size: A4;
    margin: 1.8cm 1.5cm;
}
body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10pt;
    line-height: 1.45;
    color: #1a1a1a;
}
h1 { font-size: 18pt; margin-top: 0; }
h2 { font-size: 14pt; margin-top: 18px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
h3 { font-size: 12pt; margin-top: 14px; }
blockquote {
    margin: 10px 0;
    padding: 8px 12px;
    border-left: 4px solid #3498db;
    background: #f7f9fc;
    color: #333;
}
table {
    border-collapse: collapse;
    width: 100%;
    margin: 10px 0 14px;
    font-size: 9pt;
}
th, td {
    border: 1px solid #bbb;
    padding: 5px 7px;
    vertical-align: top;
}
th { background: #eef2f7; font-weight: bold; }
tr:nth-child(even) td { background: #fafafa; }
img {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 10px auto 14px;
}
code {
    font-family: Consolas, monospace;
    font-size: 9pt;
    background: #f4f4f4;
    padding: 1px 4px;
}
hr { border: none; border-top: 1px solid #ddd; margin: 16px 0; }
"""


def image_to_data_uri(img_path: Path) -> str:
    mime, _ = mimetypes.guess_type(img_path.name)
    if not mime:
        mime = "image/png"
    encoded = base64.b64encode(img_path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def resolve_images(text: str, md_dir: Path) -> str:
    def repl(match: re.Match[str]) -> str:
        src, alt, width = match.group(1), match.group(2), match.group(3)
        img_path = (md_dir / src).resolve()
        if not img_path.is_file():
            print(f"  [warn] Missing image: {img_path}", file=sys.stderr)
            return match.group(0)
        uri = image_to_data_uri(img_path)
        return f'<img src="{uri}" alt="{alt}" width="{width}"/>'

    return IMG_TAG_RE.sub(repl, text)


def md_to_html(text: str, md_dir: Path) -> str:
    text = resolve_images(text, md_dir)
    body = markdown.markdown(
        text,
        extensions=["tables", "fenced_code", "sane_lists"],
    )
    return f"""<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8"/>
<style>{CSS}</style>
</head>
<body>
{body}
</body>
</html>"""


def html_to_pdf(html: str, pdf_path: Path) -> None:
    pdf_path.parent.mkdir(parents=True, exist_ok=True)
    with open(pdf_path, "wb") as out:
        status = pisa.CreatePDF(html, dest=out, encoding="utf-8")
    if status.err:
        raise RuntimeError(f"PDF generation failed for {pdf_path}")


def pdf_output_path(md_path: Path) -> Path:
    return FIGURES / f"{md_path.stem}.pdf"


def convert_report(md_path: Path) -> Path:
    html = md_to_html(md_path.read_text(encoding="utf-8"), md_path.parent)
    pdf_path = pdf_output_path(md_path)
    html_to_pdf(html, pdf_path)
    return pdf_path


def main() -> None:
    md_files = sorted(REPORTS.glob("*.md"))
    if not md_files:
        print("No report MD files found.")
        return

    ok, fail = 0, 0
    for md_path in md_files:
        try:
            pdf_path = convert_report(md_path)
            size_kb = pdf_path.stat().st_size / 1024
            print(f"OK  {md_path.name} -> figures/{pdf_path.name} ({size_kb:.0f} KB)")
            ok += 1
        except Exception as exc:
            print(f"ERR {md_path.name}: {exc}", file=sys.stderr)
            fail += 1

    print(f"\nDone: {ok} converted, {fail} failed.")


if __name__ == "__main__":
    main()
