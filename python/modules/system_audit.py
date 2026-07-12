from __future__ import annotations

import getpass
import grp
import os
import platform
import pwd
import re
import shutil
import socket
import stat
import subprocess
import time
from pathlib import Path
from typing import Any

from core.errors import ZeroHubError


MAX_PROCESSES = 500
MAX_PORTS = 500
MAX_SERVICES = 500
MAX_STARTUP_ITEMS = 300
MAX_RISKS = 200
COMMAND_TIMEOUT_SECONDS = 8

SS_LINE_PATTERN = re.compile(
    r"^(?P<protocol>\S+)\s+"
    r"(?P<state>\S+)\s+"
    r"(?P<recv>\S+)\s+"
    r"(?P<send>\S+)\s+"
    r"(?P<local>\S+)\s+"
    r"(?P<peer>\S+)"
    r"(?:\s+(?P<process>.*))?$"
)

DESKTOP_NAME_PATTERN = re.compile(
    r"^Name=(?P<value>.*)$",
    re.MULTILINE,
)

DESKTOP_EXEC_PATTERN = re.compile(
    r"^Exec=(?P<value>.*)$",
    re.MULTILINE,
)

DESKTOP_HIDDEN_PATTERN = re.compile(
    r"^Hidden=(?P<value>true|false)$",
    re.MULTILINE | re.IGNORECASE,
)


def read_text(
    path: Path,
    limit: int = 1024 * 1024,
) -> str | None:
    try:
        with path.open(
            "r",
            encoding="utf-8",
            errors="replace",
        ) as file:
            return file.read(limit)
    except (
        FileNotFoundError,
        PermissionError,
        OSError,
    ):
        return None


def run_command(
    command: list[str],
    timeout: int = COMMAND_TIMEOUT_SECONDS,
) -> tuple[int, str, str]:
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
            shell=False,
        )

        return (
            result.returncode,
            result.stdout.strip(),
            result.stderr.strip(),
        )

    except FileNotFoundError:
        return 127, "", "Comando não encontrado."

    except subprocess.TimeoutExpired:
        return 124, "", "Tempo limite excedido."

    except OSError as error:
        return 1, "", str(error)


def parse_os_release() -> dict[str, str]:
    content = read_text(
        Path("/etc/os-release")
    )

    if not content:
        return {}

    output: dict[str, str] = {}

    for line in content.splitlines():
        if "=" not in line:
            continue

        key, value = line.split(
            "=",
            1,
        )

        output[key] = value.strip().strip(
            "\"'"
        )

    return output


def read_uptime_seconds() -> float | None:
    content = read_text(
        Path("/proc/uptime"),
        256,
    )

    if not content:
        return None

    try:
        return float(
            content.split()[0]
        )
    except (
        ValueError,
        IndexError,
    ):
        return None


def memory_summary() -> dict[str, int]:
    content = read_text(
        Path("/proc/meminfo")
    )

    values: dict[str, int] = {}

    if content:
        for line in content.splitlines():
            if ":" not in line:
                continue

            key, raw_value = line.split(
                ":",
                1,
            )

            match = re.search(
                r"\d+",
                raw_value,
            )

            if match:
                values[key] = (
                    int(match.group())
                    * 1024
                )

    total = values.get(
        "MemTotal",
        0,
    )

    available = values.get(
        "MemAvailable",
        0,
    )

    used = max(
        0,
        total - available,
    )

    return {
        "totalBytes": total,
        "availableBytes": available,
        "usedBytes": used,
    }


def disk_summary() -> dict[str, int]:
    usage = shutil.disk_usage("/")

    return {
        "totalBytes": usage.total,
        "usedBytes": usage.used,
        "freeBytes": usage.free,
    }


def cpu_summary() -> dict[str, Any]:
    model = None
    core_count = os.cpu_count() or 0

    content = read_text(
        Path("/proc/cpuinfo")
    )

    if content:
        for line in content.splitlines():
            if line.lower().startswith(
                "model name"
            ):
                _, value = line.split(
                    ":",
                    1,
                )

                model = value.strip()
                break

    return {
        "model": model,
        "logicalCores": core_count,
        "architecture": platform.machine(),
    }


