from __future__ import annotations

import ipaddress
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from core.errors import (
    InvalidRequestError,
    ZeroHubError,
)


MAX_LINES = 500_000
MAX_LINE_LENGTH = 65_536
MAX_EVENT_SAMPLES = 600
TOP_ITEMS_LIMIT = 100

HTTP_PATTERN = re.compile(
    r'^(?P<ip>\S+)\s+\S+\s+\S+\s+'
    r'\[(?P<timestamp>[^\]]+)\]\s+'
    r'"(?P<method>[A-Z]+)\s+'
    r'(?P<path>\S+)'
    r'(?:\s+HTTP/\d(?:\.\d)?)?"\s+'
    r'(?P<status>\d{3})\s+'
    r'(?P<size>\S+)'
    r'(?:\s+"(?P<referer>[^"]*)"\s+'
    r'"(?P<user_agent>[^"]*)")?'
)

SYSLOG_PATTERN = re.compile(
    r'^(?P<month>[A-Z][a-z]{2})\s+'
    r'(?P<day>\d{1,2})\s+'
    r'(?P<clock>\d{2}:\d{2}:\d{2})\s+'
    r'(?P<host>\S+)\s+'
    r'(?P<process>[\w./-]+)'
    r'(?:\[(?P<pid>\d+)\])?:\s+'
    r'(?P<message>.*)$'
)

ISO_TIMESTAMP_PATTERN = re.compile(
    r'(?P<timestamp>'
    r'\d{4}-\d{2}-\d{2}'
    r'[T ]'
    r'\d{2}:\d{2}:\d{2}'
    r'(?:\.\d+)?'
    r'(?:Z|[+-]\d{2}:?\d{2})?'
    r')'
)

IP_PATTERN = re.compile(
    r'(?<![0-9A-Fa-f:.])'
    r'(?:'
    r'(?:\d{1,3}\.){3}\d{1,3}'
    r'|'
    r'[0-9A-Fa-f:]{2,}'
    r')'
    r'(?![0-9A-Fa-f:.])'
)

LEVEL_PATTERN = re.compile(
    r'\b('
    r'emerg|alert|crit|critical|fatal|'
    r'error|err|warning|warn|notice|'
    r'info|information|debug|trace'
    r')\b',
    re.IGNORECASE,
)

FAILED_AUTH_PATTERN = re.compile(
    r'\b('
    r'failed password|authentication failure|'
    r'failed publickey|invalid user|'
    r'maximum authentication attempts exceeded'
    r')\b',
    re.IGNORECASE,
)

SUCCESS_AUTH_PATTERN = re.compile(
    r'\baccepted (?:password|publickey|keyboard-interactive)\b',
    re.IGNORECASE,
)

INVALID_USER_PATTERN = re.compile(
    r'\binvalid user\b',
    re.IGNORECASE,
)

SUDO_PATTERN = re.compile(
    r'\bsudo(?:\[\d+\])?:|\bCOMMAND=',
    re.IGNORECASE,
)


def require_string(
    payload: dict[str, Any],
    field: str,
) -> str:
    value = payload.get(field)

    if not isinstance(value, str):
        raise InvalidRequestError(
            f"O campo '{field}' precisa ser um texto."
        )

    return value


def normalize_level(
    value: str | None,
) -> str:
    if not value:
        return "other"

    level = value.lower()

    if level in {
        "emerg",
        "alert",
        "crit",
        "critical",
        "fatal",
        "error",
        "err",
    }:
        return "error"

    if level in {
        "warning",
        "warn",
        "notice",
    }:
        return "warning"

    if level in {
        "info",
        "information",
    }:
        return "info"

    if level in {
        "debug",
        "trace",
    }:
        return "debug"

    return "other"


