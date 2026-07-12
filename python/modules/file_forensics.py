from __future__ import annotations

import hashlib
import ipaddress
import math
import mimetypes
import re
import struct
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from core.errors import (
    InvalidRequestError,
    ZeroHubError,
)


CHUNK_SIZE = 1024 * 1024
HEADER_READ_SIZE = 1024 * 1024
MAX_STRINGS = 2000
MAX_STRING_LENGTH = 1000
MAX_ARCHIVE_ENTRIES = 5000
MAX_INDICATORS_PER_TYPE = 500
CARRY_SIZE = 4096

URL_PATTERN = re.compile(
    r"https?://[^\s<>'\"`]+",
    re.IGNORECASE,
)

EMAIL_PATTERN = re.compile(
    r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,63}\b",
    re.IGNORECASE,
)

IPV4_PATTERN = re.compile(
    r"(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])"
)

DOMAIN_PATTERN = re.compile(
    r"(?<![@\w.-])"
    r"(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+"
    r"[A-Z]{2,63}"
    r"(?![\w.-])",
    re.IGNORECASE,
)

HASH_PATTERN = re.compile(
    r"(?<![A-F0-9])"
    r"(?:[A-F0-9]{64}|[A-F0-9]{40}|[A-F0-9]{32})"
    r"(?![A-F0-9])",
    re.IGNORECASE,
)

MAGIC_SIGNATURES: tuple[
    tuple[bytes, str, str],
    ...,
] = (
    (b"\x7fELF", "ELF", "application/x-elf"),
    (b"MZ", "PE", "application/vnd.microsoft.portable-executable"),
    (b"%PDF-", "PDF", "application/pdf"),
    (b"\x89PNG\r\n\x1a\n", "PNG", "image/png"),
    (b"\xff\xd8\xff", "JPEG", "image/jpeg"),
    (b"GIF87a", "GIF", "image/gif"),
    (b"GIF89a", "GIF", "image/gif"),
    (b"PK\x03\x04", "ZIP", "application/zip"),
    (b"\x1f\x8b", "GZIP", "application/gzip"),
    (b"Rar!\x1a\x07", "RAR", "application/vnd.rar"),
    (b"7z\xbc\xaf\x27\x1c", "7-Zip", "application/x-7z-compressed"),
)

PE_MACHINE_NAMES = {
    0x014C: "x86",
    0x8664: "x86-64",
    0x01C0: "ARM",
    0xAA64: "ARM64",
}

ELF_MACHINE_NAMES = {
    0x03: "x86",
    0x28: "ARM",
    0x3E: "x86-64",
    0xB7: "ARM64",
    0xF3: "RISC-V",
}

ELF_TYPE_NAMES = {
    0: "NONE",
    1: "REL",
    2: "EXEC",
    3: "DYN",
    4: "CORE",
}


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


def require_min_length(
    payload: dict[str, Any],
) -> int:
    value = payload.get(
        "minStringLength",
        5,
    )

    if isinstance(value, bool) or not isinstance(value, int):
        raise InvalidRequestError(
            "O tamanho mínimo das strings precisa ser inteiro."
        )

    if value < 4 or value > 64:
        raise InvalidRequestError(
            "O tamanho mínimo precisa estar entre 4 e 64."
        )

    return value


def format_timestamp(
    timestamp: float,
) -> str:
    return datetime.fromtimestamp(
        timestamp,
        tz=timezone.utc,
    ).isoformat()


def calculate_entropy(
    frequencies: list[int],
    total_bytes: int,
) -> float:
    if total_bytes == 0:
        return 0.0

    entropy = 0.0

    for frequency in frequencies:
        if frequency == 0:
            continue

        probability = frequency / total_bytes
        entropy -= probability * math.log2(probability)

    return round(entropy, 4)


def detect_format(
    header: bytes,
    file_path: Path,
) -> tuple[str, str]:
    for signature, format_name, mime_type in MAGIC_SIGNATURES:
        if header.startswith(signature):
            return format_name, mime_type

    guessed_type, _ = mimetypes.guess_type(file_path.name)

    return (
        "Unknown",
        guessed_type or "application/octet-stream",
    )


