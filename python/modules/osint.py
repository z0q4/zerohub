from __future__ import annotations

import json
import re
import socket
import time
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urljoin, urlsplit
from urllib.request import Request, urlopen

from core.errors import (
    InvalidRequestError,
    ZeroHubError,
)


IANA_BOOTSTRAP_URL = (
    "https://data.iana.org/rdap/dns.json"
)

REQUEST_TIMEOUT_SECONDS = 12
MAX_RESPONSE_BYTES = 2 * 1024 * 1024
BOOTSTRAP_CACHE_SECONDS = 6 * 60 * 60

DOMAIN_LABEL_PATTERN = re.compile(
    r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$",
    re.IGNORECASE,
)

_bootstrap_cache: list[
    tuple[list[str], list[str]]
] | None = None

_bootstrap_cached_at = 0.0


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


def normalize_domain(
    raw_domain: str,
) -> str:
    domain = (
        raw_domain
        .strip()
        .lower()
        .rstrip(".")
    )

    if not domain:
        raise InvalidRequestError(
            "Informe um domínio para consultar."
        )

    if (
        "://" in domain
        or "/" in domain
        or "?" in domain
        or "#" in domain
        or any(
            character.isspace()
            for character in domain
        )
    ):
        raise InvalidRequestError(
            "Informe somente o domínio, sem protocolo, caminho ou espaços."
        )

    try:
        ascii_domain = (
            domain
            .encode("idna")
            .decode("ascii")
        )
    except UnicodeError as error:
        raise InvalidRequestError(
            "O domínio informado é inválido."
        ) from error

    if len(ascii_domain) > 253:
        raise InvalidRequestError(
            "O domínio excede o limite permitido."
        )

    labels = ascii_domain.split(".")

    if len(labels) < 2:
        raise InvalidRequestError(
            "Informe um domínio completo, como example.com."
        )

    if any(
        not label
        or len(label) > 63
        or not DOMAIN_LABEL_PATTERN.fullmatch(
            label
        )
        for label in labels
    ):
        raise InvalidRequestError(
            "O domínio possui um formato inválido."
        )

    return ascii_domain


def require_https_url(
    value: str,
) -> str:
    parsed = urlsplit(value)

    if (
        parsed.scheme != "https"
        or not parsed.netloc
    ):
        raise ZeroHubError(
            "O endpoint RDAP recebido não utiliza HTTPS."
        )

    return value


def fetch_json(
    url: str,
    *,
    accept: str,
) -> tuple[Any, str]:
    require_https_url(url)

    request = Request(
        url,
        method="GET",
        headers={
            "Accept": accept,
            "User-Agent":
                "ZeroHub/0.1.0 RDAP Client",
        },
    )

    try:
        with urlopen(
            request,
            timeout=REQUEST_TIMEOUT_SECONDS,
        ) as response:
            final_url = response.geturl()

            require_https_url(
                final_url
            )

            content_length = (
                response.headers.get(
                    "Content-Length"
                )
            )

            if content_length:
                try:
                    declared_size = int(
                        content_length
                    )
                except ValueError:
                    declared_size = 0

                if (
                    declared_size >
                    MAX_RESPONSE_BYTES
                ):
                    raise ZeroHubError(
                        "A resposta RDAP excede o limite permitido."
                    )

            raw_content = response.read(
                MAX_RESPONSE_BYTES + 1
            )

            if (
                len(raw_content) >
                MAX_RESPONSE_BYTES
            ):
                raise ZeroHubError(
                    "A resposta RDAP excede o limite permitido."
                )

            charset = (
                response.headers
                .get_content_charset()
                or "utf-8"
            )

            try:
                text = raw_content.decode(
                    charset
                )
            except (
                UnicodeDecodeError,
                LookupError,
            ) as error:
                raise ZeroHubError(
                    "A resposta RDAP possui uma codificação inválida."
                ) from error

    except HTTPError as error:
        if error.code == 400:
            message = (
                "O servidor RDAP rejeitou a consulta."
            )
        elif error.code == 404:
            message = (
                "O domínio não foi encontrado no servidor RDAP."
            )
        elif error.code == 429:
            message = (
                "O servidor RDAP limitou temporariamente as consultas."
            )
        else:
            message = (
                f"O servidor RDAP respondeu com HTTP {error.code}."
            )

        raise ZeroHubError(
            message
        ) from error

    except (
        URLError,
        TimeoutError,
        socket.timeout,
    ) as error:
        reason = getattr(
            error,
            "reason",
            error,
        )

        raise ZeroHubError(
            f"Não foi possível conectar ao servidor RDAP: {reason}"
        ) from error

    except OSError as error:
        raise ZeroHubError(
            f"Erro de rede durante a consulta RDAP: {error}"
        ) from error

    try:
        parsed_json = json.loads(
            text
        )
    except json.JSONDecodeError as error:
        raise ZeroHubError(
            "O servidor RDAP retornou um JSON inválido."
        ) from error

    return parsed_json, final_url


