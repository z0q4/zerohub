from __future__ import annotations

import base64
import hashlib
import hmac
import json
import secrets
import string
from datetime import datetime, timezone
from typing import Any

from core.errors import InvalidRequestError


MAX_TEXT = 2_000_000
ALGORITHMS = {"sha256", "sha512"}
ENCODINGS = {"hex", "base64"}
RANDOM_FORMATS = {"password", "hex", "base64url"}


def require_string(payload: dict[str, Any], field: str) -> str:
    value = payload.get(field)

    if not isinstance(value, str):
        raise InvalidRequestError(
            f"O campo '{field}' precisa ser um texto."
        )

    return value


def require_integer(payload: dict[str, Any], field: str) -> int:
    value = payload.get(field)

    if isinstance(value, bool) or not isinstance(value, int):
        raise InvalidRequestError(
            f"O campo '{field}' precisa ser um inteiro."
        )

    return value


def require_choice(
    payload: dict[str, Any],
    field: str,
    allowed: set[str],
) -> str:
    value = require_string(payload, field).lower()

    if value not in allowed:
        raise InvalidRequestError(
            f"O valor de '{field}' não é suportado."
        )

    return value


def validate_length(value: str, field: str, maximum: int = MAX_TEXT) -> None:
    if len(value) > maximum:
        raise InvalidRequestError(
            f"O campo '{field}' excede o limite permitido."
        )


def encode_value(value: bytes, encoding: str) -> str:
    if encoding == "hex":
        return value.hex()

    return base64.b64encode(value).decode("ascii")


def decode_value(value: str, encoding: str) -> bytes:
    try:
        if encoding == "hex":
            return bytes.fromhex(value.strip())

        return base64.b64decode(
            value.strip(),
            validate=True,
        )
    except (ValueError, base64.binascii.Error) as error:
        raise InvalidRequestError(
            "O valor informado não corresponde à codificação selecionada."
        ) from error


def create_hmac(payload: dict[str, Any]) -> dict[str, Any]:
    key = require_string(payload, "key")
    message = require_string(payload, "message")
    algorithm = require_choice(payload, "algorithm", ALGORITHMS)
    encoding = require_choice(payload, "encoding", ENCODINGS)

    validate_length(key, "key")
    validate_length(message, "message")

    digest = hmac.new(
        key.encode("utf-8"),
        message.encode("utf-8"),
        getattr(hashlib, algorithm),
    ).digest()

    return {
        "algorithm": algorithm,
        "encoding": encoding,
        "digest": encode_value(digest, encoding),
        "bytes": len(digest),
    }


def verify_hmac(payload: dict[str, Any]) -> dict[str, Any]:
    key = require_string(payload, "key")
    message = require_string(payload, "message")
    expected = require_string(payload, "expected")
    algorithm = require_choice(payload, "algorithm", ALGORITHMS)
    encoding = require_choice(payload, "encoding", ENCODINGS)

    validate_length(key, "key")
    validate_length(message, "message")

    expected_bytes = decode_value(expected, encoding)

    calculated = hmac.new(
        key.encode("utf-8"),
        message.encode("utf-8"),
        getattr(hashlib, algorithm),
    ).digest()

    return {
        "valid": hmac.compare_digest(
            calculated,
            expected_bytes,
        ),
        "calculatedHex": calculated.hex(),
        "calculatedBase64": base64.b64encode(
            calculated
        ).decode("ascii"),
    }


def derive_pbkdf2(payload: dict[str, Any]) -> dict[str, Any]:
    password = require_string(payload, "password")
    salt_text = require_string(payload, "salt")
    algorithm = require_choice(payload, "algorithm", ALGORITHMS)
    iterations = require_integer(payload, "iterations")
    length = require_integer(payload, "length")

    validate_length(password, "password")
    validate_length(salt_text, "salt", 4096)

    if iterations < 1_000 or iterations > 2_000_000:
        raise InvalidRequestError(
            "As iterações precisam estar entre 1.000 e 2.000.000."
        )

    if length < 16 or length > 128:
        raise InvalidRequestError(
            "O tamanho precisa estar entre 16 e 128 bytes."
        )

    generated = not salt_text
    salt = (
        secrets.token_bytes(16)
        if generated
        else salt_text.encode("utf-8")
    )

    derived = hashlib.pbkdf2_hmac(
        algorithm,
        password.encode("utf-8"),
        salt,
        iterations,
        dklen=length,
    )

    return {
        "algorithm": algorithm,
        "iterations": iterations,
        "length": length,
        "saltGenerated": generated,
        "saltHex": salt.hex(),
        "saltBase64": base64.b64encode(salt).decode("ascii"),
        "derivedKeyHex": derived.hex(),
        "derivedKeyBase64": base64.b64encode(derived).decode("ascii"),
    }