def parse_pe(
    header: bytes,
) -> dict[str, Any] | None:
    if not header.startswith(b"MZ") or len(header) < 0x40:
        return None

    try:
        pe_offset = struct.unpack_from(
            "<I",
            header,
            0x3C,
        )[0]

        if pe_offset + 24 > len(header):
            return {
                "format": "PE",
                "warning": "Cabeçalho PE fora da amostra inicial.",
            }

        if header[
            pe_offset:pe_offset + 4
        ] != b"PE\x00\x00":
            return {
                "format": "DOS/MZ",
                "warning": "Assinatura PE não encontrada.",
            }

        machine, sections, timestamp = struct.unpack_from(
            "<HHI",
            header,
            pe_offset + 4,
        )

        optional_size, characteristics = struct.unpack_from(
            "<HH",
            header,
            pe_offset + 20,
        )

        optional_magic = None
        architecture = PE_MACHINE_NAMES.get(
            machine,
            f"0x{machine:04x}",
        )

        if optional_size >= 2 and pe_offset + 26 <= len(header):
            optional_magic = struct.unpack_from(
                "<H",
                header,
                pe_offset + 24,
            )[0]

            if optional_magic == 0x10B:
                architecture = "PE32 / " + architecture
            elif optional_magic == 0x20B:
                architecture = "PE32+ / " + architecture

        return {
            "format": "PE",
            "architecture": architecture,
            "machine": f"0x{machine:04x}",
            "sections": sections,
            "timestamp": format_timestamp(timestamp),
            "characteristics": f"0x{characteristics:04x}",
            "optionalHeaderSize": optional_size,
        }

    except (
        struct.error,
        ValueError,
        OSError,
    ):
        return {
            "format": "PE",
            "warning": "Não foi possível interpretar completamente o cabeçalho.",
        }


def parse_elf(
    header: bytes,
) -> dict[str, Any] | None:
    if not header.startswith(b"\x7fELF") or len(header) < 20:
        return None

    elf_class = header[4]
    data_encoding = header[5]

    if elf_class not in {1, 2} or data_encoding not in {1, 2}:
        return {
            "format": "ELF",
            "warning": "Classe ou endianness ELF desconhecida.",
        }

    endian = "<" if data_encoding == 1 else ">"
    class_name = "ELF32" if elf_class == 1 else "ELF64"
    endian_name = "little-endian" if data_encoding == 1 else "big-endian"

    try:
        elf_type, machine = struct.unpack_from(
            endian + "HH",
            header,
            16,
        )

        entry_offset = 24

        if elf_class == 1:
            entry_point = struct.unpack_from(
                endian + "I",
                header,
                entry_offset,
            )[0]
        else:
            entry_point = struct.unpack_from(
                endian + "Q",
                header,
                entry_offset,
            )[0]

        return {
            "format": "ELF",
            "class": class_name,
            "endianness": endian_name,
            "type": ELF_TYPE_NAMES.get(
                elf_type,
                str(elf_type),
            ),
            "machine": ELF_MACHINE_NAMES.get(
                machine,
                f"0x{machine:04x}",
            ),
            "entryPoint": f"0x{entry_point:x}",
        }

    except struct.error:
        return {
            "format": "ELF",
            "class": class_name,
            "endianness": endian_name,
            "warning": "Cabeçalho ELF incompleto.",
        }


def parse_png(
    header: bytes,
) -> dict[str, Any] | None:
    if not header.startswith(b"\x89PNG\r\n\x1a\n") or len(header) < 24:
        return None

    width, height = struct.unpack_from(
        ">II",
        header,
        16,
    )

    return {
        "format": "PNG",
        "width": width,
        "height": height,
    }


def parse_pdf(
    header: bytes,
) -> dict[str, Any] | None:
    if not header.startswith(b"%PDF-"):
        return None

    version = (
        header[5:12]
        .splitlines()[0]
        .decode("ascii", errors="replace")
    )

    page_markers = len(
        re.findall(
            rb"/Type\s*/Page\b",
            header,
        )
    )

    return {
        "format": "PDF",
        "version": version,
        "pageMarkersInSample": page_markers,
    }


def parse_format_details(
    format_name: str,
    header: bytes,
) -> dict[str, Any]:
    if format_name == "PE":
        return parse_pe(header) or {"format": "PE"}

    if format_name == "ELF":
        return parse_elf(header) or {"format": "ELF"}

    if format_name == "PNG":
        return parse_png(header) or {"format": "PNG"}

    if format_name == "PDF":
        return parse_pdf(header) or {"format": "PDF"}

    return {
        "format": format_name,
    }