def parse_bootstrap(
    value: Any,
) -> list[
    tuple[list[str], list[str]]
]:
    if not isinstance(value, dict):
        raise ZeroHubError(
            "O bootstrap RDAP da IANA possui formato inválido."
        )

    services = value.get(
        "services"
    )

    if not isinstance(
        services,
        list,
    ):
        raise ZeroHubError(
            "O bootstrap RDAP da IANA não possui serviços válidos."
        )

    entries: list[
        tuple[list[str], list[str]]
    ] = []

    for service in services:
        if (
            not isinstance(
                service,
                list,
            )
            or len(service) < 2
        ):
            continue

        raw_suffixes = service[0]
        raw_urls = service[1]

        if (
            not isinstance(
                raw_suffixes,
                list,
            )
            or not isinstance(
                raw_urls,
                list,
            )
        ):
            continue

        suffixes = [
            suffix.lower()
            for suffix in raw_suffixes
            if isinstance(
                suffix,
                str,
            )
            and suffix
        ]

        urls = [
            url
            for url in raw_urls
            if isinstance(
                url,
                str,
            )
            and url.startswith(
                "https://"
            )
        ]

        if suffixes and urls:
            entries.append(
                (
                    suffixes,
                    urls,
                )
            )

    if not entries:
        raise ZeroHubError(
            "Nenhum servidor RDAP foi encontrado no bootstrap da IANA."
        )

    return entries


def get_bootstrap_entries() -> list[
    tuple[list[str], list[str]]
]:
    global _bootstrap_cache
    global _bootstrap_cached_at

    cache_is_valid = (
        _bootstrap_cache is not None
        and (
            time.monotonic()
            - _bootstrap_cached_at
        ) < BOOTSTRAP_CACHE_SECONDS
    )

    if cache_is_valid:
        return _bootstrap_cache or []

    response, _ = fetch_json(
        IANA_BOOTSTRAP_URL,
        accept="application/json",
    )

    entries = parse_bootstrap(
        response
    )

    _bootstrap_cache = entries
    _bootstrap_cached_at = (
        time.monotonic()
    )

    return entries


def resolve_rdap_base_url(
    domain: str,
) -> str:
    matches: list[
        tuple[str, list[str]]
    ] = []

    for (
        suffixes,
        base_urls,
    ) in get_bootstrap_entries():
        for suffix in suffixes:
            if (
                domain == suffix
                or domain.endswith(
                    f".{suffix}"
                )
            ):
                matches.append(
                    (
                        suffix,
                        base_urls,
                    )
                )

    if not matches:
        raise ZeroHubError(
            "A IANA não possui um servidor RDAP registrado para esse domínio."
        )

    matches.sort(
        key=lambda match:
            len(match[0]),
        reverse=True,
    )

    base_urls = matches[0][1]

    for base_url in base_urls:
        if base_url.startswith(
            "https://"
        ):
            return (
                base_url
                if base_url.endswith("/")
                else f"{base_url}/"
            )

    raise ZeroHubError(
        "O registro responsável não oferece um endpoint RDAP HTTPS."
    )


def get_string(
    value: Any,
) -> str | None:
    return (
        value
        if isinstance(value, str)
        else None
    )


def get_string_list(
    value: Any,
) -> list[str]:
    if not isinstance(
        value,
        list,
    ):
        return []

    return [
        item
        for item in value
        if isinstance(
            item,
            str,
        )
    ]


def parse_events(
    value: Any,
) -> list[dict[str, str]]:
    if not isinstance(
        value,
        list,
    ):
        return []

    events: list[
        dict[str, str]
    ] = []

    for item in value:
        if not isinstance(
            item,
            dict,
        ):
            continue

        action = get_string(
            item.get(
                "eventAction"
            )
        )

        date = get_string(
            item.get(
                "eventDate"
            )
        )

        if action and date:
            events.append({
                "action": action,
                "date": date,
            })

    return events


