#!/usr/bin/env python3

from __future__ import annotations

import argparse
import getpass
import os
import platform
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path, PurePosixPath
from urllib.request import urlretrieve


DEFAULT_NODE_VERSION = "24.0.0"
CODEX_NPM_PACKAGE = "@openai/codex"
API_KEY_EXPORT_PREFIX = 'export OPENAI_API_KEY="'
API_KEY_EXPORT_SUFFIX = '"'


class InstallerError(Exception):
    def __init__(self, message: str, cause: str | None = None, suggestion: str | None = None):
        super().__init__(message)
        self.message = message
        self.cause = cause
        self.suggestion = suggestion


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Codex macOS 单文件命令行安装器")
    parser.add_argument("--api-key", help="直接传入 OPENAI_API_KEY")
    parser.add_argument("--base-url", help="预留的自定义接口地址")
    parser.add_argument(
        "--write-shell-profile",
        action="store_true",
        help="把 OPENAI_API_KEY 写入 shell 配置文件",
    )
    parser.add_argument(
        "--skip-node-install",
        action="store_true",
        help="跳过 Node.js 自动安装，仅在当前环境已存在 node/npm 时可用",
    )
    parser.add_argument(
        "--non-interactive",
        action="store_true",
        help="非交互模式，缺少必需参数时直接失败",
    )
    parser.add_argument(
        "--node-version",
        default=DEFAULT_NODE_VERSION,
        help=f"指定要安装的 Node.js 版本，默认 {DEFAULT_NODE_VERSION}",
    )
    return parser.parse_args(argv)


def validate_api_key(value: str) -> bool:
    trimmed = value.strip()
    return trimmed.startswith("sk-") or (len(trimmed) == 64 and not any(char.isspace() for char in trimmed))


def build_config_toml(base_url: str | None = None) -> str:
    lines = [
        '[provider.openai]',
        'env_key = "OPENAI_API_KEY"',
    ]

    if base_url:
        lines.append(f'base_url = "{base_url}"')

    return "\n".join(lines) + "\n"


def resolve_shell_profile(shell_path: str | None, home_dir: str) -> str:
    shell_name = Path(shell_path or "").name.lower()
    home = PurePosixPath(home_dir)

    if shell_name == "bash":
        return str(home / ".bash_profile")

    return str(home / ".zshrc")


def update_shell_profile_contents(existing: str, api_key: str) -> str:
    export_line = f'{API_KEY_EXPORT_PREFIX}{api_key}{API_KEY_EXPORT_SUFFIX}'
    lines = existing.splitlines()
    filtered = [line for line in lines if not line.startswith("export OPENAI_API_KEY=")]

    if filtered and filtered[-1].strip():
        filtered.append("")

    filtered.append(export_line)
    return "\n".join(filtered) + "\n"


def get_node_pkg_url(version: str, arch: str) -> str:
    _ = arch
    return f"https://nodejs.org/dist/v{version}/node-v{version}.pkg"


def print_info(message: str) -> None:
    print(f"[信息] {message}")


def print_warn(message: str) -> None:
    print(f"[警告] {message}")


def print_step(message: str) -> None:
    print(f"[步骤] {message}")


def print_success(message: str) -> None:
    print(f"[完成] {message}")


def print_failure(error: InstallerError) -> None:
    print(f"[错误] {error.message}", file=sys.stderr)
    if error.cause:
        print(f"可能原因：{error.cause}", file=sys.stderr)
    if error.suggestion:
        print(f"建议操作：{error.suggestion}", file=sys.stderr)


def run_command(
    args: list[str],
    *,
    check: bool = True,
    capture_output: bool = True,
) -> subprocess.CompletedProcess[str]:
    try:
        result = subprocess.run(
            args,
            check=False,
            capture_output=capture_output,
            text=True,
        )
    except FileNotFoundError as exc:
        raise InstallerError(
            f"找不到命令：{args[0]}",
            cause="当前系统中没有可执行文件，或 PATH 未包含对应路径。",
            suggestion="确认命令已安装，或重新打开终端后再试。",
        ) from exc

    if check and result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip() or f"退出码 {result.returncode}"
        raise InstallerError(
            f"命令执行失败：{' '.join(args)}",
            cause=detail,
            suggestion="根据上面的输出检查失败原因后重试。",
        )

    return result


def ensure_macos() -> None:
    if platform.system() != "Darwin":
        raise InstallerError(
            "当前脚本仅支持 macOS。",
            cause=f"检测到系统为 {platform.system() or 'unknown'}。",
            suggestion="请在 macOS 设备上运行这个脚本。",
        )


def command_exists(name: str) -> bool:
    return shutil.which(name) is not None


def read_version(name: str, args: list[str]) -> str | None:
    if not command_exists(name):
        return None

    result = run_command([name, *args], check=False)
    if result.returncode != 0:
        return None

    return (result.stdout or result.stderr).strip() or None


def prompt_api_key(non_interactive: bool, provided_api_key: str | None) -> str:
    if provided_api_key:
        if not validate_api_key(provided_api_key):
            raise InstallerError(
                "传入的 API Key 格式不正确。",
                cause="API Key 既不是 sk- 开头，也不是 64 位长度的 token。",
                suggestion="请重新传入有效的 OPENAI_API_KEY。",
            )
        return provided_api_key.strip()

    if non_interactive:
        raise InstallerError(
            "非交互模式下必须通过 --api-key 提供 API Key。",
            cause="脚本不能在非交互模式下弹出输入提示。",
            suggestion="重新运行并追加 --api-key。",
        )

    while True:
        value = getpass.getpass("请输入 OPENAI_API_KEY：").strip()
        if validate_api_key(value):
            return value
        print_warn("API Key 格式不正确，必须是 sk- 开头，或为 64 位长度的 token。")