def append_string(
    output: list[dict[str, Any]],
    seen: set[tuple[int, str, str]],
    value: str,
    encoding: str,
    offset: int,
) -> None:
    normalized = value.strip()

    if not normalized:
        return

    if len(normalized) > MAX_STRING_LENGTH:
        normalized = normalized[:MAX_STRING_LENGTH] + "…"

    key = (
        offset,
        encoding,
        normalized,
    )

    if key in seen:
        return

    seen.add(key)

    output.append({
        "value": normalized,
        "encoding": encoding,
        "offset": offset,
    })


def extract_strings(
    file_path: Path,
    min_length: int,
) -> tuple[
    list[dict[str, Any]],
    dict[str, Any],
]:
    ascii_pattern = re.compile(
        rb"[\x20-\x7e]{"
        + str(min_length).encode("ascii")
        + rb",}"
    )

    utf16_pattern = re.compile(
        rb"(?:[\x20-\x7e]\x00){"
        + str(min_length).encode("ascii")
        + rb",}"
    )

    values: list[dict[str, Any]] = []
    seen: set[tuple[int, str, str]] = set()
    carry = b""
    processed = 0
    truncated = False

    try:
        with file_path.open("rb") as file:
            while len(values) < MAX_STRINGS:
                chunk = file.read(CHUNK_SIZE)

                if not chunk:
                    break

                data = carry + chunk
                base_offset = processed - len(carry)

                for match in ascii_pattern.finditer(data):
                    append_string(
                        values,
                        seen,
                        match.group().decode(
                            "ascii",
                            errors="replace",
                        ),
                        "ASCII",
                        max(
                            0,
                            base_offset + match.start(),
                        ),
                    )

                    if len(values) >= MAX_STRINGS:
                        truncated = True
                        break

                if len(values) < MAX_STRINGS:
                    for match in utf16_pattern.finditer(data):
                        append_string(
                            values,
                            seen,
                            match.group().decode(
                                "utf-16-le",
                                errors="replace",
                            ),
                            "UTF-16LE",
                            max(
                                0,
                                base_offset + match.start(),
                            ),
                        )

                        if len(values) >= MAX_STRINGS:
                            truncated = True
                            break

                processed += len(chunk)
                carry = data[-CARRY_SIZE:]

            if len(values) >= MAX_STRINGS:
                truncated = True

    except PermissionError as error:
        raise ZeroHubError(
            "O ZeroHub não possui permissão para ler o arquivo."
        ) from error

    except OSError as error:
        raise ZeroHubError(
            f"Não foi possível extrair strings: {error}"
        ) from error

    values.sort(
        key=lambda item: (
            item["offset"],
            item["encoding"],
        )
    )

    ascii_count = sum(
        1
        for item in values
        if item["encoding"] == "ASCII"
    )

    utf16_count = len(values) - ascii_count

    return values, {
        "total": len(values),
        "asciiCount": ascii_count,
        "utf16Count": utf16_count,
        "truncated": truncated,
        "limit": MAX_STRINGS,
        "minLength": min_length,
    }


def collect_limited(
    values: set[str],
) -> list[str]:
    return sorted(values)[:MAX_INDICATORS_PER_TYPE]


def extract_indicators(
    strings: list[dict[str, Any]],
) -> dict[str, list[str]]:
    urls: set[str] = set()
    emails: set[str] = set()
    ipv4_values: set[str] = set()
    domains: set[str] = set()
    hashes: set[str] = set()

    for item in strings:
        value = item["value"]

        urls.update(
            match.rstrip(".,);]")
            for match in URL_PATTERN.findall(value)
        )

        emails.update(
            EMAIL_PATTERN.findall(value)
        )

        for candidate in IPV4_PATTERN.findall(value):
            try:
                address = ipaddress.ip_address(candidate)

                if isinstance(address, ipaddress.IPv4Address):
                    ipv4_values.add(str(address))
            except ValueError:
                continue

        domains.update(
            match.lower()
            for match in DOMAIN_PATTERN.findall(value)
        )

        hashes.update(
            match.lower()
            for match in HASH_PATTERN.findall(value)
        )

    return {
        "urls": collect_limited(urls),
        "emails": collect_limited(emails),
        "ipv4": collect_limited(ipv4_values),
        "domains": collect_limited(domains),
        "hashes": collect_limited(hashes),
    }