def parse_datetime(
    value: Any,
) -> datetime | None:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        try:
            return datetime.fromtimestamp(
                float(value),
                tz=timezone.utc,
            )
        except (
            ValueError,
            OverflowError,
            OSError,
        ):
            return None

    if not isinstance(value, str):
        return None

    text = value.strip()

    if not text:
        return None

    candidates = [
        text,
        text.replace("Z", "+00:00"),
    ]

    for candidate in candidates:
        try:
            parsed = datetime.fromisoformat(candidate)

            if parsed.tzinfo is None:
                parsed = parsed.replace(
                    tzinfo=timezone.utc
                )

            return parsed.astimezone(timezone.utc)
        except ValueError:
            pass

    formats = (
        "%d/%b/%Y:%H:%M:%S %z",
        "%d/%b/%Y:%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
    )

    for date_format in formats:
        try:
            parsed = datetime.strptime(
                text,
                date_format,
            )

            if parsed.tzinfo is None:
                parsed = parsed.replace(
                    tzinfo=timezone.utc
                )

            return parsed.astimezone(timezone.utc)
        except ValueError:
            continue

    return None


def parse_syslog_datetime(
    month: str,
    day: str,
    clock: str,
) -> datetime | None:
    current_year = datetime.now(
        timezone.utc
    ).year

    try:
        parsed = datetime.strptime(
            f"{current_year} {month} {day} {clock}",
            "%Y %b %d %H:%M:%S",
        )

        return parsed.replace(
            tzinfo=timezone.utc
        )
    except ValueError:
        return None


def extract_ip(
    text: str,
) -> str | None:
    for candidate in IP_PATTERN.findall(text):
        try:
            return str(
                ipaddress.ip_address(candidate)
            )
        except ValueError:
            continue

    return None


def timestamp_iso(
    value: datetime | None,
) -> str | None:
    if value is None:
        return None

    return value.isoformat()


def timeline_bucket(
    value: datetime | None,
) -> str | None:
    if value is None:
        return None

    return value.strftime(
        "%Y-%m-%d %H:00"
    )


def parse_http_line(
    line: str,
) -> dict[str, Any] | None:
    match = HTTP_PATTERN.match(line)

    if not match:
        return None

    status_code = int(
        match.group("status")
    )

    if status_code >= 500:
        level = "error"
    elif status_code >= 400:
        level = "warning"
    else:
        level = "info"

    parsed_timestamp = parse_datetime(
        match.group("timestamp")
    )

    return {
        "format": "http",
        "timestamp": parsed_timestamp,
        "level": level,
        "source": "HTTP",
        "message": line,
        "ip": match.group("ip"),
        "method": match.group("method"),
        "path": match.group("path"),
        "statusCode": status_code,
        "userAgent": match.group("user_agent") or None,
        "authFailed": False,
        "authSuccess": False,
        "invalidUser": False,
        "sudoEvent": False,
    }


def parse_syslog_line(
    line: str,
) -> dict[str, Any] | None:
    match = SYSLOG_PATTERN.match(line)

    if not match:
        return None

    message = match.group("message")
    level_match = LEVEL_PATTERN.search(message)

    return {
        "format": "ssh-auth",
        "timestamp": parse_syslog_datetime(
            match.group("month"),
            match.group("day"),
            match.group("clock"),
        ),
        "level": normalize_level(
            level_match.group(1)
            if level_match
            else None
        ),
        "source": match.group("process"),
        "message": message,
        "ip": extract_ip(message),
        "method": None,
        "path": None,
        "statusCode": None,
        "userAgent": None,
        "authFailed": bool(
            FAILED_AUTH_PATTERN.search(message)
        ),
        "authSuccess": bool(
            SUCCESS_AUTH_PATTERN.search(message)
        ),
        "invalidUser": bool(
            INVALID_USER_PATTERN.search(message)
        ),
        "sudoEvent": bool(
            SUDO_PATTERN.search(
                f"{match.group('process')}: {message}"
            )
        ),
    }


def find_first(
    data: dict[str, Any],
    keys: tuple[str, ...],
) -> Any:
    for key in keys:
        if key in data:
            return data[key]

    return None