def generate_random(payload: dict[str, Any]) -> dict[str, Any]:
    output_format = require_choice(
        payload,
        "format",
        RANDOM_FORMATS,
    )

    length = require_integer(payload, "length")

    if output_format == "password":
        if length < 8 or length > 256:
            raise InvalidRequestError(
                "A senha precisa ter entre 8 e 256 caracteres."
            )

        lower = payload.get("lower", True)
        upper = payload.get("upper", True)
        digits = payload.get("digits", True)
        symbols = payload.get("symbols", True)

        if not all(
            isinstance(value, bool)
            for value in (lower, upper, digits, symbols)
        ):
            raise InvalidRequestError(
                "As opções do gerador precisam ser booleanas."
            )

        alphabet = ""

        if lower:
            alphabet += string.ascii_lowercase

        if upper:
            alphabet += string.ascii_uppercase

        if digits:
            alphabet += string.digits

        if symbols:
            alphabet += "!@#$%^&*()-_=+[]{}:,.?"

        if not alphabet:
            raise InvalidRequestError(
                "Selecione ao menos um conjunto de caracteres."
            )

        value = "".join(
            secrets.choice(alphabet)
            for _ in range(length)
        )

        return {
            "format": output_format,
            "length": length,
            "value": value,
            "alphabetSize": len(alphabet),
        }

    if length < 1 or length > 4096:
        raise InvalidRequestError(
            "A quantidade de bytes precisa estar entre 1 e 4096."
        )

    random_bytes = secrets.token_bytes(length)

    if output_format == "hex":
        value = random_bytes.hex()
    else:
        value = base64.urlsafe_b64encode(
            random_bytes
        ).decode("ascii").rstrip("=")

    return {
        "format": output_format,
        "length": length,
        "value": value,
        "alphabetSize": None,
    }


def decode_base64url(value: str) -> bytes:
    padding = "=" * ((4 - len(value) % 4) % 4)

    try:
        return base64.urlsafe_b64decode(
            value + padding
        )
    except (ValueError, base64.binascii.Error) as error:
        raise InvalidRequestError(
            "O JWT possui Base64URL inválido."
        ) from error


def decode_json_segment(value: str, name: str) -> dict[str, Any]:
    raw = decode_base64url(value)

    try:
        decoded = raw.decode("utf-8")
        parsed = json.loads(decoded)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise InvalidRequestError(
            f"O segmento {name} do JWT é inválido."
        ) from error

    if not isinstance(parsed, dict):
        raise InvalidRequestError(
            f"O segmento {name} precisa conter um objeto JSON."
        )

    return parsed


def timestamp_claim(value: Any) -> str | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None

    try:
        return datetime.fromtimestamp(
            float(value),
            tz=timezone.utc,
        ).isoformat()
    except (ValueError, OverflowError, OSError):
        return None


def decode_jwt(payload: dict[str, Any]) -> dict[str, Any]:
    token = require_string(payload, "token").strip()
    validate_length(token, "token", 1_000_000)

    parts = token.split(".")

    if len(parts) != 3:
        raise InvalidRequestError(
            "Um JWT precisa conter três segmentos."
        )

    header = decode_json_segment(parts[0], "header")
    claims = decode_json_segment(parts[1], "payload")
    signature = decode_base64url(parts[2])

    expires = claims.get("exp")
    now = datetime.now(timezone.utc).timestamp()

    expired = (
        isinstance(expires, (int, float))
        and not isinstance(expires, bool)
        and float(expires) < now
    )

    return {
        "header": header,
        "payload": claims,
        "signatureHex": signature.hex(),
        "signatureLength": len(signature),
        "algorithm": (
            header.get("alg")
            if isinstance(header.get("alg"), str)
            else None
        ),
        "expired": expired,
        "timeline": {
            "issuedAt": timestamp_claim(claims.get("iat")),
            "notBefore": timestamp_claim(claims.get("nbf")),
            "expiresAt": timestamp_claim(claims.get("exp")),
        },
        "signatureVerified": False,
        "warning": (
            "O JWT foi somente decodificado. "
            "A assinatura não foi verificada."
        ),
    }


def constant_time_compare(payload: dict[str, Any]) -> dict[str, Any]:
    left = require_string(payload, "left")
    right = require_string(payload, "right")

    validate_length(left, "left")
    validate_length(right, "right")

    return {
        "equal": hmac.compare_digest(
            left.encode("utf-8"),
            right.encode("utf-8"),
        ),
        "leftLength": len(left),
        "rightLength": len(right),
    }
