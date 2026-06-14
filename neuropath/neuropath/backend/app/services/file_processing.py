"""
File Processing Service
-------------------------
PDF: PyMuPDF (fitz)
DOCX: python-docx

extract(file_path, file_type) -> { "text": str, "chapters": [ {title, text} ] }

Chapter detection heuristic:
  - PDF: lines that look like headings (short, often ALL CAPS or "Chapter N", or
    larger font size relative to body text)
  - DOCX: paragraphs with a "Heading" style (Heading 1 / Heading 2)
"""

import re
import fitz  # PyMuPDF
from docx import Document


CHAPTER_PATTERN = re.compile(r"^(chapter\s+\d+|part\s+\d+|\d+\.\s+[A-Z])", re.IGNORECASE)


def extract_pdf(file_path: str) -> dict:
    doc = fitz.open(file_path)
    full_text_parts = []
    chapters = []
    current_chapter = {"title": "Introduction", "text": ""}

    for page in doc:
        blocks = page.get_text("dict")["blocks"]
        for block in blocks:
            if "lines" not in block:
                continue
            for line in block["lines"]:
                for span in line["spans"]:
                    text = span["text"].strip()
                    if not text:
                        continue
                    full_text_parts.append(text)

                    is_heading = (
                        span["size"] >= 14
                        and len(text) < 100
                        or bool(CHAPTER_PATTERN.match(text))
                    )

                    if is_heading and len(text) > 3:
                        if current_chapter["text"].strip():
                            chapters.append(current_chapter)
                        current_chapter = {"title": text, "text": ""}
                    else:
                        current_chapter["text"] += text + " "

    if current_chapter["text"].strip():
        chapters.append(current_chapter)

    doc.close()

    return {
        "text": " ".join(full_text_parts),
        "chapters": chapters[:20],  # cap for MVP
    }


def extract_docx(file_path: str) -> dict:
    doc = Document(file_path)
    full_text_parts = []
    chapters = []
    current_chapter = {"title": "Introduction", "text": ""}

    for para in doc.paragraphs:
        text = para.text.strip()
        if not text:
            continue
        full_text_parts.append(text)

        is_heading = para.style.name.startswith("Heading") or bool(CHAPTER_PATTERN.match(text))

        if is_heading:
            if current_chapter["text"].strip():
                chapters.append(current_chapter)
            current_chapter = {"title": text, "text": ""}
        else:
            current_chapter["text"] += text + " "

    if current_chapter["text"].strip():
        chapters.append(current_chapter)

    return {
        "text": " ".join(full_text_parts),
        "chapters": chapters[:20],
    }


def extract(file_path: str, file_type: str) -> dict:
    if file_type == "pdf":
        return extract_pdf(file_path)
    elif file_type == "docx":
        return extract_docx(file_path)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")