def parse_json_line(
    line: str,
) -> dict[str, Any] | None:
    stripped = line.lstrip()

    if not stripped.startswith("{"):
        return None

    try:
        value = json.loads(line)
    except json.JSONDecodeError:
        return None

    if not isinstance(value, dict):
        return None

    timestamp = parse_datetime(
        find_first(
            value,
            (
                "@timestamp",
                "timestamp",
                "time",
                "datetime",
                "date",
            ),
        )
    )

    raw_level = find_first(
        value,
        (
            "level",
            "severity",
            "log_level",
            "logLevel",
        ),
    )

    raw_message = find_first(
        value,
        (
            "message",
            "msg",
            "event",
            "description",
        ),
    )

    message = (
        raw_message
        if isinstance(raw_message, str)
        else json.dumps(
            value,
            ensure_ascii=False,
        )
    )

    raw_ip = find_first(
        value,
        (
            "ip",
            "client_ip",
            "remote_addr",
            "source_ip",
            "src_ip",
        ),
    )

    ip_value = (
        raw_ip
        if isinstance(raw_ip, str)
        else extract_ip(message)
    )

    raw_status = find_first(
        value,
        (
            "status",
            "status_code",
            "statusCode",
            "http_status",
        ),
    )

    status_code = (
        raw_status
        if isinstance(raw_status, int)
        and not isinstance(raw_status, bool)
        else None
    )

    method = find_first(
        value,
        (
            "method",
            "http_method",
            "request_method",
        ),
    )

    path = find_first(
        value,
        (
            "path",
            "url",
            "uri",
            "request_uri",
        ),
    )

    user_agent = find_first(
        value,
        (
            "user_agent",
            "userAgent",
            "http_user_agent",
        ),
    )

    source = find_first(
        value,
        (
            "source",
            "service",
            "logger",
            "process",
            "application",
        ),
    )

    level = normalize_level(
        raw_level
        if isinstance(raw_level, str)
        else None
    )

    if status_code is not None:
        if status_code >= 500:
            level = "error"
        elif status_code >= 400 and level == "other":
            level = "warning"

    return {
        "format": "json-lines",
        "timestamp": timestamp,
        "level": level,
        "source":
            source
            if isinstance(source, str)
            else "JSON",

        "message": message,
        "ip": ip_value,
        "method":
            method
            if isinstance(method, str)
            else None,

        "path":
            path
            if isinstance(path, str)
            else None,

        "statusCode": status_code,
        "userAgent":
            user_agent
            if isinstance(user_agent, str)
            else None,

        "authFailed": bool(
            FAILED_AUTH_PATTERN.search(message)
        ),
        "authSuccess": bool(
            SUCCESS_AUTH_PATTERN.search(message)
        ),
        "invalidUser": bool(
            INVALID_USER_PATTERN.search(message)
        ),
        "sudoEvent": bool(
            SUDO_PATTERN.search(message)
        ),
    }


def parse_generic_line(
    line: str,
) -> dict[str, Any]:
    timestamp_match = ISO_TIMESTAMP_PATTERN.search(line)
    level_match = LEVEL_PATTERN.search(line)

    timestamp = parse_datetime(
        timestamp_match.group("timestamp")
        if timestamp_match
        else None
    )

    return {
        "format": "generic",
        "timestamp": timestamp,
        "level": normalize_level(
            level_match.group(1)
            if level_match
            else None
        ),
        "source": "Generic",
        "message": line,
        "ip": extract_ip(line),
        "method": None,
        "path": None,
        "statusCode": None,
        "userAgent": None,
        "authFailed": bool(
            FAILED_AUTH_PATTERN.search(line)
        ),
        "authSuccess": bool(
            SUCCESS_AUTH_PATTERN.search(line)
        ),
        "invalidUser": bool(
            INVALID_USER_PATTERN.search(line)
        ),
        "sudoEvent": bool(
            SUDO_PATTERN.search(line)
        ),
    }


def detect_format(
    sample_lines: list[str],
) -> str:
    scores = {
        "http": 0,
        "ssh-auth": 0,
        "json-lines": 0,
    }

    for line in sample_lines:
        if HTTP_PATTERN.match(line):
            scores["http"] += 1

        if SYSLOG_PATTERN.match(line):
            scores["ssh-auth"] += 1

        if line.lstrip().startswith("{"):
            try:
                parsed = json.loads(line)

                if isinstance(parsed, dict):
                    scores["json-lines"] += 1
            except json.JSONDecodeError:
                pass

    best_format = max(
        scores,
        key=scores.get,
    )

    if scores[best_format] == 0:
        return "generic"

    return best_format


