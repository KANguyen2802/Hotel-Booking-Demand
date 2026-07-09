"""Convert HTML <img> tags back to Markdown images for GitHub rendering."""
from __future__ import annotations

import html
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPORTS = ROOT / "reports"

IMG_HTML_RE = re.compile(
    r'<img\s+src="([^"]+)"\s+alt="([^"]*)"\s+width="\d+"\s*/?>',
    re.IGNORECASE,
)


def to_markdown_image(match: re.Match[str]) -> str:
    src = match.group(1).lstrip("./")
    alt = html.unescape(match.group(2)).replace("|", r"\|")
    return f"![{alt}](./figures/{src.removeprefix('figures/')})"


def convert_text(text: str) -> tuple[str, int]:
    count = 0

    def repl(match: re.Match[str]) -> str:
        nonlocal count
        count += 1
        return to_markdown_image(match)

    return IMG_HTML_RE.sub(repl, text), count


def convert_file(path: Path) -> int:
    new_text, n = convert_text(path.read_text(encoding="utf-8"))
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
    print(f"Done — {total} images converted to Markdown")


if __name__ == "__main__":
    main()