def user_summary() -> dict[str, Any]:
    username = getpass.getuser()
    uid = os.getuid()
    gid = os.getgid()

    try:
        home = pwd.getpwuid(uid).pw_dir
    except KeyError:
        home = str(
            Path.home()
        )

    groups: list[str] = []

    try:
        groups = [
            grp.getgrgid(group_id).gr_name
            for group_id in os.getgroups()
        ]
    except KeyError:
        groups = []

    return {
        "username": username,
        "uid": uid,
        "gid": gid,
        "groups": sorted(
            set(groups)
        ),
        "home": home,
        "isRoot": uid == 0,
    }


def parse_process_status(
    process_path: Path,
) -> dict[str, str]:
    content = read_text(
        process_path / "status",
        128 * 1024,
    )

    output: dict[str, str] = {}

    if not content:
        return output

    for line in content.splitlines():
        if ":" not in line:
            continue

        key, value = line.split(
            ":",
            1,
        )

        output[key] = value.strip()

    return output


def list_processes() -> list[dict[str, Any]]:
    processes: list[dict[str, Any]] = []

    proc_root = Path("/proc")

    try:
        process_directories = sorted(
            (
                path
                for path in proc_root.iterdir()
                if path.name.isdigit()
            ),
            key=lambda path: int(path.name),
        )
    except OSError:
        return []

    for process_path in process_directories:
        if len(processes) >= MAX_PROCESSES:
            break

        status = parse_process_status(
            process_path
        )

        if not status:
            continue

        try:
            pid = int(
                process_path.name
            )
        except ValueError:
            continue

        raw_uid = status.get(
            "Uid",
            "",
        ).split()

        process_uid = None
        process_user = None

        if raw_uid:
            try:
                process_uid = int(
                    raw_uid[0]
                )

                process_user = pwd.getpwuid(
                    process_uid
                ).pw_name
            except (
                ValueError,
                KeyError,
            ):
                process_user = None

        memory_kib = 0

        raw_memory = status.get(
            "VmRSS",
            "",
        )

        memory_match = re.search(
            r"\d+",
            raw_memory,
        )

        if memory_match:
            memory_kib = int(
                memory_match.group()
            )

        processes.append({
            "pid": pid,
            "name": status.get(
                "Name",
                "unknown",
            ),
            "state": status.get(
                "State",
                "unknown",
            ),
            "user": process_user,
            "uid": process_uid,
            "memoryBytes": memory_kib * 1024,
            "threads": int(
                status.get(
                    "Threads",
                    "0",
                )
                or 0
            ),
        })

    processes.sort(
        key=lambda item: (
            -item["memoryBytes"],
            item["pid"],
        )
    )

    return processes


def split_endpoint(
    endpoint: str,
) -> tuple[str, str]:
    if endpoint.startswith("["):
        closing = endpoint.rfind("]")

        if closing != -1:
            host = endpoint[1:closing]
            port = endpoint[
                closing + 2:
            ]

            return host, port

    if ":" in endpoint:
        host, port = endpoint.rsplit(
            ":",
            1,
        )

        return host, port

    return endpoint, ""


def list_listening_ports() -> list[dict[str, Any]]:
    return_code, stdout, _ = run_command([
        "ss",
        "-H",
        "-lntup",
    ])

    if return_code != 0 or not stdout:
        return []

    ports: list[dict[str, Any]] = []

    for line in stdout.splitlines():
        match = SS_LINE_PATTERN.match(
            line.strip()
        )

        if not match:
            continue

        local_host, local_port = split_endpoint(
            match.group("local")
        )

        process_text = (
            match.group("process")
            or ""
        )

        process_match = re.search(
            r'users:\(\("(?P<name>[^"]+)"'
            r',pid=(?P<pid>\d+)',
            process_text,
        )

        ports.append({
            "protocol": match.group(
                "protocol"
            ),
            "state": match.group(
                "state"
            ),
            "localAddress": local_host,
            "localPort": local_port,
            "processName":
                process_match.group("name")
                if process_match
                else None,

            "pid":
                int(process_match.group("pid"))
                if process_match
                else None,
        })

        if len(ports) >= MAX_PORTS:
            break

    return ports