def parse_line(
    line: str,
    detected_format: str,
) -> dict[str, Any]:
    parsers = {
        "http": parse_http_line,
        "ssh-auth": parse_syslog_line,
        "json-lines": parse_json_line,
    }

    parser = parsers.get(
        detected_format
    )

    if parser:
        parsed = parser(line)

        if parsed is not None:
            return parsed

    for fallback in (
        parse_http_line,
        parse_syslog_line,
        parse_json_line,
    ):
        parsed = fallback(line)

        if parsed is not None:
            return parsed

    return parse_generic_line(line)


def top_items(
    counter: Counter[str],
) -> list[dict[str, Any]]:
    return [
        {
            "value": value,
            "count": count,
        }
        for value, count in counter.most_common(
            TOP_ITEMS_LIMIT
        )
    ]


def should_sample_event(
    event: dict[str, Any],
    sample_count: int,
) -> bool:
    if sample_count >= MAX_EVENT_SAMPLES:
        return False

    if event["level"] in {
        "error",
        "warning",
    }:
        return True

    if (
        event["authFailed"]
        or event["authSuccess"]
        or event["sudoEvent"]
    ):
        return True

    return sample_count < 150


def inspect_log_file(
    payload: dict[str, Any],
) -> dict[str, Any]:
    raw_path = require_string(
        payload,
        "filePath",
    )

    if not raw_path.strip():
        raise InvalidRequestError(
            "O caminho do arquivo está vazio."
        )

    if len(raw_path) > 4096:
        raise InvalidRequestError(
            "O caminho do arquivo excede o limite permitido."
        )

    file_path = Path(
        raw_path
    ).expanduser()

    try:
        stats = file_path.stat()
    except FileNotFoundError as error:
        raise ZeroHubError(
            "O arquivo de log não foi encontrado."
        ) from error
    except PermissionError as error:
        raise ZeroHubError(
            "O ZeroHub não possui permissão para acessar o log."
        ) from error
    except OSError as error:
        raise ZeroHubError(
            f"Não foi possível acessar o log: {error}"
        ) from error

    if not file_path.is_file():
        raise InvalidRequestError(
            "O caminho selecionado não representa um arquivo."
        )

    sample_lines: list[str] = []

    try:
        with file_path.open(
            "r",
            encoding="utf-8",
            errors="replace",
        ) as file:
            for line in file:
                stripped = line.rstrip(
                    "\r\n"
                )

                if not stripped:
                    continue

                sample_lines.append(
                    stripped[:MAX_LINE_LENGTH]
                )

                if len(sample_lines) >= 200:
                    break

    except PermissionError as error:
        raise ZeroHubError(
            "O ZeroHub não possui permissão para ler o log."
        ) from error
    except OSError as error:
        raise ZeroHubError(
            f"Não foi possível ler o log: {error}"
        ) from error

    detected_format = detect_format(
        sample_lines
    )

    total_lines = 0
    parsed_lines = 0
    malformed_lines = 0
    truncated = False

    levels: Counter[str] = Counter()
    ips: Counter[str] = Counter()
    methods: Counter[str] = Counter()
    paths: Counter[str] = Counter()
    user_agents: Counter[str] = Counter()
    status_codes: Counter[str] = Counter()
    sources: Counter[str] = Counter()

    timeline: dict[str, dict[str, int]] = {}

    auth_failed = 0
    auth_success = 0
    invalid_users = 0
    sudo_events = 0

    first_timestamp: datetime | None = None
    last_timestamp: datetime | None = None

    event_samples: list[dict[str, Any]] = []

    try:
        with file_path.open(
            "r",
            encoding="utf-8",
            errors="replace",
        ) as file:
            for line_number, raw_line in enumerate(
                file,
                start=1,
            ):
                if total_lines >= MAX_LINES:
                    truncated = True
                    break

                total_lines += 1

                line = raw_line.rstrip(
                    "\r\n"
                )

                if len(line) > MAX_LINE_LENGTH:
                    line = (
                        line[:MAX_LINE_LENGTH]
                        + "…"
                    )

                if not line:
                    malformed_lines += 1
                    continue

                event = parse_line(
                    line,
                    detected_format,
                )

                if event["format"] == "generic":
                    malformed_lines += 1
                else:
                    parsed_lines += 1

                levels[
                    event["level"]
                ] += 1

                source = event["source"]

                if source:
                    sources[str(source)] += 1

                ip_value = event["ip"]

                if ip_value:
                    try:
                        normalized_ip = str(
                            ipaddress.ip_address(
                                ip_value
                            )
                        )

                        ips[normalized_ip] += 1
                        event["ip"] = normalized_ip
                    except ValueError:
                        event["ip"] = None

                method = event["method"]

                if method:
                    methods[str(method)] += 1

                path = event["path"]

                if path:
                    paths[str(path)] += 1

                user_agent = event["userAgent"]

                if user_agent:
                    user_agents[
                        str(user_agent)
                    ] += 1

                status_code = event["statusCode"]

                if status_code is not None:
                    status_codes[
                        str(status_code)
                    ] += 1

                if event["authFailed"]:
                    auth_failed += 1

                if event["authSuccess"]:
                    auth_success += 1

                if event["invalidUser"]:
                    invalid_users += 1

                if event["sudoEvent"]:
                    sudo_events += 1

                timestamp = event["timestamp"]

                if timestamp is not None:
                    if (
                        first_timestamp is None
                        or timestamp < first_timestamp
                    ):
                        first_timestamp = timestamp

                    if (
                        last_timestamp is None
                        or timestamp > last_timestamp
                    ):
                        last_timestamp = timestamp

                    bucket = timeline_bucket(
                        timestamp
                    )

                    if bucket:
                        data = timeline.setdefault(
                            bucket,
                            {
                                "count": 0,
                                "errors": 0,
                                "warnings": 0,
                            },
                        )

                        data["count"] += 1

                        if event["level"] == "error":
                            data["errors"] += 1
                        elif event["level"] == "warning":
                            data["warnings"] += 1

                if should_sample_event(
                    event,
                    len(event_samples),
                ):
                    event_samples.append({
                        "lineNumber": line_number,
                        "timestamp": timestamp_iso(
                            timestamp
                        ),
                        "level": event["level"],
                        "source": str(
                            event["source"]
                        ),
                        "message": str(
                            event["message"]
                        )[:1000],
                        "ip": event["ip"],
                        "method": event["method"],
                        "statusCode":
                            event["statusCode"],

                        "path": event["path"],
                    })

    except PermissionError as error:
        raise ZeroHubError(
            "O ZeroHub não possui permissão para ler o log."
        ) from error
    except OSError as error:
        raise ZeroHubError(
            f"Não foi possível analisar o log: {error}"
        ) from error

    timeline_items = [
        {
            "bucket": bucket,
            "count": data["count"],
            "errors": data["errors"],
            "warnings": data["warnings"],
        }
        for bucket, data in sorted(
            timeline.items()
        )[-240:]
    ]

    return {
        "fileName": file_path.name,
        "filePath": str(file_path.resolve()),
        "sizeBytes": stats.st_size,
        "detectedFormat": detected_format,
        "totalLines": total_lines,
        "parsedLines": parsed_lines,
        "malformedLines": malformed_lines,
        "truncated": truncated,
        "firstTimestamp": timestamp_iso(
            first_timestamp
        ),
        "lastTimestamp": timestamp_iso(
            last_timestamp
        ),
        "levels": {
            "error": levels["error"],
            "warning": levels["warning"],
            "info": levels["info"],
            "debug": levels["debug"],
            "other": levels["other"],
        },
        "auth": {
            "failed": auth_failed,
            "successful": auth_success,
            "invalidUsers": invalid_users,
            "sudoEvents": sudo_events,
        },
        "topIps": top_items(ips),
        "topMethods": top_items(methods),
        "topPaths": top_items(paths),
        "topUserAgents": top_items(user_agents),
        "statusCodes": top_items(status_codes),
        "topSources": top_items(sources),
        "timeline": timeline_items,
        "eventSamples": event_samples,
    }