def should_write_shell_profile(args: argparse.Namespace) -> bool:
    if args.write_shell_profile:
        return True

    if args.non_interactive:
        return False

    answer = input("是否把 OPENAI_API_KEY 写入 shell 配置文件？[y/N]：").strip().lower()
    return answer in {"y", "yes"}


def download_node_pkg(version: str, arch: str) -> Path:
    url = get_node_pkg_url(version, arch)
    temp_dir = Path(tempfile.mkdtemp(prefix="codex-node-installer-"))
    pkg_path = temp_dir / f"node-v{version}.pkg"

    print_step(f"正在下载 Node.js 安装包：{url}")
    try:
        urlretrieve(url, pkg_path)
    except Exception as exc:  # pragma: no cover - network path
        raise InstallerError(
            "Node.js 安装包下载失败。",
            cause=str(exc),
            suggestion="检查网络连接，或稍后重新运行脚本。",
        ) from exc

    return pkg_path


def install_node(version: str) -> None:
    arch = platform.machine().lower()
    pkg_path = download_node_pkg(version, arch)

    print_step("准备安装 Node.js，这一步可能会要求输入 macOS 管理员密码。")
    try:
        run_command(["sudo", "installer", "-pkg", str(pkg_path), "-target", "/"])
    except InstallerError as exc:
        raise InstallerError(
            "Node.js 安装失败。",
            cause=exc.cause,
            suggestion="请确认你允许了 pkg 安装，并在需要时输入管理员密码。",
        ) from exc


def ensure_node(args: argparse.Namespace) -> tuple[str, str]:
    node_version = read_version("node", ["-v"])
    npm_version = read_version("npm", ["-v"])

    if node_version and npm_version:
        print_info(f"已检测到 Node.js：{node_version}")
        print_info(f"已检测到 npm：{npm_version}")
        return node_version, npm_version

    if args.skip_node_install:
        raise InstallerError(
            "当前环境缺少 Node.js 或 npm，且你指定了 --skip-node-install。",
            cause="脚本被禁止自动安装 Node.js。",
            suggestion="移除 --skip-node-install，或先手动安装 Node.js 后再运行。",
        )

    print_warn("未检测到可用的 Node.js / npm，将自动下载安装。")
    install_node(args.node_version)

    node_version = read_version("node", ["-v"])
    npm_version = read_version("npm", ["-v"])
    if not node_version or not npm_version:
        raise InstallerError(
            "Node.js 安装后仍未检测到 node 或 npm。",
            cause="PATH 可能尚未刷新，或安装过程未成功完成。",
            suggestion="重新打开终端后再次运行脚本。",
        )

    return node_version, npm_version


def install_codex_cli() -> None:
    print_step(f"正在安装 Codex CLI：npm i -g {CODEX_NPM_PACKAGE}")
    try:
        run_command(["npm", "i", "-g", CODEX_NPM_PACKAGE])
    except InstallerError as exc:
        raise InstallerError(
            "Codex CLI 安装失败。",
            cause=exc.cause,
            suggestion="检查 npm 全局安装权限或网络连接后重试。",
        ) from exc


def write_config(base_url: str | None) -> Path:
    config_dir = Path.home() / ".codex"
    config_path = config_dir / "config.toml"
    config_dir.mkdir(parents=True, exist_ok=True)
    config_path.write_text(build_config_toml(base_url), encoding="utf-8")
    print_info(f"已写入配置文件：{config_path}")
    return config_path


def persist_api_key(api_key: str, profile_path: str) -> None:
    path = Path(profile_path)
    existing = path.read_text(encoding="utf-8") if path.exists() else ""
    updated = update_shell_profile_contents(existing, api_key)
    path.write_text(updated, encoding="utf-8")
    print_info(f"已写入环境变量到：{path}")


def verify_install() -> str:
    print_step("正在验证 Codex 安装结果。")
    version = read_version("codex", ["--version"])
    if not version:
        raise InstallerError(
            "Codex CLI 验证失败。",
            cause="执行 codex --version 没有返回有效版本。",
            suggestion="重新打开终端后执行 codex --version，确认 PATH 与 npm 全局目录是否生效。",
        )
    return version


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)

    try:
        ensure_macos()

        home_dir = str(Path.home())
        shell_path = os.environ.get("SHELL")
        profile_path = resolve_shell_profile(shell_path, home_dir)

        print_info("开始执行 Codex macOS 安装。")
        print_info(f"当前 shell：{shell_path or 'unknown'}")
        print_info(f"默认 shell 配置文件：{profile_path}")

        node_version, npm_version = ensure_node(args)
        print_info(f"Node.js 版本：{node_version}")
        print_info(f"npm 版本：{npm_version}")

        api_key = prompt_api_key(args.non_interactive, args.api_key)
        install_codex_cli()
        config_path = write_config(args.base_url)

        if should_write_shell_profile(args):
            persist_api_key(api_key, profile_path)
        else:
            print_warn("你选择了不写入 shell 配置文件，本次不会持久化 OPENAI_API_KEY。")

        codex_version = verify_install()

        print_success("Codex 安装完成。")
        print_success(f"Codex 版本：{codex_version}")
        print_success(f"配置文件：{config_path}")
        print_info("如果 shell 环境变量刚写入，请重新打开终端后再使用 codex。")
        return 0
    except InstallerError as error:
        print_failure(error)
        return 1
    except KeyboardInterrupt:
        print("\n[错误] 用户取消了安装。", file=sys.stderr)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