def list_running_services() -> list[dict[str, str]]:
    return_code, stdout, _ = run_command([
        "systemctl",
        "list-units",
        "--type=service",
        "--state=running",
        "--no-legend",
        "--no-pager",
        "--plain",
    ])

    if return_code != 0 or not stdout:
        return []

    services: list[dict[str, str]] = []

    for line in stdout.splitlines():
        parts = line.split(
            None,
            4,
        )

        if len(parts) < 4:
            continue

        services.append({
            "unit": parts[0],
            "load": parts[1],
            "active": parts[2],
            "sub": parts[3],
            "description":
                parts[4]
                if len(parts) >= 5
                else "",
        })

        if len(services) >= MAX_SERVICES:
            break

    return services


def parse_desktop_file(
    path: Path,
    scope: str,
) -> dict[str, Any]:
    content = read_text(
        path,
        512 * 1024,
    )

    if not content:
        return {
            "name": path.stem,
            "path": str(path),
            "scope": scope,
            "command": None,
            "hidden": False,
        }

    name_match = DESKTOP_NAME_PATTERN.search(
        content
    )

    exec_match = DESKTOP_EXEC_PATTERN.search(
        content
    )

    hidden_match = DESKTOP_HIDDEN_PATTERN.search(
        content
    )

    return {
        "name":
            name_match.group("value").strip()
            if name_match
            else path.stem,

        "path": str(path),
        "scope": scope,

        "command":
            exec_match.group("value").strip()
            if exec_match
            else None,

        "hidden":
            hidden_match.group("value").lower()
            == "true"
            if hidden_match
            else False,
    }


def list_startup_items() -> list[dict[str, Any]]:
    directories = [
        (
            Path.home()
            / ".config"
            / "autostart",
            "user",
        ),
        (
            Path("/etc/xdg/autostart"),
            "system",
        ),
    ]

    items: list[dict[str, Any]] = []

    for directory, scope in directories:
        try:
            entries = sorted(
                directory.glob(
                    "*.desktop"
                )
            )
        except OSError:
            continue

        for path in entries:
            items.append(
                parse_desktop_file(
                    path,
                    scope,
                )
            )

            if len(items) >= MAX_STARTUP_ITEMS:
                return items

    return items


def mode_string(
    path: Path,
) -> str | None:
    try:
        return stat.filemode(
            path.stat().st_mode
        )
    except (
        FileNotFoundError,
        PermissionError,
        OSError,
    ):
        return None


def mode_octal(
    path: Path,
) -> str | None:
    try:
        return oct(
            stat.S_IMODE(
                path.stat().st_mode
            )
        )
    except (
        FileNotFoundError,
        PermissionError,
        OSError,
    ):
        return None


def add_permission_risk(
    risks: list[dict[str, Any]],
    path: Path,
    category: str,
    description: str,
) -> None:
    if len(risks) >= MAX_RISKS:
        return

    try:
        file_stat = path.stat()
    except (
        FileNotFoundError,
        PermissionError,
        OSError,
    ):
        return

    mode = stat.S_IMODE(
        file_stat.st_mode
    )

    group_writable = bool(
        mode & stat.S_IWGRP
    )

    world_writable = bool(
        mode & stat.S_IWOTH
    )

    if not (
        group_writable
        or world_writable
    ):
        return

    severity = (
        "high"
        if world_writable
        else "medium"
    )

    risks.append({
        "severity": severity,
        "category": category,
        "path": str(path),
        "description": description,
        "permissions": oct(mode),
    })


