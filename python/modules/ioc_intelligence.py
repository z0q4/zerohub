from __future__ import annotations

import hashlib
import ipaddress
import json
import re
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlsplit, urlunsplit
from urllib.request import Request, urlopen

from core.errors import (
    InvalidRequestError,
    ZeroHubError,
)


REQUEST_TIMEOUT_SECONDS = 20
MAX_INDICATORS = 25
MAX_INDICATOR_LENGTH = 4096
MAX_RESPONSE_BYTES = 2 * 1024 * 1024
USER_AGENT = "ZeroHub-IOC-Intelligence/0.1"

HASH_PATTERN = re.compile(
    r"^[A-Fa-f0-9]+$"
)

DOMAIN_PATTERN = re.compile(
    r"^(?=.{1,253}$)"
    r"(?:"
    r"[A-Za-z0-9]"
    r"(?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?"
    r"\."
    r")+"
    r"[A-Za-z0-9]"
    r"(?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$"
)

SUPPORTED_SERVICES = {
    "urlhaus",
    "malwareBazaar",
    "abuseIpDb",
    "otx",
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


def require_dict(
    payload: dict[str, Any],
    field: str,
) -> dict[str, Any]:
    value = payload.get(field)

    if not isinstance(value, dict):
        raise InvalidRequestError(
            f"O campo '{field}' precisa ser um objeto."
        )

    return value


def redact_error(
    message: str,
    keys: dict[str, str],
) -> str:
    output = message

    for value in keys.values():
        if value:
            output = output.replace(
                value,
                "[REDACTED]",
            )

    return output[:1000]


def read_json_response(
    response: Any,
) -> dict[str, Any]:
    raw = response.read(
        MAX_RESPONSE_BYTES + 1
    )

    if len(raw) > MAX_RESPONSE_BYTES:
        raise ZeroHubError(
            "A resposta do provedor excedeu o limite permitido."
        )

    try:
        decoded = raw.decode(
            "utf-8",
            errors="strict",
        )
    except UnicodeDecodeError as error:
        raise ZeroHubError(
            "O provedor retornou uma resposta que não é UTF-8."
        ) from error

    try:
        value = json.loads(
            decoded
        )
    except json.JSONDecodeError as error:
        raise ZeroHubError(
            "O provedor não retornou JSON válido."
        ) from error

    if not isinstance(value, dict):
        raise ZeroHubError(
            "O provedor retornou uma estrutura inesperada."
        )

    return value


def http_json(
    url: str,
    *,
    method: str,
    headers: dict[str, str],
    form: dict[str, str] | None = None,
) -> tuple[int, dict[str, Any]]:
    data = None

    if form is not None:
        data = urlencode(
            form
        ).encode("utf-8")

    request_headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
        **headers,
    }

    if form is not None:
        request_headers[
            "Content-Type"
        ] = (
            "application/x-www-form-urlencoded"
        )

    request = Request(
        url,
        data=data,
        method=method,
        headers=request_headers,
    )

    try:
        with urlopen(
            request,
            timeout=REQUEST_TIMEOUT_SECONDS,
        ) as response:
            return (
                response.status,
                read_json_response(
                    response
                ),
            )

    except HTTPError as error:
        try:
            body = read_json_response(
                error
            )
        except ZeroHubError:
            body = {
                "error":
                    f"HTTP {error.code}",
            }

        return error.code, body

    except (
        URLError,
        TimeoutError,
        OSError,
    ) as error:
        reason = getattr(
            error,
            "reason",
            error,
        )

        raise ZeroHubError(
            f"Falha de rede: {reason}"
        ) from error


def normalize_url(
    raw_value: str,
) -> str:
    parsed = urlsplit(
        raw_value.strip()
    )

    if parsed.scheme not in {
        "http",
        "https",
    }:
        raise InvalidRequestError(
            "URLs precisam começar com http:// ou https://."
        )

    if not parsed.hostname:
        raise InvalidRequestError(
            "A URL não possui host."
        )

    if parsed.username or parsed.password:
        raise InvalidRequestError(
            "URLs com usuário ou senha não são aceitas."
        )

    return urlunsplit((
        parsed.scheme.lower(),
        parsed.netloc,
        parsed.path or "/",
        parsed.query,
        "",
    ))


