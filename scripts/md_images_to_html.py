"""Convert markdown image syntax to HTML <img> in report MD files."""
from __future__ import annotations

import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPORTS = ROOT / "reports"

IMG_MD_RE = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")
DEFAULT_WIDTH = 800


def normalize_alt(alt: str) -> str:
    return alt.replace(r"\|", "|")


def to_html_img(alt: str, src: str, width: int = DEFAULT_WIDTH) -> str:
    alt_clean = normalize_alt(alt)
    alt_esc = html.escape(alt_clean, quote=True)
    return f'<img src="{src}" alt="{alt_esc}" width="{width}">'


def convert_text(text: str, width: int = DEFAULT_WIDTH) -> tuple[str, int]:
    count = 0

    def repl(match: re.Match[str]) -> str:
        nonlocal count
        count += 1
        return to_html_img(match.group(1), match.group(2), width)

    return IMG_MD_RE.sub(repl, text), count


def convert_file(path: Path, width: int = DEFAULT_WIDTH) -> int:
    new_text, n = convert_text(path.read_text(encoding="utf-8"), width)
    if n:
        path.write_text(new_text, encoding="utf-8")
    return n


def main() -> None:
    total = 0
    for path in sorted(REPORTS.glob("*.md")):
        n = convert_file(path)
        if n:
            print(f"{path.name}: {n} images")
            total += n
    print(f"Done — {total} images converted")


if __name__ == "__main__":
    main()