def permission_risks(
    startup_items: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    risks: list[dict[str, Any]] = []
    home = Path.home()

    add_permission_risk(
        risks,
        home,
        "home",
        "O diretório pessoal permite escrita por outros usuários.",
    )

    ssh_directory = home / ".ssh"

    add_permission_risk(
        risks,
        ssh_directory,
        "ssh",
        "O diretório ~/.ssh permite escrita por grupo ou outros usuários.",
    )

    for sensitive_name in (
        "authorized_keys",
        "config",
        "known_hosts",
    ):
        add_permission_risk(
            risks,
            ssh_directory / sensitive_name,
            "ssh",
            "Arquivo SSH permite escrita por grupo ou outros usuários.",
        )

    raw_path = os.environ.get(
        "PATH",
        "",
    )

    seen_paths: set[str] = set()

    for raw_directory in raw_path.split(
        os.pathsep
    ):
        if not raw_directory:
            continue

        directory = Path(
            raw_directory
        ).expanduser()

        normalized = str(directory)

        if normalized in seen_paths:
            continue

        seen_paths.add(normalized)

        add_permission_risk(
            risks,
            directory,
            "path",
            "Diretório presente no PATH permite escrita por grupo ou outros usuários.",
        )

    for item in startup_items:
        add_permission_risk(
            risks,
            Path(item["path"]),
            "autostart",
            "Entrada de inicialização permite escrita por grupo ou outros usuários.",
        )

    return risks


def read_sysctl_value(
    path: str,
) -> str | None:
    content = read_text(
        Path(path),
        256,
    )

    return (
        content.strip()
        if content
        else None
    )


def secure_boot_state() -> dict[str, Any]:
    return_code, stdout, stderr = run_command([
        "mokutil",
        "--sb-state",
    ])

    text = (
        stdout
        or stderr
    )

    lower_text = text.lower()

    if return_code == 127:
        return {
            "available": False,
            "enabled": None,
            "details": "mokutil não está instalado.",
        }

    if "enabled" in lower_text:
        enabled = True
    elif "disabled" in lower_text:
        enabled = False
    else:
        enabled = None

    return {
        "available": True,
        "enabled": enabled,
        "details": text or "Estado não identificado.",
    }


def firewall_state() -> list[dict[str, Any]]:
    candidates = (
        "nftables",
        "ufw",
        "firewalld",
    )

    states: list[dict[str, Any]] = []

    for service in candidates:
        return_code, stdout, _ = run_command([
            "systemctl",
            "is-active",
            service,
        ])

        states.append({
            "name": service,
            "active":
                return_code == 0
                and stdout == "active",

            "state":
                stdout
                if stdout
                else "unknown",
        })

    return states


def security_summary() -> dict[str, Any]:
    apparmor_value = read_sysctl_value(
        "/sys/module/apparmor/parameters/enabled"
    )

    aslr_value = read_sysctl_value(
        "/proc/sys/kernel/randomize_va_space"
    )

    ptrace_scope = read_sysctl_value(
        "/proc/sys/kernel/yama/ptrace_scope"
    )

    return {
        "secureBoot":
            secure_boot_state(),

        "apparmorEnabled":
            apparmor_value == "Y"
            if apparmor_value is not None
            else None,

        "aslrMode":
            int(aslr_value)
            if aslr_value
            and aslr_value.isdigit()
            else None,

        "ptraceScope":
            int(ptrace_scope)
            if ptrace_scope
            and ptrace_scope.isdigit()
            else None,

        "firewalls":
            firewall_state(),
    }


def run_system_audit(
    payload: dict[str, Any],
) -> dict[str, Any]:
    del payload

    if platform.system() != "Linux":
        raise ZeroHubError(
            "A primeira versão do System Audit suporta Linux."
        )

    started_at = time.perf_counter()

    os_release = parse_os_release()
    startup_items = list_startup_items()
    processes = list_processes()
    ports = list_listening_ports()
    services = list_running_services()
    risks = permission_risks(
        startup_items
    )

    hostname = socket.gethostname()

    return {
        "generatedAt":
            time.strftime(
                "%Y-%m-%dT%H:%M:%SZ",
                time.gmtime(),
            ),

        "elapsedMs":
            round(
                (
                    time.perf_counter()
                    - started_at
                )
                * 1000,
                2,
            ),

        "system": {
            "hostname": hostname,
            "platform": platform.system(),
            "kernel": platform.release(),
            "distribution":
                os_release.get(
                    "PRETTY_NAME"
                )
                or os_release.get(
                    "NAME"
                )
                or "Linux",

            "uptimeSeconds":
                read_uptime_seconds(),

            "cpu": cpu_summary(),
            "memory": memory_summary(),
            "disk": disk_summary(),
        },

        "user": user_summary(),
        "security": security_summary(),
        "processes": processes,
        "listeningPorts": ports,
        "services": services,
        "startupItems": startup_items,
        "permissionRisks": risks,

        "counts": {
            "processes": len(processes),
            "listeningPorts": len(ports),
            "services": len(services),
            "startupItems": len(startup_items),
            "permissionRisks": len(risks),
        },

        "limits": {
            "processes": MAX_PROCESSES,
            "listeningPorts": MAX_PORTS,
            "services": MAX_SERVICES,
            "startupItems": MAX_STARTUP_ITEMS,
            "permissionRisks": MAX_RISKS,
        },
    }