def normalize_domain(
    raw_value: str,
) -> str:
    try:
        domain = (
            raw_value
            .strip()
            .strip(".")
            .encode("idna")
            .decode("ascii")
            .lower()
        )
    except UnicodeError as error:
        raise InvalidRequestError(
            "O domínio não pôde ser convertido para IDNA."
        ) from error

    if not DOMAIN_PATTERN.fullmatch(
        domain
    ):
        raise InvalidRequestError(
            "O domínio possui formato inválido."
        )

    return domain


def classify_indicator(
    raw_indicator: str,
) -> dict[str, Any]:
    value = raw_indicator.strip()

    if not value:
        raise InvalidRequestError(
            "Um dos indicadores está vazio."
        )

    if len(value) > MAX_INDICATOR_LENGTH:
        raise InvalidRequestError(
            "Um indicador excede o limite permitido."
        )

    if value.lower().startswith(
        (
            "http://",
            "https://",
        )
    ):
        normalized = normalize_url(
            value
        )

        hostname = urlsplit(
            normalized
        ).hostname

        return {
            "original": value,
            "normalized": normalized,
            "type": "url",
            "hostname": hostname,
            "isPublic": True,
        }

    compact = value.replace(
        " ",
        ""
    )

    if (
        len(compact)
        in {
            32,
            40,
            64,
        }
        and HASH_PATTERN.fullmatch(
            compact
        )
    ):
        hash_type = {
            32: "md5",
            40: "sha1",
            64: "sha256",
        }[
            len(compact)
        ]

        return {
            "original": value,
            "normalized":
                compact.lower(),

            "type": hash_type,
            "hostname": None,
            "isPublic": True,
        }

    try:
        address = ipaddress.ip_address(
            value.strip("[]")
        )

        return {
            "original": value,
            "normalized": str(address),
            "type":
                "ipv4"
                if address.version == 4
                else "ipv6",

            "hostname": None,
            "isPublic":
                address.is_global,
        }

    except ValueError:
        pass

    domain = normalize_domain(
        value
    )

    return {
        "original": value,
        "normalized": domain,
        "type": "domain",
        "hostname": domain,
        "isPublic": True,
    }


def provider_result(
    status: str,
    *,
    configured: bool,
    applicable: bool,
    matched: bool | None = None,
    summary: str | None = None,
    data: dict[str, Any] | None = None,
    error: str | None = None,
) -> dict[str, Any]:
    return {
        "status": status,
        "configured": configured,
        "applicable": applicable,
        "matched": matched,
        "summary": summary,
        "data": data,
        "error": error,
    }


def query_urlhaus(
    indicator: dict[str, Any],
    auth_key: str,
) -> dict[str, Any]:
    indicator_type = indicator[
        "type"
    ]

    if indicator_type == "url":
        endpoint = (
            "https://urlhaus-api.abuse.ch/v1/url/"
        )

        form = {
            "url":
                indicator[
                    "normalized"
                ],
        }

    elif indicator_type in {
        "domain",
        "ipv4",
        "ipv6",
    }:
        endpoint = (
            "https://urlhaus-api.abuse.ch/v1/host/"
        )

        form = {
            "host":
                indicator[
                    "normalized"
                ],
        }

    elif indicator_type in {
        "md5",
        "sha256",
    }:
        endpoint = (
            "https://urlhaus-api.abuse.ch/v1/payload/"
        )

        form = {
            (
                "md5_hash"
                if indicator_type == "md5"
                else "sha256_hash"
            ):
                indicator[
                    "normalized"
                ],
        }

    else:
        return provider_result(
            "not-applicable",
            configured=True,
            applicable=False,
            summary=(
                "URLhaus não consulta SHA-1 nesta integração."
            ),
        )

    _, data = http_json(
        endpoint,
        method="POST",
        headers={
            "Auth-Key": auth_key,
        },
        form=form,
    )

    query_status = str(
        data.get(
            "query_status",
            "unknown",
        )
    )

    if query_status == "ok":
        summary = {
            "url":
                "URL conhecida pelo URLhaus.",

            "domain":
                "Host conhecido pelo URLhaus.",

            "ipv4":
                "IP conhecido pelo URLhaus.",

            "ipv6":
                "IP conhecido pelo URLhaus.",

            "md5":
                "Payload conhecido pelo URLhaus.",

            "sha256":
                "Payload conhecido pelo URLhaus.",
        }.get(
            indicator_type,
            "Indicador conhecido.",
        )

        return provider_result(
            "ok",
            configured=True,
            applicable=True,
            matched=True,
            summary=summary,
            data=data,
        )

    if query_status == "no_results":
        return provider_result(
            "no-results",
            configured=True,
            applicable=True,
            matched=False,
            summary=(
                "Nenhuma correspondência no URLhaus."
            ),
            data={
                "query_status":
                    query_status,
            },
        )

    return provider_result(
        "error",
        configured=True,
        applicable=True,
        matched=None,
        summary=(
            "O URLhaus recusou ou não concluiu a consulta."
        ),
        data=data,
        error=query_status,
    )


