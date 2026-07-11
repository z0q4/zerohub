from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

from core.errors import (
    InvalidRequestError,
    ZeroHubError,
)


SUPPORTED_ALGORITHMS = {
    "sha256",
    "sha512",
}

MAX_TEXT_LENGTH = 2_000_000
CHUNK_SIZE = 1024 * 1024


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


def validate_algorithm(
    payload: dict[str, Any],
) -> str:
    algorithm = require_string(
        payload,
        "algorithm",
    )

    if algorithm not in SUPPORTED_ALGORITHMS:
        raise InvalidRequestError(
            f"O algoritmo de hash '{algorithm}' não é suportado."
        )

    return algorithm


def hash_text(
    payload: dict[str, Any],
) -> str:
    algorithm = validate_algorithm(
        payload
    )

    text = require_string(
        payload,
        "text",
    )

    if not text:
        raise InvalidRequestError(
            "Digite algum texto para gerar o hash."
        )

    if len(text) > MAX_TEXT_LENGTH:
        raise InvalidRequestError(
            "O texto excede o limite de 2 milhões de caracteres."
        )

    digest = hashlib.new(
        algorithm
    )

    digest.update(
        text.encode("utf-8")
    )

    return digest.hexdigest()


def hash_file(
    payload: dict[str, Any],
) -> dict[str, Any]:
    algorithm = validate_algorithm(
        payload
    )

    raw_file_path = require_string(
        payload,
        "filePath",
    )

    if not raw_file_path.strip():
        raise InvalidRequestError(
            "O caminho do arquivo está vazio."
        )

    if len(raw_file_path) > 4096:
        raise InvalidRequestError(
            "O caminho do arquivo excede o limite permitido."
        )

    try:
        file_path = Path(
            raw_file_path
        ).expanduser()

        file_stats = file_path.stat()
    except FileNotFoundError as error:
        raise ZeroHubError(
            "O arquivo selecionado não foi encontrado."
        ) from error
    except PermissionError as error:
        raise ZeroHubError(
            "O ZeroHub não possui permissão para acessar esse arquivo."
        ) from error
    except OSError as error:
        raise ZeroHubError(
            f"Não foi possível acessar o arquivo: {error}"
        ) from error

    if not file_path.is_file():
        raise InvalidRequestError(
            "O caminho selecionado não representa um arquivo válido."
        )

    digest = hashlib.new(
        algorithm
    )

    try:
        with file_path.open(
            "rb"
        ) as file:
            while True:
                chunk = file.read(
                    CHUNK_SIZE
                )

                if not chunk:
                    break

                digest.update(chunk)
    except PermissionError as error:
        raise ZeroHubError(
            "O ZeroHub não possui permissão para ler esse arquivo."
        ) from error
    except OSError as error:
        raise ZeroHubError(
            f"Não foi possível processar o arquivo: {error}"
        ) from error

    return {
        "algorithm": algorithm,
        "digest": digest.hexdigest(),
        "fileName": file_path.name,
        "filePath": str(file_path),
        "sizeBytes": file_stats.st_size,
    }
