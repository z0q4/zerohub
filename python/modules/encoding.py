from __future__ import annotations

import base64
import binascii
import re
from typing import Any
from urllib.parse import quote, unquote_to_bytes

from core.errors import InvalidRequestError


SUPPORTED_TOOLS = {
    "base64",
    "url",
    "hex",
}

SUPPORTED_MODES = {
    "encode",
    "decode",
}

MAX_TEXT_LENGTH = 2_000_000

INVALID_PERCENT_PATTERN = re.compile(
    r"%(?![0-9a-fA-F]{2})"
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


def validate_request(
    payload: dict[str, Any],
) -> tuple[str, str, str]:
    tool = require_string(
        payload,
        "tool",
    )

    mode = require_string(
        payload,
        "mode",
    )

    value = require_string(
        payload,
        "value",
    )

    if tool not in SUPPORTED_TOOLS:
        raise InvalidRequestError(
            f"A ferramenta de Encoding '{tool}' não é suportada."
        )

    if mode not in SUPPORTED_MODES:
        raise InvalidRequestError(
            f"O modo de Encoding '{mode}' não é suportado."
        )

    if not value:
        raise InvalidRequestError(
            "Digite algum conteúdo antes de executar."
        )

    if len(value) > MAX_TEXT_LENGTH:
        raise InvalidRequestError(
            "O conteúdo excede o limite de 2 milhões de caracteres."
        )

    return tool, mode, value


def encode_base64(
    value: str,
) -> str:
    encoded = base64.b64encode(
        value.encode("utf-8")
    )

    return encoded.decode("ascii")


def decode_base64(
    value: str,
) -> str:
    normalized = "".join(
        value.split()
    )

    if not normalized:
        raise InvalidRequestError(
            "Digite um conteúdo Base64 para decodificar."
        )

    if len(normalized) % 4 == 1:
        raise InvalidRequestError(
            "O conteúdo não possui um formato Base64 válido."
        )

    padding = (
        4 - len(normalized) % 4
    ) % 4

    padded = normalized + "=" * padding

    try:
        decoded = base64.b64decode(
            padded,
            validate=True,
        )
    except (
        binascii.Error,
        ValueError,
    ) as error:
        raise InvalidRequestError(
            "O conteúdo não possui um formato Base64 válido."
        ) from error

    try:
        return decoded.decode(
            "utf-8"
        )
    except UnicodeDecodeError as error:
        raise InvalidRequestError(
            "O Base64 é válido, mas o resultado não representa texto UTF-8."
        ) from error


def encode_url(
    value: str,
) -> str:
    return quote(
        value,
        safe="-_.!~*'()",
        encoding="utf-8",
        errors="strict",
    )


def decode_url(
    value: str,
) -> str:
    if INVALID_PERCENT_PATTERN.search(
        value
    ):
        raise InvalidRequestError(
            "O conteúdo possui uma codificação URL inválida."
        )

    try:
        decoded_bytes = (
            unquote_to_bytes(value)
        )

        return decoded_bytes.decode(
            "utf-8"
        )
    except UnicodeDecodeError as error:
        raise InvalidRequestError(
            "O conteúdo URL não representa um texto UTF-8 válido."
        ) from error


def encode_hex(
    value: str,
) -> str:
    return value.encode(
        "utf-8"
    ).hex()


def decode_hex(
    value: str,
) -> str:
    normalized = value.strip()

    if normalized.lower().startswith(
        "0x"
    ):
        normalized = normalized[2:]

    normalized = "".join(
        normalized.split()
    )

    if not normalized:
        raise InvalidRequestError(
            "Digite um conteúdo hexadecimal para decodificar."
        )

    if not re.fullmatch(
        r"[0-9a-fA-F]+",
        normalized,
    ):
        raise InvalidRequestError(
            "O conteúdo possui caracteres que não pertencem ao formato hexadecimal."
        )

    if len(normalized) % 2 != 0:
        raise InvalidRequestError(
            "O conteúdo hexadecimal precisa possuir uma quantidade par de caracteres."
        )

    try:
        decoded = bytes.fromhex(
            normalized
        )
    except ValueError as error:
        raise InvalidRequestError(
            "O conteúdo hexadecimal é inválido."
        ) from error

    try:
        return decoded.decode(
            "utf-8"
        )
    except UnicodeDecodeError as error:
        raise InvalidRequestError(
            "O hexadecimal é válido, mas não representa um texto UTF-8 válido."
        ) from error


TRANSFORMERS = {
    ("base64", "encode"):
        encode_base64,

    ("base64", "decode"):
        decode_base64,

    ("url", "encode"):
        encode_url,

    ("url", "decode"):
        decode_url,

    ("hex", "encode"):
        encode_hex,

    ("hex", "decode"):
        decode_hex,
}


def transform_text(
    payload: dict[str, Any],
) -> str:
    tool, mode, value = (
        validate_request(payload)
    )

    transformer = TRANSFORMERS[
        (tool, mode)
    ]

    return transformer(value)