def inspect_zip_archive(
    file_path: Path,
) -> dict[str, Any] | None:
    try:
        if not zipfile.is_zipfile(file_path):
            return None

        entries: list[dict[str, Any]] = []
        total_uncompressed = 0
        total_compressed = 0
        encrypted_entries = 0
        truncated = False

        with zipfile.ZipFile(file_path) as archive:
            all_entries = archive.infolist()

            for index, info in enumerate(all_entries):
                if index >= MAX_ARCHIVE_ENTRIES:
                    truncated = True
                    break

                total_uncompressed += info.file_size
                total_compressed += info.compress_size

                encrypted = bool(info.flag_bits & 0x1)

                if encrypted:
                    encrypted_entries += 1

                entries.append({
                    "name": info.filename,
                    "sizeBytes": info.file_size,
                    "compressedSizeBytes": info.compress_size,
                    "isDirectory": info.is_dir(),
                    "encrypted": encrypted,
                    "crc32": f"{info.CRC:08x}",
                })

        return {
            "type": "zip",
            "entryCount": len(all_entries),
            "displayedEntries": len(entries),
            "truncated": truncated,
            "totalUncompressedBytes": total_uncompressed,
            "totalCompressedBytes": total_compressed,
            "encryptedEntries": encrypted_entries,
            "entries": entries,
        }

    except (
        zipfile.BadZipFile,
        OSError,
        RuntimeError,
    ) as error:
        return {
            "type": "zip",
            "error": str(error),
            "entryCount": 0,
            "displayedEntries": 0,
            "truncated": False,
            "totalUncompressedBytes": 0,
            "totalCompressedBytes": 0,
            "encryptedEntries": 0,
            "entries": [],
        }


def inspect_file(
    payload: dict[str, Any],
) -> dict[str, Any]:
    raw_path = require_string(
        payload,
        "filePath",
    )

    min_length = require_min_length(
        payload
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
            "O arquivo selecionado não foi encontrado."
        ) from error
    except PermissionError as error:
        raise ZeroHubError(
            "O ZeroHub não possui permissão para acessar o arquivo."
        ) from error
    except OSError as error:
        raise ZeroHubError(
            f"Não foi possível acessar o arquivo: {error}"
        ) from error

    if not file_path.is_file():
        raise InvalidRequestError(
            "O caminho selecionado não representa um arquivo."
        )

    sha256 = hashlib.sha256()
    sha1 = hashlib.sha1()
    md5 = hashlib.md5()
    frequencies = [0] * 256
    total_bytes = 0

    try:
        with file_path.open("rb") as file:
            header = file.read(HEADER_READ_SIZE)

            file.seek(0)

            while True:
                chunk = file.read(CHUNK_SIZE)

                if not chunk:
                    break

                total_bytes += len(chunk)
                sha256.update(chunk)
                sha1.update(chunk)
                md5.update(chunk)

                for byte in chunk:
                    frequencies[byte] += 1

    except PermissionError as error:
        raise ZeroHubError(
            "O ZeroHub não possui permissão para ler o arquivo."
        ) from error
    except OSError as error:
        raise ZeroHubError(
            f"Não foi possível analisar o arquivo: {error}"
        ) from error

    format_name, mime_type = detect_format(
        header,
        file_path,
    )

    strings, string_stats = extract_strings(
        file_path,
        min_length,
    )

    indicators = extract_indicators(
        strings
    )

    archive = inspect_zip_archive(
        file_path
    )

    return {
        "fileName": file_path.name,
        "filePath": str(file_path.resolve()),
        "extension": file_path.suffix.lower() or None,
        "sizeBytes": stats.st_size,
        "mimeType": mime_type,
        "formatName": format_name,
        "entropy": calculate_entropy(
            frequencies,
            total_bytes,
        ),
        "sha256": sha256.hexdigest(),
        "sha1": sha1.hexdigest(),
        "md5": md5.hexdigest(),
        "modifiedAt": format_timestamp(stats.st_mtime),
        "formatDetails": parse_format_details(
            format_name,
            header,
        ),
        "stringStats": string_stats,
        "strings": strings,
        "indicators": indicators,
        "archive": archive,
    }
