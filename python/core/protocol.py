from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from typing import Any

from core.errors import InvalidRequestError


@dataclass(slots=True)
class Request:
    request_id: str
    action: str
    payload: dict[str, Any]


def parse_request(line: str) -> Request:
    try:
        value = json.loads(line)
    except json.JSONDecodeError as error:
        raise InvalidRequestError(
            "A requisição enviada ao Python não contém JSON válido."
        ) from error

    if not isinstance(value, dict):
        raise InvalidRequestError(
            "A requisição precisa ser um objeto JSON."
        )

    request_id = value.get("id")
    action = value.get("action")
    payload = value.get("payload", {})

    if not isinstance(request_id, str) or not request_id:
        raise InvalidRequestError(
            "A requisição não possui um identificador válido."
        )

    if not isinstance(action, str) or not action:
        raise InvalidRequestError(
            "A requisição não possui uma ação válida."
        )

    if not isinstance(payload, dict):
        raise InvalidRequestError(
            "O payload precisa ser um objeto JSON."
        )

    return Request(
        request_id=request_id,
        action=action,
        payload=payload,
    )


def write_success(
    request_id: str,
    result: Any,
) -> None:
    response = {
        "id": request_id,
        "ok": True,
        "result": result,
    }

    sys.stdout.write(
        json.dumps(
            response,
            ensure_ascii=False,
            separators=(",", ":"),
        )
        + "\n"
    )

    sys.stdout.flush()


def write_error(
    request_id: str | None,
    message: str,
    error_type: str,
) -> None:
    response = {
        "id": request_id,
        "ok": False,
        "error": {
            "type": error_type,
            "message": message,
        },
    }

    sys.stdout.write(
        json.dumps(
            response,
            ensure_ascii=False,
            separators=(",", ":"),
        )
        + "\n"
    )

    sys.stdout.flush()
