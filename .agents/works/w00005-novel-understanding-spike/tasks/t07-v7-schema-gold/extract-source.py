"""Reproduce the registered book's first two story chapters without modifying it."""

import argparse
import hashlib
import json
from pathlib import Path
import posixpath
from urllib.parse import unquote
import xml.etree.ElementTree as ET
from zipfile import ZipFile


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def capture(epub_path: Path) -> dict:
    book_title = "转生反派萝莉，找茬魔法少女"
    titles = ["第1章 反派魔法少女", "第2章 反派的日常就是找茬"]
    expected = ["OEBPS/chapter_00001.xhtml", "OEBPS/chapter_00002.xhtml"]
    namespace = {"opf": "http://www.idpf.org/2007/opf", "x": "http://www.w3.org/1999/xhtml"}
    with ZipFile(epub_path) as archive:
        container = ET.fromstring(archive.read("META-INF/container.xml"))
        rootfile = container.find("{*}rootfiles/{*}rootfile")
        if rootfile is None:
            raise ValueError("EPUB container has no rootfile")
        opf_path = rootfile.attrib["full-path"]
        if opf_path != "OEBPS/content.opf":
            raise ValueError(f"Unexpected registered OPF: {opf_path}")
        package = ET.fromstring(archive.read(opf_path))
        manifest = {
            item.attrib["id"]: posixpath.normpath(posixpath.join(posixpath.dirname(opf_path), unquote(item.attrib["href"])))
            for item in package.findall("opf:manifest/opf:item", namespace)
        }
        spine = [manifest[item.attrib["idref"]] for item in package.findall("opf:spine/opf:itemref", namespace)]
        # This registered EPUB labels story members chapter_*.xhtml; front matter remains outside the sample.
        story_members = [member for member in spine if posixpath.basename(member).startswith("chapter_")]
        if story_members[:2] != expected:
            raise ValueError("The registered first two story members no longer match spine order")
        sources = []
        for order, (member, title) in enumerate(zip(expected, titles, strict=True), start=1):
            raw = archive.read(member)
            body = ET.fromstring(raw).find("x:body", namespace)
            if body is None:
                raise ValueError(f"Missing XHTML body: {member}")
            paragraphs = [text for block in body if (text := "".join(block.itertext()).strip())]
            if not paragraphs or paragraphs[0] != title:
                raise ValueError(f"Unexpected first body block/title: {member}")
            sources.append({
                "id": f"source-c{order:02d}", "revision": 1, "chapterId": f"c{order:02d}",
                "chapterOrder": order, "title": title, "member": member,
                "memberSha256": sha256(raw), "paragraphs": paragraphs,
                "sha256": sha256("\n".join(paragraphs).encode("utf-8")),
            })
    return {
        "schema": "neurobook.memory.v7.source-capture",
        "book": {"id": "novel-villain-fox", "title": book_title},
        "archive": {"path": f".local/novels/{book_title}.epub", "sha256": sha256(epub_path.read_bytes()), "opf": opf_path, "selection": expected},
        "normalization": {
            "id": "epub-body-blocks-v1",
            "description": "UTF-8 XML；仅 XHTML body 的直接元素，各自 itertext 拼接后 trim，移除空块；保留 h1、作者声明和分隔符。段落以单个 LF 连接，无末尾 LF；UTF-8 SHA256；位置用每段 UTF-16 code units。head/title 不属于正文。",
            "separator": "\n",
        },
        "sources": sources,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--epub", required=True, type=Path)
    parser.add_argument("--verify", nargs="?", type=Path, const=Path(__file__).with_name("sources.json"))
    parser.add_argument("--output", type=Path, help="Explicit output file; otherwise source capture is read-only")
    args = parser.parse_args()
    result = capture(args.epub)
    verify = args.verify or (Path(__file__).with_name("sources.json") if args.output is None else None)
    if verify is not None:
        expected = json.loads(verify.read_text(encoding="utf-8"))
        if result != expected:
            raise ValueError(f"Source capture differs from {verify}; no output written")
    if args.output is not None:
        if args.output.resolve() == args.epub.resolve():
            raise ValueError("Output must not overwrite the source EPUB")
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(json.dumps({"verified": str(verify) if verify else None, "chapters": len(result["sources"]), "paragraphs": [len(source["paragraphs"]) for source in result["sources"]], "archiveSha256": result["archive"]["sha256"], "output": str(args.output) if args.output else None}, ensure_ascii=False))


if __name__ == "__main__":
    main()
