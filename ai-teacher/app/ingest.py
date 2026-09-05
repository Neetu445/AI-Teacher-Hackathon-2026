"""Learning-material ingestion: TXT/MD/PDF/DOCX/PPTX/CSV -> plain text,
plus outline and key information extraction used by the planner."""
import os
import re


def parse_file(path):
    """Return extracted plain text from a supported document."""
    ext = os.path.splitext(path)[1].lower()
    if ext in (".txt", ".md", ".csv", ".log", ".json", ".py", ".js", ".html"):
        return _read_text(path)
    if ext == ".pdf":
        return _read_pdf(path)
    if ext == ".docx":
        return _read_docx(path)
    if ext == ".pptx":
        return _read_pptx(path)
    # last resort: try to decode as text
    try:
        return _read_text(path)
    except Exception:
        raise ValueError(f"Unsupported file type: {ext}")


def _read_text(path):
    with open(path, "rb") as f:
        raw = f.read()
    for enc in ("utf-8", "utf-16", "latin-1"):
        try:
            return raw.decode(enc)
        except (UnicodeDecodeError, ValueError):
            continue
    return raw.decode("utf-8", errors="ignore")


def _read_pdf(path):
    from pypdf import PdfReader
    reader = PdfReader(path)
    parts = []
    for i, page in enumerate(reader.pages):
        txt = page.extract_text() or ""
        parts.append(f"[Page {i + 1}]\n{txt}")
    return "\n\n".join(parts)


def _read_docx(path):
    import docx
    d = docx.Document(path)
    parts = [p.text for p in d.paragraphs if p.text.strip()]
    for table in d.tables:
        for row in table.rows:
            cells = [c.text.strip() for c in row.cells]
            if any(cells):
                parts.append(" | ".join(cells))
    return "\n".join(parts)


def _read_pptx(path):
    from pptx import Presentation
    prs = Presentation(path)
    parts = []
    for i, slide in enumerate(prs.slides):
        texts = []
        for shape in slide.shapes:
            if shape.has_text_frame:
                for para in shape.text_frame.paragraphs:
                    t = " ".join(run.text for run in para.runs).strip()
                    if t:
                        texts.append(t)
        if texts:
            parts.append(f"[Slide {i + 1}]\n" + "\n".join(texts))
    return "\n\n".join(parts)


_HEAD_RE = re.compile(
    r"^(#{1,4}\s+.+|chapter\s+\d+.*|unit\s+\d+.*|section\s+\d+.*|\d+(\.\d+)*[.)]\s+\S.{2,90}|[A-Z][A-Z &\-:]{4,90})$",
    re.I,
)


def extract_outline(text, limit=40):
    """Pull probable headings from the document for chapter/section selection."""
    outline, seen = [], set()
    for line in text.splitlines():
        s = line.strip().lstrip("#").strip()
        if not s or len(s) > 110 or len(s) < 4:
            continue
        looks_heading = bool(_HEAD_RE.match(line.strip()))
        looks_short_title = (len(s) < 70 and s == s.title() and not s.endswith(".")
                             and len(s.split()) <= 9)
        if looks_heading or looks_short_title:
            key = s.lower()
            if key not in seen:
                seen.add(key)
                outline.append(s)
        if len(outline) >= limit:
            break
    return outline


def guess_title(text, filename):
    for line in text.splitlines():
        s = line.strip().lstrip("#").strip()
        if 4 <= len(s) <= 90:
            return s
    return os.path.splitext(os.path.basename(filename))[0].replace("_", " ").replace("-", " ").title()


def slice_section(text, section):
    """Extract the slice of the document belonging to a chosen outline heading."""
    if not section:
        return text
    lines = text.splitlines()
    start = None
    for i, line in enumerate(lines):
        if section.lower() in line.strip().lower() and len(line.strip()) < 130:
            start = i
            break
    if start is None:
        return text
    # take from that heading to the next peer heading, or +250 lines max
    out = []
    for line in lines[start:start + 400]:
        if out and _HEAD_RE.match(line.strip()) and section.lower() not in line.strip().lower():
            break
        out.append(line)
    sliced = "\n".join(out)
    return sliced if len(sliced) > 120 else text


def detect_formulas(text):
    """Find simple 'X = Y/Z' or 'X = Y*Z' relations. Used to auto-generate
    'what happens to X when Y increases' check questions (misconception traps).
    Also used to pick math-style visuals."""
    formulas = []
    for m in re.finditer(r"(?<![\w)])([A-Za-z]{1,3})\s*=\s*([A-Za-z]{1,3})\s*(/|×|\*|x)\s*([A-Za-z]{1,3})(?![\w(])", text):
        lhs, a, op, b = m.groups()
        formulas.append({"lhs": lhs.upper(), "a": a.upper(), "b": b.upper(),
                         "op": "divide" if op == "/" else "multiply", "raw": m.group(0)})
    unique, seen = [], set()
    for f in formulas:
        key = f["raw"].replace(" ", "")
        if key not in seen:
            seen.add(key)
            unique.append(f)
    return unique[:6]