def query_malware_bazaar(
    indicator: dict[str, Any],
    auth_key: str,
) -> dict[str, Any]:
    if indicator["type"] not in {
        "md5",
        "sha1",
        "sha256",
    }:
        return provider_result(
            "not-applicable",
            configured=True,
            applicable=False,
            summary=(
                "MalwareBazaar é consultado apenas para hashes."
            ),
        )

    _, data = http_json(
        "https://mb-api.abuse.ch/api/v1/",
        method="POST",
        headers={
            "Auth-Key": auth_key,
        },
        form={
            "query": "get_info",
            "hash":
                indicator[
                    "normalized"
                ],
        },
    )

    query_status = str(
        data.get(
            "query_status",
            "unknown",
        )
    )

    if query_status == "ok":
        return provider_result(
            "ok",
            configured=True,
            applicable=True,
            matched=True,
            summary=(
                "Hash conhecido pelo MalwareBazaar."
            ),
            data=data,
        )

    if query_status == "hash_not_found":
        return provider_result(
            "no-results",
            configured=True,
            applicable=True,
            matched=False,
            summary=(
                "Hash não encontrado no MalwareBazaar."
            ),
            data={
                "query_status":
                    query_status,
            },
        )

    return provider_result(
        "error",
        configured=True,
        applicable=True,
        matched=None,
        summary=(
            "O MalwareBazaar recusou ou não concluiu a consulta."
        ),
        data=data,
        error=query_status,
    )


def query_abuse_ipdb(
    indicator: dict[str, Any],
    api_key: str,
) -> dict[str, Any]:
    if indicator["type"] not in {
        "ipv4",
        "ipv6",
    }:
        return provider_result(
            "not-applicable",
            configured=True,
            applicable=False,
            summary=(
                "AbuseIPDB é consultado apenas para endereços IP."
            ),
        )

    if not indicator["isPublic"]:
        return provider_result(
            "not-applicable",
            configured=True,
            applicable=False,
            summary=(
                "Endereços privados ou reservados não são enviados ao AbuseIPDB."
            ),
        )

    query = urlencode({
        "ipAddress":
            indicator[
                "normalized"
            ],

        "maxAgeInDays": "90",
        "verbose": "",
    })

    _, response = http_json(
        (
            "https://api.abuseipdb.com/api/v2/check?"
            + query
        ),
        method="GET",
        headers={
            "Key": api_key,
        },
    )

    data = response.get(
        "data"
    )

    if not isinstance(
        data,
        dict,
    ):
        return provider_result(
            "error",
            configured=True,
            applicable=True,
            matched=None,
            summary=(
                "O AbuseIPDB retornou uma estrutura inesperada."
            ),
            data=response,
            error="invalid-response",
        )

    score = data.get(
        "abuseConfidenceScore"
    )

    matched = (
        isinstance(score, int)
        and score > 0
    )

    return provider_result(
        "ok",
        configured=True,
        applicable=True,
        matched=matched,
        summary=(
            f"Abuse confidence score: {score}%."
            if isinstance(
                score,
                int,
            )
            else "Consulta concluída."
        ),
        data=data,
    )


