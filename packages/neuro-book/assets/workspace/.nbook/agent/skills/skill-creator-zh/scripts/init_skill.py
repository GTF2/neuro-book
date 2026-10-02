#!/usr/bin/env python3
"""
初始化 Neuro Book 风格的 skill 目录。

用法：
    init_skill.py <skill-id> [--display-name <text>] [--description <text>]
        [--path <skills-root>] [--resources scripts,references,assets]

目录名就是 skill id，会原样写进 frontmatter `name`；中文或其它非 ASCII 展示名
放进 `--display-name`，写成 `metadata.displayName`。

示例：
    init_skill.py plot-helper
    init_skill.py shuangwen-style --display-name 爽文风格
    init_skill.py lore-tools --resources scripts,references
"""

import argparse
import re
import sys
from pathlib import Path

MAX_SKILL_NAME_LENGTH = 64
ALLOWED_RESOURCES = ("scripts", "references", "assets")
# 默认输出到脚本所在的 skills 根（<skills>/skill-creator-zh/scripts/init_skill.py）。
DEFAULT_SKILL_ROOT = Path(__file__).resolve().parents[2]
# id 规则：小写字母数字与连字符，不以连字符开头结尾，不含连续连字符。
SKILL_NAME_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def is_valid_skill_name(value: str) -> bool:
    """判断是否为合法 skill id。"""
    if not value or len(value) > MAX_SKILL_NAME_LENGTH:
        return False
    return SKILL_NAME_PATTERN.match(value) is not None


def build_metadata_block(display_name: str) -> str:
    """生成可选的 metadata 块。"""
    if not display_name:
        return ""
    return f"metadata:\n    displayName: {display_name}\n"


def build_skill_title(skill_name: str, display_name: str) -> str:
    """生成正文标题：优先展示名，其次把 id 的连字符分段首字母大写。"""
    if display_name:
        return display_name
    if "-" not in skill_name:
        return skill_name
    return " ".join(part.capitalize() for part in skill_name.split("-") if part)


def build_skill_template(skill_name: str, display_name: str, description: str) -> str:
    """生成 Neuro Book 当前使用的 SKILL.md 模板。"""
    return f"""---
name: {skill_name}
description: {description}
{build_metadata_block(display_name)}---

# {build_skill_title(skill_name, display_name)}

## 概述

[TODO: 用 1 到 3 句话说明这个 skill 解决什么问题，以及它对当前项目的价值。]

## 推荐工作流

1. [TODO: 写出最小可执行流程]
2. [TODO: 写出关键判断点]
3. [TODO: 写出交付或验证方式]

## 资源使用

- `scripts/`：[TODO: 如果存在，说明什么时候执行哪些脚本]
- `references/`：[TODO: 如果存在，说明什么时候读取哪些参考资料]
- `assets/`：[TODO: 如果存在，说明哪些资源会被直接复制或修改]

## 注意事项

- [TODO: 写出容易做错的点]
- [TODO: 写出项目特有约束]
"""


def parse_resources(raw_resources: str) -> list[str]:
    """解析并校验资源目录列表。"""
    if not raw_resources.strip():
        return []

    resources = [item.strip() for item in raw_resources.split(",") if item.strip()]
    invalid = sorted({item for item in resources if item not in ALLOWED_RESOURCES})
    if invalid:
        allowed = ", ".join(ALLOWED_RESOURCES)
        print(f"[ERROR] 未知资源目录：{', '.join(invalid)}")
        print(f"        允许值：{allowed}")
        sys.exit(1)

    deduped: list[str] = []
    seen: set[str] = set()
    for resource in resources:
        if resource in seen:
            continue
        deduped.append(resource)
        seen.add(resource)
    return deduped


def create_resource_directories(skill_dir: Path, resources: list[str]) -> None:
    """创建用户指定的资源目录。"""
    for resource in resources:
        resource_dir = skill_dir / resource
        resource_dir.mkdir(exist_ok=True)
        print(f"[OK] 已创建 {resource_dir.relative_to(skill_dir)}")


def init_skill(output_root: Path, skill_name: str, display_name: str, description: str, resources: list[str]) -> Path:
    """初始化 skill 目录并生成基础文件。"""
    skill_dir = output_root / skill_name
    if skill_dir.exists():
        raise FileExistsError(f"目标目录已存在：{skill_dir}")

    skill_dir.mkdir(parents=True, exist_ok=False)
    (skill_dir / "SKILL.md").write_text(build_skill_template(skill_name, display_name, description), encoding="utf-8")

    if resources:
        create_resource_directories(skill_dir, resources)

    return skill_dir


def main() -> None:
    """解析命令行参数并执行初始化。"""
    parser = argparse.ArgumentParser(description="初始化 Neuro Book skill 目录。")
    parser.add_argument("skill_name", help="skill id；同时作为目录名与 frontmatter `name`。")
    parser.add_argument(
        "--display-name",
        default="",
        help="界面展示名，写进 metadata.displayName；中文名走这里。",
    )
    parser.add_argument(
        "--description",
        default="[TODO: 说明这个 skill 做什么、什么时候使用。]",
        help="frontmatter 中的 description",
    )
    parser.add_argument(
        "--path",
        default=str(DEFAULT_SKILL_ROOT),
        help="输出根目录，默认是包含本脚本的 skills 根",
    )
    parser.add_argument(
        "--resources",
        default="",
        help="可选资源目录，逗号分隔：scripts,references,assets",
    )
    args = parser.parse_args()

    skill_name = args.skill_name.strip()
    display_name = args.display_name.strip()
    description = args.description.strip()

    if not is_valid_skill_name(skill_name):
        print("[ERROR] skill id 只能是小写字母、数字和连字符，不能以连字符开头/结尾，也不能有连续连字符；中文名请放 --display-name。")
        sys.exit(1)
    if not description:
        print("[ERROR] description 不能为空。")
        sys.exit(1)

    output_root = Path(args.path).resolve()
    resources = parse_resources(args.resources)

    try:
        skill_dir = init_skill(output_root, skill_name, display_name, description, resources)
    except FileExistsError as error:
        print(f"[ERROR] {error}")
        sys.exit(1)
    except OSError as error:
        print(f"[ERROR] 初始化失败：{error}")
        sys.exit(1)

    print(f"[OK] 已创建 skill：{skill_dir}")
    print("[OK] 下一步：补全 SKILL.md，并按需添加 scripts/references/assets 内容；有 shell 能力时运行 quick_validate.py 校验。")


if __name__ == "__main__":
    main()
