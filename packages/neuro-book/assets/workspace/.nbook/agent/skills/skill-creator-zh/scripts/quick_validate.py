#!/usr/bin/env python3
"""
快速校验 Neuro Book skill 目录。

规则以 `reference/agent/skill-package.md` 为准（Agent Skills 开放标准 + 本项目约定），
与 `skill-creator/scripts/quick_validate.py` 保持同一套接受/拒绝判定。
"""

import re
import sys
from pathlib import Path

MAX_SKILL_NAME_LENGTH = 64
MAX_DESCRIPTION_LENGTH = 1024
MAX_COMPATIBILITY_LENGTH = 500

# 标准允许的顶层字段。metadata 是任意 string map，用于承载标准之外的属性。
# when_to_use 是标准之外的既有扩展：NeuroBook SkillCatalog 与 Claude Code 都消费它，
# 现存内置 Skill 也在用，因此容忍在顶层出现。
ALLOWED_TOP_LEVEL_KEYS = {
    "name",
    "description",
    "when_to_use",
    "license",
    "compatibility",
    "metadata",
    "allowed-tools",
}

SEMVER_PATTERN = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$"
)

# id 规则：小写字母数字与连字符，不以连字符开头结尾，不含连续连字符。
SKILL_NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

FORBIDDEN_TERMS = (
    "CODEX_HOME",
    "~/.codex/skills",
    "agents/openai.yaml",
    "generate_openai_yaml.py",
)


def strip_quotes(value: str) -> str:
    """去掉一层成对引号。"""
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
        return value[1:-1]
    return value


def parse_frontmatter(document_text: str) -> tuple[dict[str, object], str] | tuple[None, str]:
    """
    解析 YAML frontmatter。

    支持扁平标量、标准定义的唯一嵌套 `metadata` 映射，以及 `when_to_use` 块列表。
    """
    match = re.match(r"^---\r?\n(.*?)\r?\n---\r?\n?(.*)$", document_text, re.DOTALL)
    if not match:
        return None, "缺少合法的 YAML frontmatter。"

    frontmatter: dict[str, object] = {}
    metadata: dict[str, str] = {}
    when_to_use_items: list[str] = []
    # 当前正在收集的块：None / "metadata" / "when_to_use"
    open_block: str | None = None

    for raw_line in match.group(1).splitlines():
        if not raw_line.strip():
            continue

        indented = raw_line[:1].isspace()
        line = raw_line.strip()

        if line.startswith("- "):
            if open_block != "when_to_use":
                return None, f"when_to_use 之外出现列表项：{line}"
            when_to_use_items.append(strip_quotes(line[2:].strip()))
            continue

        if indented:
            if open_block != "metadata":
                return None, f"frontmatter 出现意外缩进行：{line}"
            if ":" not in line:
                return None, f"metadata 行格式错误：{line}"
            key, raw_value = line.split(":", 1)
            key = key.strip()
            if not key:
                return None, f"metadata 行格式错误：{line}"
            metadata[key] = strip_quotes(raw_value.strip())
            continue

        open_block = None
        if ":" not in line:
            return None, f"frontmatter 行格式错误：{line}"

        key, raw_value = line.split(":", 1)
        key = key.strip()
        value = raw_value.strip()
        if not key:
            return None, f"frontmatter 行格式错误：{line}"

        if key == "metadata":
            if value:
                return None, "metadata 必须是嵌套映射，不能写成内联值。"
            open_block = "metadata"
            continue

        if key == "when_to_use" and not value:
            open_block = "when_to_use"
            continue

        frontmatter[key] = strip_quotes(value)

    if metadata:
        frontmatter["metadata"] = metadata
    if when_to_use_items:
        frontmatter["when_to_use"] = when_to_use_items

    return frontmatter, match.group(2)


def validate_frontmatter(frontmatter: dict[str, object], directory_name: str) -> list[str]:
    """按合同校验 frontmatter，返回错误列表。"""
    errors: list[str] = []

    unexpected_keys = sorted(set(frontmatter.keys()) - ALLOWED_TOP_LEVEL_KEYS)
    if unexpected_keys:
        errors.append(f"frontmatter 出现未允许的顶层字段：{', '.join(unexpected_keys)}")

    name = str(frontmatter.get("name", "")).strip()
    if not name:
        errors.append("缺少 name。")
    elif len(name) > MAX_SKILL_NAME_LENGTH:
        errors.append(f"name 长度不能超过 {MAX_SKILL_NAME_LENGTH} 个字符。")
    elif not SKILL_NAME_PATTERN.match(name):
        errors.append("name 只能是小写字母、数字和连字符，不能以连字符开头/结尾，也不能有连续连字符。")
    elif name != directory_name:
        errors.append(f"name「{name}」必须等于父目录名「{directory_name}」。")

    description = str(frontmatter.get("description", "")).strip()
    if not description:
        errors.append("缺少 description。")
    elif len(description) > MAX_DESCRIPTION_LENGTH:
        errors.append(f"description 长度不能超过 {MAX_DESCRIPTION_LENGTH} 个字符。")

    compatibility = str(frontmatter.get("compatibility", "")).strip()
    if len(compatibility) > MAX_COMPATIBILITY_LENGTH:
        errors.append(f"compatibility 长度不能超过 {MAX_COMPATIBILITY_LENGTH} 个字符。")

    metadata = frontmatter.get("metadata")
    if isinstance(metadata, dict):
        for field in ("version", "minAppVersion"):
            raw = metadata.get(field, "").strip()
            if raw and not SEMVER_PATTERN.match(raw):
                errors.append(f"metadata.{field} 必须是 canonical SemVer 字符串。")

    return errors


def validate_skill(skill_dir: Path) -> tuple[bool, list[str]]:
    """执行完整校验：入口固定 SKILL.md。"""
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.exists():
        return False, ["未找到 SKILL.md。"]

    document_text = skill_md.read_text(encoding="utf-8")
    parsed_frontmatter, error = parse_frontmatter(document_text)
    if parsed_frontmatter is None:
        return False, [error]

    errors = validate_frontmatter(parsed_frontmatter, skill_dir.name)
    for forbidden_term in FORBIDDEN_TERMS:
        if forbidden_term in document_text:
            errors.append(f"文档中残留旧平台术语：{forbidden_term}")

    return len(errors) == 0, errors


def main() -> None:
    """解析参数并输出校验结果。"""
    if len(sys.argv) != 2:
        print("Usage: python quick_validate.py <skill_directory>")
        sys.exit(1)

    skill_dir = Path(sys.argv[1]).resolve()
    is_valid, errors = validate_skill(skill_dir)
    if is_valid:
        print("Skill 校验通过。")
        sys.exit(0)

    print("Skill 校验失败：")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)


if __name__ == "__main__":
    main()
