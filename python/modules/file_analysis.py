from __future__ import annotations

import hashlib
import math
import mimetypes
import os
import stat
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from core.errors import (
    InvalidRequestError,
    ZeroHubError,
)


CHUNK_SIZE = 1024 * 1024
SAMPLE_SIZE = 64 * 1024
MAGIC_SIZE = 32


MAGIC_SIGNATURES: tuple[
    tuple[bytes, str],
    ...,
] = (
    (
        b"\x7fELF",
        "application/x-elf",
    ),
    (
        b"MZ",
        "application/vnd.microsoft.portable-executable",
    ),
    (
        b"%PDF-",
        "application/pdf",
    ),
    (
        b"\x89PNG\r\n\x1a\n",
        "image/png",
    ),
    (
        b"\xff\xd8\xff",
        "image/jpeg",
    ),
    (
        b"GIF87a",
        "image/gif",
    ),
    (
        b"GIF89a",
        "image/gif",
    ),
    (
        b"PK\x03\x04",
        "application/zip",
    ),
    (
        b"\x1f\x8b",
        "application/gzip",
    ),
    (
        b"Rar!\x1a\x07",
        "application/vnd.rar",
    ),
    (
        b"7z\xbc\xaf\x27\x1c",
        "application/x-7z-compressed",
    ),
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


def format_timestamp(
    timestamp: float | None,
) -> str | None:
    if timestamp is None:
        return None

    return datetime.fromtimestamp(
        timestamp,
        tz=timezone.utc,
    ).isoformat()


def detect_encoding(
    sample: bytes,
) -> tuple[str, str | None]:
    if not sample:
        return "text", "utf-8"

    if sample.startswith(
        b"\xef\xbb\xbf"
    ):
        return "text", "utf-8-sig"

    if sample.startswith(
        b"\xff\xfe"
    ):
        return "text", "utf-16-le"

    if sample.startswith(
        b"\xfe\xff"
    ):
        return "text", "utf-16-be"

    if b"\x00" in sample:
        return "binary", None

    try:
        sample.decode("ascii")
        return "text", "ascii"
    except UnicodeDecodeError:
        pass

    try:
        sample.decode("utf-8")
        return "text", "utf-8"
    except UnicodeDecodeError:
        pass

    control_characters = sum(
        1
        for byte in sample
        if (
            byte < 32
            and byte not in {
                9,
                10,
                13,
                12,
                8,
            }
        )
    )

    control_ratio = (
        control_characters
        / len(sample)
    )

    if control_ratio < 0.01:
        return "text", "unknown"

    return "binary", None


def detect_mime_type(
    file_path: Path,
    sample: bytes,
    file_kind: str,
) -> str:
    for signature, mime_type in MAGIC_SIGNATURES:
        if sample.startswith(signature):
            return mime_type

    guessed_type, _ = (
        mimetypes.guess_type(
            file_path.name
        )
    )

    if guessed_type:
        return guessed_type

    if file_kind == "text":
        return "text/plain"

    return "application/octet-stream"


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

        probability = (
            frequency
            / total_bytes
        )

        entropy -= (
            probability
            * math.log2(probability)
        )

    return round(
        entropy,
        4,
    )


def inspect_file(
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
        file_stats = file_path.stat()
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
    sha512 = hashlib.sha512()

    frequencies = [0] * 256

    sample = bytearray()
    magic_bytes = bytearray()

    total_bytes = 0
    newline_count = 0
    last_byte: int | None = None

    try:
        with file_path.open("rb") as file:
            while True:
                chunk = file.read(
                    CHUNK_SIZE
                )

                if not chunk:
                    break

                sha256.update(chunk)
                sha512.update(chunk)

                total_bytes += len(chunk)
                newline_count += (
                    chunk.count(b"\n")
                )

                last_byte = chunk[-1]

                if len(sample) < SAMPLE_SIZE:
                    remaining = (
                        SAMPLE_SIZE
                        - len(sample)
                    )

                    sample.extend(
                        chunk[:remaining]
                    )

                if len(magic_bytes) < MAGIC_SIZE:
                    remaining = (
                        MAGIC_SIZE
                        - len(magic_bytes)
                    )

                    magic_bytes.extend(
                        chunk[:remaining]
                    )

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

    file_kind, encoding = (
        detect_encoding(
            bytes(sample)
        )
    )

    line_count: int | None

    if file_kind == "text":
        if total_bytes == 0:
            line_count = 0
        else:
            line_count = (
                newline_count
                + (
                    0
                    if last_byte == 10
                    else 1
                )
            )
    else:
        line_count = None

    birth_timestamp = getattr(
        file_stats,
        "st_birthtime",
        None,
    )

    mode = file_stats.st_mode

    return {
        "fileName":
            file_path.name,

        "filePath":
            str(
                file_path.resolve()
            ),

        "extension":
            file_path.suffix.lower()
            or None,

        "sizeBytes":
            file_stats.st_size,

        "mimeType":
            detect_mime_type(
                file_path,
                bytes(sample),
                file_kind,
            ),

        "kind":
            file_kind,

        "encoding":
            encoding,

        "lineCount":
            line_count,

        "entropy":
            calculate_entropy(
                frequencies,
                total_bytes,
            ),

        "magicHex":
            bytes(
                magic_bytes
            ).hex(" "),

        "sha256":
            sha256.hexdigest(),

        "sha512":
            sha512.hexdigest(),

        "permissions":
            stat.filemode(mode),

        "permissionsOctal":
            oct(
                stat.S_IMODE(mode)
            ),

        "isExecutable":
            os.access(
                file_path,
                os.X_OK,
            ),

        "createdAt":
            format_timestamp(
                birth_timestamp
            ),

        "modifiedAt":
            format_timestamp(
                file_stats.st_mtime
            ),

        "changedAt":
            format_timestamp(
                file_stats.st_ctime
            ),
    }