def otx_indicator_type(
    indicator_type: str,
) -> str | None:
    return {
        "ipv4": "IPv4",
        "ipv6": "IPv6",
        "domain": "domain",
        "url": "url",
        "md5": "file",
        "sha1": "file",
        "sha256": "file",
    }.get(
        indicator_type
    )


def query_otx(
    indicator: dict[str, Any],
    api_key: str,
) -> dict[str, Any]:
    otx_type = otx_indicator_type(
        indicator["type"]
    )

    if otx_type is None:
        return provider_result(
            "not-applicable",
            configured=True,
            applicable=False,
        )

    encoded_indicator = quote(
        indicator["normalized"],
        safe="",
    )

    endpoint = (
        "https://otx.alienvault.com/api/v1/indicators/"
        f"{otx_type}/{encoded_indicator}/general"
    )

    status_code, data = http_json(
        endpoint,
        method="GET",
        headers={
            "X-OTX-API-KEY":
                api_key,
        },
    )

    if status_code == 404:
        return provider_result(
            "no-results",
            configured=True,
            applicable=True,
            matched=False,
            summary=(
                "Indicador não encontrado no OTX."
            ),
            data=data,
        )

    pulse_info = data.get(
        "pulse_info"
    )

    pulse_count = 0

    if isinstance(
        pulse_info,
        dict,
    ):
        raw_count = pulse_info.get(
            "count",
            0,
        )

        if isinstance(
            raw_count,
            int,
        ):
            pulse_count = raw_count

    return provider_result(
        "ok",
        configured=True,
        applicable=True,
        matched=(
            pulse_count > 0
        ),
        summary=(
            f"Associado a {pulse_count} pulse(s) no OTX."
        ),
        data=data,
    )


def risk_from_providers(
    providers: dict[str, dict[str, Any]],
) -> tuple[str, int]:
    hits = sum(
        1
        for value in providers.values()
        if value.get(
            "matched"
        )
        is True
    )

    if providers.get(
        "urlhaus",
        {},
    ).get(
        "matched"
    ) is True:
        return "malicious", hits

    if providers.get(
        "malwareBazaar",
        {},
    ).get(
        "matched"
    ) is True:
        return "malicious", hits

    abuse_data = providers.get(
        "abuseIpDb",
        {},
    ).get(
        "data"
    )

    if isinstance(
        abuse_data,
        dict,
    ):
        score = abuse_data.get(
            "abuseConfidenceScore"
        )

        if isinstance(
            score,
            int,
        ):
            if score >= 75:
                return "malicious", hits

            if score >= 25:
                return "suspicious", hits

    if providers.get(
        "otx",
        {},
    ).get(
        "matched"
    ) is True:
        return "suspicious", hits

    completed = any(
        value.get("status")
        in {
            "ok",
            "no-results",
        }
        for value in providers.values()
    )

    if completed:
        return (
            "clean-or-unknown",
            hits,
        )

    return "unknown", hits


