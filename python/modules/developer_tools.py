from __future__ import annotations

import difflib
import email.utils
import json
import math
import re
import signal
import time
import tomllib
import uuid
from datetime import datetime, timezone
from typing import Any

from core.errors import (
    InvalidRequestError,
    ZeroHubError,
)


MAX_TEXT_LENGTH = 2_000_000
MAX_PATTERN_LENGTH = 20_000
MAX_REGEX_MATCHES = 500
MAX_UUID_COUNT = 200
REGEX_TIMEOUT_SECONDS = 1.5

REGEX_FLAGS = {
    "i": re.IGNORECASE,
    "m": re.MULTILINE,
    "s": re.DOTALL,
    "x": re.VERBOSE,
    "a": re.ASCII,
}

UUID_NAMESPACES = {
    "dns": uuid.NAMESPACE_DNS,
    "url": uuid.NAMESPACE_URL,
    "oid": uuid.NAMESPACE_OID,
    "x500": uuid.NAMESPACE_X500,
}

BARE_TOML_KEY = re.compile(
    r"^[A-Za-z0-9_-]+$"
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


def require_integer(
    payload: dict[str, Any],
    field: str,
) -> int:
    value = payload.get(field)

    if isinstance(value, bool) or not isinstance(value, int):
        raise InvalidRequestError(
            f"O campo '{field}' precisa ser um número inteiro."
        )

    return value


def require_boolean(
    payload: dict[str, Any],
    field: str,
) -> bool:
    value = payload.get(field)

    if not isinstance(value, bool):
        raise InvalidRequestError(
            f"O campo '{field}' precisa ser booleano."
        )

    return value


def validate_text(
    value: str,
    field: str,
    maximum: int = MAX_TEXT_LENGTH,
) -> None:
    if len(value) > maximum:
        raise InvalidRequestError(
            f"O campo '{field}' excede o limite permitido."
        )


def json_format(
    payload: dict[str, Any],
) -> dict[str, Any]:
    text = require_string(
        payload,
        "text",
    )

    indent = require_integer(
        payload,
        "indent",
    )

    sort_keys = require_boolean(
        payload,
        "sortKeys",
    )

    minify = require_boolean(
        payload,
        "minify",
    )

    validate_text(
        text,
        "text",
    )

    if indent not in {
        2,
        4,
    }:
        raise InvalidRequestError(
            "A indentação JSON precisa ser 2 ou 4."
        )

    try:
        value = json.loads(text)
    except json.JSONDecodeError as error:
        raise InvalidRequestError(
            f"JSON inválido na linha {error.lineno}, coluna {error.colno}: {error.msg}"
        ) from error

    if minify:
        output = json.dumps(
            value,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=sort_keys,
        )
    else:
        output = json.dumps(
            value,
            ensure_ascii=False,
            indent=indent,
            sort_keys=sort_keys,
        )

    return {
        "valid": True,
        "output": output,
        "rootType": type(value).__name__,
        "characterCount": len(output),
    }


def strip_yaml_comment(
    line: str,
) -> str:
    single = False
    double = False
    escaped = False

    for index, character in enumerate(line):
        if escaped:
            escaped = False
            continue

        if character == "\\" and double:
            escaped = True
            continue

        if character == "'" and not double:
            single = not single
            continue

        if character == '"' and not single:
            double = not double
            continue

        if character == "#" and not single and not double:
            if index == 0 or line[index - 1].isspace():
                return line[:index].rstrip()

    return line.rstrip()


def split_yaml_key_value(
    text: str,
) -> tuple[str, str] | None:
    single = False
    double = False
    escaped = False
    depth = 0

    for index, character in enumerate(text):
        if escaped:
            escaped = False
            continue

        if character == "\\" and double:
            escaped = True
            continue

        if character == "'" and not double:
            single = not single
            continue

        if character == '"' and not single:
            double = not double
            continue

        if single or double:
            continue

        if character in "[{(":
            depth += 1
            continue

        if character in "]})":
            depth = max(
                0,
                depth - 1,
            )
            continue

        if character == ":" and depth == 0:
            return (
                text[:index].strip(),
                text[index + 1:].strip(),
            )

    return None


def parse_yaml_scalar(
    value: str,
) -> Any:
    text = value.strip()

    if text == "":
        return ""

    lowered = text.lower()

    if lowered in {
        "null",
        "~",
    }:
        return None

    if lowered in {
        "true",
        "yes",
        "on",
    }:
        return True

    if lowered in {
        "false",
        "no",
        "off",
    }:
        return False

    if text.startswith('"') and text.endswith('"'):
        try:
            return json.loads(text)
        except json.JSONDecodeError as error:
            raise InvalidRequestError(
                f"String YAML inválida: {error.msg}"
            ) from error

    if text.startswith("'") and text.endswith("'"):
        return text[1:-1].replace(
            "''",
            "'",
        )

    if (
        text.startswith("[")
        or text.startswith("{")
    ):
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

    integer_pattern = re.fullmatch(
        r"[-+]?(?:0|[1-9][0-9_]*)",
        text,
    )

    if integer_pattern:
        try:
            return int(
                text.replace("_", "")
            )
        except ValueError:
            pass

    float_pattern = re.fullmatch(
        r"[-+]?(?:"
        r"(?:[0-9][0-9_]*)?\.[0-9_]+"
        r"|"
        r"[0-9][0-9_]*[eE][-+]?[0-9]+"
        r"|"
        r"(?:[0-9][0-9_]*)?\.[0-9_]+[eE][-+]?[0-9]+"
        r")",
        text,
    )

    if float_pattern:
        try:
            return float(
                text.replace("_", "")
            )
        except ValueError:
            pass

    if text.startswith(
        (
            "&",
            "*",
            "!",
            "|",
            ">",
        )
    ):
        raise InvalidRequestError(
            "Este conversor YAML não suporta anchors, tags ou blocos multilinha."
        )

    return text


def normalize_yaml_key(
    raw_key: str,
) -> str:
    key = raw_key.strip()

    if not key:
        raise InvalidRequestError(
            "Uma chave YAML está vazia."
        )

    if (
        key.startswith('"')
        and key.endswith('"')
    ):
        try:
            decoded = json.loads(key)
        except json.JSONDecodeError as error:
            raise InvalidRequestError(
                f"Chave YAML inválida: {error.msg}"
            ) from error

        if not isinstance(decoded, str):
            raise InvalidRequestError(
                "A chave YAML precisa ser textual."
            )

        return decoded

    if (
        key.startswith("'")
        and key.endswith("'")
    ):
        return key[1:-1].replace(
            "''",
            "'",
        )

    return key


def prepare_yaml_lines(
    text: str,
) -> list[tuple[int, str, int]]:
    prepared: list[tuple[int, str, int]] = []

    for line_number, raw_line in enumerate(
        text.splitlines(),
        start=1,
    ):
        if "\t" in raw_line:
            raise InvalidRequestError(
                f"YAML com tabulação não é suportado, linha {line_number}."
            )

        clean = strip_yaml_comment(
            raw_line
        )

        if not clean.strip():
            continue

        indent = len(clean) - len(
            clean.lstrip(" ")
        )

        prepared.append((
            indent,
            clean.strip(),
            line_number,
        ))

    return prepared


def parse_yaml_block(
    lines: list[tuple[int, str, int]],
    index: int,
    indent: int,
) -> tuple[Any, int]:
    if index >= len(lines):
        return {}, index

    first_indent, first_text, first_line = lines[index]

    if first_indent != indent:
        raise InvalidRequestError(
            f"Indentação YAML inesperada na linha {first_line}."
        )

    is_list = (
        first_text == "-"
        or first_text.startswith("- ")
    )

    if is_list:
        output_list: list[Any] = []

        while index < len(lines):
            current_indent, text, line_number = lines[index]

            if current_indent < indent:
                break

            if current_indent > indent:
                raise InvalidRequestError(
                    f"Indentação YAML inesperada na linha {line_number}."
                )

            if not (
                text == "-"
                or text.startswith("- ")
            ):
                break

            item_text = (
                text[1:].strip()
            )

            index += 1

            if item_text == "":
                if (
                    index < len(lines)
                    and lines[index][0] > indent
                ):
                    child_indent = lines[index][0]
                    child, index = parse_yaml_block(
                        lines,
                        index,
                        child_indent,
                    )

                    output_list.append(
                        child
                    )
                else:
                    output_list.append(
                        None
                    )

                continue

            inline_pair = split_yaml_key_value(
                item_text
            )

            if inline_pair:
                key = normalize_yaml_key(
                    inline_pair[0]
                )

                raw_value = inline_pair[1]
                item_map: dict[str, Any] = {}

                if raw_value == "":
                    if (
                        index < len(lines)
                        and lines[index][0] > indent
                    ):
                        child_indent = lines[index][0]
                        child, index = parse_yaml_block(
                            lines,
                            index,
                            child_indent,
                        )

                        item_map[key] = child
                    else:
                        item_map[key] = None
                else:
                    item_map[key] = parse_yaml_scalar(
                        raw_value
                    )

                while (
                    index < len(lines)
                    and lines[index][0] > indent
                ):
                    child_indent, child_text, child_line = lines[index]

                    if (
                        child_text == "-"
                        or child_text.startswith("- ")
                    ):
                        raise InvalidRequestError(
                            f"Lista inesperada na linha {child_line}."
                        )

                    pair = split_yaml_key_value(
                        child_text
                    )

                    if not pair:
                        raise InvalidRequestError(
                            f"Mapeamento YAML inválido na linha {child_line}."
                        )

                    child_key = normalize_yaml_key(
                        pair[0]
                    )

                    if child_key in item_map:
                        raise InvalidRequestError(
                            f"Chave YAML duplicada '{child_key}' na linha {child_line}."
                        )

                    child_value = pair[1]
                    index += 1

                    if child_value == "":
                        if (
                            index < len(lines)
                            and lines[index][0] > child_indent
                        ):
                            nested_indent = lines[index][0]
                            nested, index = parse_yaml_block(
                                lines,
                                index,
                                nested_indent,
                            )

                            item_map[child_key] = nested
                        else:
                            item_map[child_key] = None
                    else:
                        item_map[child_key] = parse_yaml_scalar(
                            child_value
                        )

                output_list.append(
                    item_map
                )
            else:
                output_list.append(
                    parse_yaml_scalar(
                        item_text
                    )
                )

        return output_list, index

    output_map: dict[str, Any] = {}

    while index < len(lines):
        current_indent, text, line_number = lines[index]

        if current_indent < indent:
            break

        if current_indent > indent:
            raise InvalidRequestError(
                f"Indentação YAML inesperada na linha {line_number}."
            )

        if (
            text == "-"
            or text.startswith("- ")
        ):
            break

        pair = split_yaml_key_value(
            text
        )

        if not pair:
            raise InvalidRequestError(
                f"Mapeamento YAML inválido na linha {line_number}."
            )

        key = normalize_yaml_key(
            pair[0]
        )

        if key in output_map:
            raise InvalidRequestError(
                f"Chave YAML duplicada '{key}' na linha {line_number}."
            )

        raw_value = pair[1]
        index += 1

        if raw_value == "":
            if (
                index < len(lines)
                and lines[index][0] > indent
            ):
                child_indent = lines[index][0]
                child, index = parse_yaml_block(
                    lines,
                    index,
                    child_indent,
                )

                output_map[key] = child
            else:
                output_map[key] = None
        else:
            output_map[key] = parse_yaml_scalar(
                raw_value
            )

    return output_map, index


def yaml_load_subset(
    text: str,
) -> Any:
    lines = prepare_yaml_lines(
        text
    )

    if not lines:
        return None

    root_indent = lines[0][0]
    value, index = parse_yaml_block(
        lines,
        0,
        root_indent,
    )

    if index != len(lines):
        _, _, line_number = lines[index]

        raise InvalidRequestError(
            f"Não foi possível interpretar o YAML a partir da linha {line_number}."
        )

    return value


def yaml_scalar_dump(
    value: Any,
) -> str:
    if value is None:
        return "null"

    if value is True:
        return "true"

    if value is False:
        return "false"

    if isinstance(value, (int, float)):
        if (
            isinstance(value, float)
            and not math.isfinite(value)
        ):
            raise InvalidRequestError(
                "NaN e infinito não são serializados para YAML."
            )

        return str(value).lower()

    if isinstance(value, str):
        if value == "":
            return '""'

        if re.fullmatch(
            r"[A-Za-z0-9_./@+-]+",
            value,
        ) and value.lower() not in {
            "null",
            "true",
            "false",
            "yes",
            "no",
            "on",
            "off",
            "~",
        }:
            return value

        return json.dumps(
            value,
            ensure_ascii=False,
        )

    raise InvalidRequestError(
        f"Tipo não suportado no YAML: {type(value).__name__}."
    )


def yaml_dump_subset(
    value: Any,
    indent: int = 0,
) -> list[str]:
    prefix = " " * indent

    if isinstance(value, dict):
        lines: list[str] = []

        for key, item in value.items():
            key_text = (
                str(key)
                if re.fullmatch(
                    r"[A-Za-z0-9_.-]+",
                    str(key),
                )
                else json.dumps(
                    str(key),
                    ensure_ascii=False,
                )
            )

            if isinstance(item, (dict, list)):
                lines.append(
                    f"{prefix}{key_text}:"
                )

                lines.extend(
                    yaml_dump_subset(
                        item,
                        indent + 2,
                    )
                )
            else:
                lines.append(
                    f"{prefix}{key_text}: {yaml_scalar_dump(item)}"
                )

        return lines or [
            f"{prefix}{{}}"
        ]

    if isinstance(value, list):
        lines = []

        for item in value:
            if isinstance(item, dict):
                if not item:
                    lines.append(
                        f"{prefix}- {{}}"
                    )

                    continue

                entries = list(
                    item.items()
                )

                first_key, first_value = entries[0]
                first_key_text = str(
                    first_key
                )

                if isinstance(first_value, (dict, list)):
                    lines.append(
                        f"{prefix}- {first_key_text}:"
                    )

                    lines.extend(
                        yaml_dump_subset(
                            first_value,
                            indent + 4,
                        )
                    )
                else:
                    lines.append(
                        f"{prefix}- {first_key_text}: {yaml_scalar_dump(first_value)}"
                    )

                for key, nested_value in entries[1:]:
                    key_text = str(key)

                    if isinstance(nested_value, (dict, list)):
                        lines.append(
                            f"{prefix}  {key_text}:"
                        )

                        lines.extend(
                            yaml_dump_subset(
                                nested_value,
                                indent + 4,
                            )
                        )
                    else:
                        lines.append(
                            f"{prefix}  {key_text}: {yaml_scalar_dump(nested_value)}"
                        )

            elif isinstance(item, list):
                lines.append(
                    f"{prefix}-"
                )

                lines.extend(
                    yaml_dump_subset(
                        item,
                        indent + 2,
                    )
                )
            else:
                lines.append(
                    f"{prefix}- {yaml_scalar_dump(item)}"
                )

        return lines or [
            f"{prefix}[]"
        ]

    return [
        f"{prefix}{yaml_scalar_dump(value)}"
    ]


def yaml_convert(
    payload: dict[str, Any],
) -> dict[str, Any]:
    text = require_string(
        payload,
        "text",
    )

    direction = require_string(
        payload,
        "direction",
    )

    validate_text(
        text,
        "text",
    )

    if direction == "yaml-to-json":
        value = yaml_load_subset(
            text
        )

        output = json.dumps(
            value,
            ensure_ascii=False,
            indent=2,
        )

    elif direction == "json-to-yaml":
        try:
            value = json.loads(text)
        except json.JSONDecodeError as error:
            raise InvalidRequestError(
                f"JSON inválido na linha {error.lineno}, coluna {error.colno}: {error.msg}"
            ) from error

        output = "\n".join(
            yaml_dump_subset(
                value
            )
        )

    else:
        raise InvalidRequestError(
            "Direção YAML inválida."
        )

    return {
        "direction": direction,
        "output": output,
    }


def toml_key(
    key: str,
) -> str:
    if BARE_TOML_KEY.fullmatch(
        key
    ):
        return key

    return json.dumps(
        key,
        ensure_ascii=False,
    )


def toml_value(
    value: Any,
) -> str:
    if isinstance(value, str):
        return json.dumps(
            value,
            ensure_ascii=False,
        )

    if value is True:
        return "true"

    if value is False:
        return "false"

    if isinstance(value, int):
        return str(value)

    if isinstance(value, float):
        if not math.isfinite(value):
            raise InvalidRequestError(
                "NaN e infinito não são suportados pelo conversor TOML."
            )

        return repr(value)

    if isinstance(value, list):
        if any(
            isinstance(item, dict)
            for item in value
        ):
            raise InvalidRequestError(
                "Arrays de objetos são serializados apenas como array of tables."
            )

        return "["
        + ", ".join(
            toml_value(item)
            for item in value
        )
        + "]"

    if isinstance(value, datetime):
        return value.isoformat()

    if value is None:
        raise InvalidRequestError(
            "TOML não possui valor null."
        )

    raise InvalidRequestError(
        f"Tipo não suportado no TOML: {type(value).__name__}."
    )


def toml_dump_document(
    value: Any,
) -> str:
    if not isinstance(value, dict):
        raise InvalidRequestError(
            "O documento JSON raiz precisa ser um objeto para virar TOML."
        )

    lines: list[str] = []

    def write_table(
        table: dict[str, Any],
        path: list[str],
        emit_header: bool,
    ) -> None:
        scalar_items: list[tuple[str, Any]] = []
        nested_tables: list[tuple[str, dict[str, Any]]] = []
        array_tables: list[tuple[str, list[dict[str, Any]]]] = []

        for key, item in table.items():
            key_text = str(key)

            if isinstance(item, dict):
                nested_tables.append(
                    (
                        key_text,
                        item,
                    )
                )

            elif (
                isinstance(item, list)
                and item
                and all(
                    isinstance(entry, dict)
                    for entry in item
                )
            ):
                array_tables.append(
                    (
                        key_text,
                        item,
                    )
                )

            else:
                scalar_items.append(
                    (
                        key_text,
                        item,
                    )
                )

        if emit_header:
            if lines and lines[-1] != "":
                lines.append("")

            lines.append(
                "["
                + ".".join(
                    toml_key(part)
                    for part in path
                )
                + "]"
            )

        for key, item in scalar_items:
            lines.append(
                f"{toml_key(key)} = {toml_value(item)}"
            )

        for key, nested in nested_tables:
            write_table(
                nested,
                [
                    *path,
                    key,
                ],
                True,
            )

        for key, entries in array_tables:
            for entry in entries:
                if lines and lines[-1] != "":
                    lines.append("")

                lines.append(
                    "[["
                    + ".".join(
                        toml_key(part)
                        for part in [
                            *path,
                            key,
                        ]
                    )
                    + "]]"
                )

                for entry_key, entry_value in entry.items():
                    if isinstance(
                        entry_value,
                        dict,
                    ):
                        raise InvalidRequestError(
                            "Objetos aninhados dentro de array of tables ainda não são suportados."
                        )

                    lines.append(
                        f"{toml_key(str(entry_key))} = {toml_value(entry_value)}"
                    )

    write_table(
        value,
        [],
        False,
    )

    return "\n".join(
        lines
    ).strip() + "\n"


def toml_convert(
    payload: dict[str, Any],
) -> dict[str, Any]:
    text = require_string(
        payload,
        "text",
    )

    direction = require_string(
        payload,
        "direction",
    )

    validate_text(
        text,
        "text",
    )

    if direction == "toml-to-json":
        try:
            value = tomllib.loads(
                text
            )
        except tomllib.TOMLDecodeError as error:
            raise InvalidRequestError(
                f"TOML inválido: {error}"
            ) from error

        output = json.dumps(
            value,
            ensure_ascii=False,
            indent=2,
            default=str,
        )

    elif direction == "json-to-toml":
        try:
            value = json.loads(
                text
            )
        except json.JSONDecodeError as error:
            raise InvalidRequestError(
                f"JSON inválido na linha {error.lineno}, coluna {error.colno}: {error.msg}"
            ) from error

        output = toml_dump_document(
            value
        )

    else:
        raise InvalidRequestError(
            "Direção TOML inválida."
        )

    return {
        "direction": direction,
        "output": output,
    }


class RegexTimeoutError(Exception):
    pass


def regex_alarm_handler(
    signum: int,
    frame: Any,
) -> None:
    del signum, frame
    raise RegexTimeoutError()


def regex_test(
    payload: dict[str, Any],
) -> dict[str, Any]:
    pattern = require_string(
        payload,
        "pattern",
    )

    text = require_string(
        payload,
        "text",
    )

    flags_text = require_string(
        payload,
        "flags",
    )

    replacement = require_string(
        payload,
        "replacement",
    )

    validate_text(
        pattern,
        "pattern",
        MAX_PATTERN_LENGTH,
    )

    validate_text(
        text,
        "text",
    )

    validate_text(
        replacement,
        "replacement",
    )

    flags_value = 0
    unknown_flags = []

    for flag in flags_text:
        if flag in REGEX_FLAGS:
            flags_value |= REGEX_FLAGS[
                flag
            ]
        elif flag not in unknown_flags:
            unknown_flags.append(
                flag
            )

    if unknown_flags:
        raise InvalidRequestError(
            "Flags regex desconhecidas: "
            + ", ".join(
                unknown_flags
            )
        )

    try:
        compiled = re.compile(
            pattern,
            flags_value,
        )
    except re.error as error:
        raise InvalidRequestError(
            f"Regex inválida: {error}"
        ) from error

    previous_handler = signal.getsignal(
        signal.SIGALRM
    )

    signal.signal(
        signal.SIGALRM,
        regex_alarm_handler,
    )

    signal.setitimer(
        signal.ITIMER_REAL,
        REGEX_TIMEOUT_SECONDS,
    )

    started_at = time.perf_counter()

    try:
        matches = []

        for index, match in enumerate(
            compiled.finditer(text)
        ):
            if index >= MAX_REGEX_MATCHES:
                break

            matches.append({
                "index": index,
                "match": match.group(0),
                "start": match.start(),
                "end": match.end(),
                "groups": list(
                    match.groups()
                ),
                "groupDict":
                    match.groupdict(),
            })

        replaced = (
            compiled.sub(
                replacement,
                text,
            )
            if replacement != ""
            else None
        )

    except RegexTimeoutError as error:
        raise ZeroHubError(
            "A expressão regular excedeu o limite de tempo."
        ) from error

    finally:
        signal.setitimer(
            signal.ITIMER_REAL,
            0,
        )

        signal.signal(
            signal.SIGALRM,
            previous_handler,
        )

    return {
        "valid": True,
        "flags": flags_text,
        "matchCount": len(matches),
        "truncated":
            len(matches)
            >= MAX_REGEX_MATCHES,

        "elapsedMs": round(
            (
                time.perf_counter()
                - started_at
            )
            * 1000,
            3,
        ),

        "matches": matches,
        "replaced": replaced,
    }


def uuid_generate(
    payload: dict[str, Any],
) -> dict[str, Any]:
    version = require_string(
        payload,
        "version",
    )

    count = require_integer(
        payload,
        "count",
    )

    namespace_name = require_string(
        payload,
        "namespace",
    )

    name = require_string(
        payload,
        "name",
    )

    if count < 1 or count > MAX_UUID_COUNT:
        raise InvalidRequestError(
            f"A quantidade precisa estar entre 1 e {MAX_UUID_COUNT}."
        )

    values: list[str] = []

    if version == "4":
        values = [
            str(uuid.uuid4())
            for _ in range(count)
        ]

    elif version == "5":
        namespace = UUID_NAMESPACES.get(
            namespace_name
        )

        if namespace is None:
            raise InvalidRequestError(
                "Namespace UUID v5 inválido."
            )

        if not name:
            raise InvalidRequestError(
                "UUID v5 exige um nome."
            )

        validate_text(
            name,
            "name",
            100_000,
        )

        values = [
            str(
                uuid.uuid5(
                    namespace,
                    (
                        name
                        if count == 1
                        else f"{name}:{index}"
                    ),
                )
            )
            for index in range(count)
        ]

    else:
        raise InvalidRequestError(
            "Versão UUID suportada: 4 ou 5."
        )

    return {
        "version": version,
        "count": count,
        "values": values,
    }


def parse_timestamp_input(
    raw_value: str,
) -> datetime:
    text = raw_value.strip()

    if not text:
        return datetime.now(
            timezone.utc
        )

    numeric = re.fullmatch(
        r"[-+]?\d+(?:\.\d+)?",
        text,
    )

    if numeric:
        number = float(text)

        if abs(number) >= 100_000_000_000:
            number /= 1000

        try:
            return datetime.fromtimestamp(
                number,
                tz=timezone.utc,
            )
        except (
            ValueError,
            OverflowError,
            OSError,
        ) as error:
            raise InvalidRequestError(
                "Timestamp fora do intervalo suportado."
            ) from error

    normalized = (
        text[:-1] + "+00:00"
        if text.endswith("Z")
        else text
    )

    try:
        parsed = datetime.fromisoformat(
            normalized
        )
    except ValueError as error:
        raise InvalidRequestError(
            "Use Unix seconds, Unix milliseconds ou uma data ISO 8601."
        ) from error

    if parsed.tzinfo is None:
        parsed = parsed.replace(
            tzinfo=timezone.utc
        )

    return parsed.astimezone(
        timezone.utc
    )


def timestamp_convert(
    payload: dict[str, Any],
) -> dict[str, Any]:
    raw_value = require_string(
        payload,
        "value",
    )

    parsed = parse_timestamp_input(
        raw_value
    )

    local = parsed.astimezone()
    unix_seconds = parsed.timestamp()

    return {
        "input": raw_value,
        "unixSeconds": unix_seconds,
        "unixMilliseconds": round(
            unix_seconds * 1000
        ),
        "isoUtc":
            parsed.isoformat()
            .replace(
                "+00:00",
                "Z",
            ),

        "isoLocal":
            local.isoformat(),

        "rfc2822":
            email.utils.format_datetime(
                parsed
            ),

        "dateUtc":
            parsed.strftime(
                "%Y-%m-%d"
            ),

        "timeUtc":
            parsed.strftime(
                "%H:%M:%S.%f"
            ).rstrip("0").rstrip("."),

        "timezoneLocal":
            str(local.tzinfo),
    }


def diff_text(
    payload: dict[str, Any],
) -> dict[str, Any]:
    left = require_string(
        payload,
        "left",
    )

    right = require_string(
        payload,
        "right",
    )

    left_label = require_string(
        payload,
        "leftLabel",
    )

    right_label = require_string(
        payload,
        "rightLabel",
    )

    validate_text(
        left,
        "left",
    )

    validate_text(
        right,
        "right",
    )

    left_lines = left.splitlines()
    right_lines = right.splitlines()

    unified = "\n".join(
        difflib.unified_diff(
            left_lines,
            right_lines,
            fromfile=left_label or "before",
            tofile=right_label or "after",
            lineterm="",
        )
    )

    matcher = difflib.SequenceMatcher(
        None,
        left_lines,
        right_lines,
        autojunk=False,
    )

    changes = []
    added = 0
    removed = 0
    replaced = 0

    for tag, left_start, left_end, right_start, right_end in matcher.get_opcodes():
        if tag == "equal":
            continue

        if tag == "insert":
            added += (
                right_end
                - right_start
            )
        elif tag == "delete":
            removed += (
                left_end
                - left_start
            )
        elif tag == "replace":
            removed += (
                left_end
                - left_start
            )

            added += (
                right_end
                - right_start
            )

            replaced += 1

        changes.append({
            "type": tag,
            "leftStart": left_start + 1,
            "leftEnd": left_end,
            "rightStart": right_start + 1,
            "rightEnd": right_end,
            "leftLines":
                left_lines[
                    left_start:left_end
                ],

            "rightLines":
                right_lines[
                    right_start:right_end
                ],
        })

    return {
        "identical":
            left == right,

        "addedLines": added,
        "removedLines": removed,
        "replacementBlocks":
            replaced,

        "changeBlocks":
            len(changes),

        "similarity":
            round(
                matcher.ratio()
                * 100,
                2,
            ),

        "unifiedDiff": unified,
        "changes": changes,
    }