def extract_entity_name(
    entity: dict[str, Any],
) -> str | None:
    vcard = entity.get(
        "vcardArray"
    )

    if (
        not isinstance(
            vcard,
            list,
        )
        or len(vcard) < 2
        or not isinstance(
            vcard[1],
            list,
        )
    ):
        return None

    for property_value in vcard[1]:
        if (
            isinstance(
                property_value,
                list,
            )
            and len(
                property_value
            ) >= 4
            and property_value[0] == "fn"
            and isinstance(
                property_value[3],
                str,
            )
        ):
            return property_value[3]

    return None


def parse_entities(
    value: Any,
) -> list[dict[str, Any]]:
    if not isinstance(
        value,
        list,
    ):
        return []

    entities: list[
        dict[str, Any]
    ] = []

    for item in value:
        if not isinstance(
            item,
            dict,
        ):
            continue

        entities.append({
            "handle": get_string(
                item.get(
                    "handle"
                )
            ),
            "name":
                extract_entity_name(
                    item
                ),
            "roles":
                get_string_list(
                    item.get(
                        "roles"
                    )
                ),
        })

    return entities


def parse_nameservers(
    value: Any,
) -> list[str]:
    if not isinstance(
        value,
        list,
    ):
        return []

    nameservers: list[str] = []

    for item in value:
        if not isinstance(
            item,
            dict,
        ):
            continue

        name = (
            get_string(
                item.get(
                    "ldhName"
                )
            )
            or get_string(
                item.get(
                    "unicodeName"
                )
            )
        )

        if (
            name
            and name not in nameservers
        ):
            nameservers.append(
                name
            )

    return nameservers


def parse_notices(
    value: Any,
) -> list[str]:
    if not isinstance(
        value,
        list,
    ):
        return []

    notices: list[str] = []

    for item in value:
        if not isinstance(
            item,
            dict,
        ):
            continue

        title = get_string(
            item.get(
                "title"
            )
        )

        descriptions = (
            get_string_list(
                item.get(
                    "description"
                )
            )
        )

        parts = [
            part
            for part in [
                title,
                *descriptions,
            ]
            if part
        ]

        if parts:
            notices.append(
                " — ".join(parts)
            )

    return notices


def parse_secure_dns(
    value: Any,
) -> bool | None:
    if not isinstance(
        value,
        dict,
    ):
        return None

    delegation_signed = (
        value.get(
            "delegationSigned"
        )
    )

    if isinstance(
        delegation_signed,
        bool,
    ):
        return delegation_signed

    return None


def rdap_domain_lookup(
    payload: dict[str, Any],
) -> dict[str, Any]:
    domain = normalize_domain(
        require_string(
            payload,
            "domain",
        )
    )

    started_at = (
        time.perf_counter()
    )

    base_url = (
        resolve_rdap_base_url(
            domain
        )
    )

    domain_path = (
        "domain/"
        + quote(
            domain,
            safe="",
        )
    )

    query_url = urljoin(
        base_url,
        domain_path,
    )

    response, final_url = fetch_json(
        query_url,
        accept=(
            "application/rdap+json, "
            "application/json"
        ),
    )

    if not isinstance(
        response,
        dict,
    ):
        raise ZeroHubError(
            "O servidor RDAP retornou uma resposta inesperada."
        )

    return {
        "domain":
            get_string(
                response.get(
                    "ldhName"
                )
            )
            or domain,

        "unicodeName":
            get_string(
                response.get(
                    "unicodeName"
                )
            ),

        "handle":
            get_string(
                response.get(
                    "handle"
                )
            ),

        "status":
            get_string_list(
                response.get(
                    "status"
                )
            ),

        "nameservers":
            parse_nameservers(
                response.get(
                    "nameservers"
                )
            ),

        "events":
            parse_events(
                response.get(
                    "events"
                )
            ),

        "entities":
            parse_entities(
                response.get(
                    "entities"
                )
            ),

        "notices":
            parse_notices(
                response.get(
                    "notices"
                )
            ),

        "port43":
            get_string(
                response.get(
                    "port43"
                )
            ),

        "secureDns":
            parse_secure_dns(
                response.get(
                    "secureDNS"
                )
            ),

        "sourceUrl":
            final_url,

        "elapsedMs":
            round(
                (
                    time.perf_counter()
                    - started_at
                )
                * 1000,
                2,
            ),

        "rawJson":
            json.dumps(
                response,
                ensure_ascii=False,
                indent=2,
            ),
    }