def query_ioc_intelligence(
    payload: dict[str, Any],
) -> dict[str, Any]:
    raw_indicators = require_string(
        payload,
        "indicators",
    )

    raw_services = require_dict(
        payload,
        "services",
    )

    raw_keys = require_dict(
        payload,
        "keys",
    )

    selected_services = {
        name
        for name in SUPPORTED_SERVICES
        if raw_services.get(
            name
        )
        is True
    }

    if not selected_services:
        raise InvalidRequestError(
            "Selecione ao menos um provedor."
        )

    lines = [
        line.strip()
        for line in raw_indicators.splitlines()
        if line.strip()
    ]

    if not lines:
        raise InvalidRequestError(
            "Informe ao menos um indicador."
        )

    if len(lines) > MAX_INDICATORS:
        raise InvalidRequestError(
            f"O limite é de {MAX_INDICATORS} indicadores por consulta."
        )

    keys = {
        "abuseCh":
            str(
                raw_keys.get(
                    "abuseCh",
                    "",
                )
            ).strip(),

        "abuseIpDb":
            str(
                raw_keys.get(
                    "abuseIpDb",
                    "",
                )
            ).strip(),

        "otx":
            str(
                raw_keys.get(
                    "otx",
                    "",
                )
            ).strip(),
    }

    classified = [
        classify_indicator(
            line
        )
        for line in lines
    ]

    results: list[dict[str, Any]] = []
    started_at = time.perf_counter()

    for index, indicator in enumerate(
        classified
    ):
        providers: dict[str, dict[str, Any]] = {}

        if "urlhaus" in selected_services:
            if not keys["abuseCh"]:
                providers[
                    "urlhaus"
                ] = provider_result(
                    "not-configured",
                    configured=False,
                    applicable=True,
                    summary=(
                        "Configure a Auth-Key da abuse.ch."
                    ),
                )
            else:
                try:
                    providers[
                        "urlhaus"
                    ] = query_urlhaus(
                        indicator,
                        keys["abuseCh"],
                    )
                except Exception as error:
                    providers[
                        "urlhaus"
                    ] = provider_result(
                        "error",
                        configured=True,
                        applicable=True,
                        error=redact_error(
                            str(error),
                            keys,
                        ),
                    )

        if "malwareBazaar" in selected_services:
            if not keys["abuseCh"]:
                providers[
                    "malwareBazaar"
                ] = provider_result(
                    "not-configured",
                    configured=False,
                    applicable=True,
                    summary=(
                        "Configure a Auth-Key da abuse.ch."
                    ),
                )
            else:
                try:
                    providers[
                        "malwareBazaar"
                    ] = query_malware_bazaar(
                        indicator,
                        keys["abuseCh"],
                    )
                except Exception as error:
                    providers[
                        "malwareBazaar"
                    ] = provider_result(
                        "error",
                        configured=True,
                        applicable=True,
                        error=redact_error(
                            str(error),
                            keys,
                        ),
                    )

        if "abuseIpDb" in selected_services:
            if not keys["abuseIpDb"]:
                providers[
                    "abuseIpDb"
                ] = provider_result(
                    "not-configured",
                    configured=False,
                    applicable=True,
                    summary=(
                        "Configure a API key do AbuseIPDB."
                    ),
                )
            else:
                try:
                    providers[
                        "abuseIpDb"
                    ] = query_abuse_ipdb(
                        indicator,
                        keys["abuseIpDb"],
                    )
                except Exception as error:
                    providers[
                        "abuseIpDb"
                    ] = provider_result(
                        "error",
                        configured=True,
                        applicable=True,
                        error=redact_error(
                            str(error),
                            keys,
                        ),
                    )

        if "otx" in selected_services:
            if not keys["otx"]:
                providers[
                    "otx"
                ] = provider_result(
                    "not-configured",
                    configured=False,
                    applicable=True,
                    summary=(
                        "Configure a API key do OTX."
                    ),
                )
            else:
                try:
                    providers[
                        "otx"
                    ] = query_otx(
                        indicator,
                        keys["otx"],
                    )
                except Exception as error:
                    providers[
                        "otx"
                    ] = provider_result(
                        "error",
                        configured=True,
                        applicable=True,
                        error=redact_error(
                            str(error),
                            keys,
                        ),
                    )

        risk, hit_count = (
            risk_from_providers(
                providers
            )
        )

        results.append({
            "index": index,
            "original":
                indicator[
                    "original"
                ],

            "indicator":
                indicator[
                    "normalized"
                ],

            "type":
                indicator[
                    "type"
                ],

            "risk": risk,
            "hitCount": hit_count,
            "providers": providers,
        })

        if index + 1 < len(
            classified
        ):
            time.sleep(0.08)

    summary = {
        "total": len(results),
        "malicious": sum(
            1
            for item in results
            if item["risk"]
            == "malicious"
        ),
        "suspicious": sum(
            1
            for item in results
            if item["risk"]
            == "suspicious"
        ),
        "cleanOrUnknown": sum(
            1
            for item in results
            if item["risk"]
            == "clean-or-unknown"
        ),
        "unknown": sum(
            1
            for item in results
            if item["risk"]
            == "unknown"
        ),
    }

    return {
        "generatedAt":
            time.strftime(
                "%Y-%m-%dT%H:%M:%SZ",
                time.gmtime(),
            ),

        "elapsedMs": round(
            (
                time.perf_counter()
                - started_at
            )
            * 1000,
            2,
        ),

        "selectedServices":
            sorted(
                selected_services
            ),

        "summary": summary,
        "results": results,
    }

