from __future__ import annotations

import re
import socket
import ssl
import time
from datetime import datetime, timezone
from html import unescape
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from core.errors import (
    InvalidRequestError,
    ZeroHubError,
)


REQUEST_TIMEOUT_SECONDS = 12
MAX_REDIRECTS = 10
MAX_BODY_BYTES = 256 * 1024
MAX_STANDARD_FILE_BYTES = 512 * 1024
USER_AGENT = "ZeroHub-WebRecon/0.1"

TITLE_PATTERN = re.compile(
    r"<title[^>]*>(.*?)</title>",
    re.IGNORECASE | re.DOTALL,
)

SITEMAP_PATTERN = re.compile(
    r"^\s*Sitemap:\s*(\S+)",
    re.IGNORECASE | re.MULTILINE,
)


class NoRedirectHandler(HTTPRedirectHandler):
    def redirect_request(
        self,
        req: Any,
        fp: Any,
        code: int,
        msg: str,
        headers: Any,
        newurl: str,
    ) -> None:
        return None


OPENER = build_opener(
    NoRedirectHandler()
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


def normalize_url(
    raw_url: str,
) -> str:
    value = raw_url.strip()

    if not value:
        raise InvalidRequestError(
            "Informe uma URL."
        )

    if len(value) > 2048:
        raise InvalidRequestError(
            "A URL excede o limite permitido."
        )

    parsed = urlsplit(value)

    if parsed.scheme not in {
        "http",
        "https",
    }:
        raise InvalidRequestError(
            "A URL precisa começar com http:// ou https://."
        )

    if not parsed.hostname:
        raise InvalidRequestError(
            "A URL não possui um host válido."
        )

    if parsed.username or parsed.password:
        raise InvalidRequestError(
            "URLs contendo usuário ou senha não são aceitas."
        )

    clean_path = parsed.path or "/"

    return urlunsplit((
        parsed.scheme,
        parsed.netloc,
        clean_path,
        parsed.query,
        "",
    ))


def headers_to_dict(
    headers: Any,
) -> dict[str, str]:
    output: dict[str, str] = {}

    for key, value in headers.items():
        output[key.lower()] = value

    return output


def read_limited(
    response: Any,
    maximum: int,
) -> tuple[bytes, bool]:
    content = response.read(
        maximum + 1
    )

    return (
        content[:maximum],
        len(content) > maximum,
    )


def response_charset(
    headers: dict[str, str],
) -> str:
    content_type = headers.get(
        "content-type",
        "",
    )

    match = re.search(
        r"charset=([^\s;]+)",
        content_type,
        re.IGNORECASE,
    )

    if match:
        return match.group(1).strip(
            "\"'"
        )

    return "utf-8"


def decode_body(
    body: bytes,
    headers: dict[str, str],
) -> str:
    charset = response_charset(
        headers
    )

    try:
        return body.decode(
            charset,
            errors="replace",
        )
    except LookupError:
        return body.decode(
            "utf-8",
            errors="replace",
        )


def extract_title(
    body: bytes,
    headers: dict[str, str],
) -> str | None:
    content_type = headers.get(
        "content-type",
        "",
    ).lower()

    if "html" not in content_type:
        return None

    text = decode_body(
        body,
        headers,
    )

    match = TITLE_PATTERN.search(
        text
    )

    if not match:
        return None

    title = unescape(
        re.sub(
            r"\s+",
            " ",
            match.group(1),
        ).strip()
    )

    return title[:300] or None


def request_once(
    url: str,
) -> dict[str, Any]:
    request = Request(
        url,
        method="GET",
        headers={
            "User-Agent": USER_AGENT,
            "Accept":
                "text/html,application/xhtml+xml,"
                "application/json,text/plain,*/*",

            "Range": "bytes=0-262143",
        },
    )

    started_at = time.perf_counter()

    try:
        response = OPENER.open(
            request,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

    except HTTPError as error:
        response = error

    except (
        URLError,
        TimeoutError,
        socket.timeout,
        OSError,
    ) as error:
        reason = getattr(
            error,
            "reason",
            error,
        )

        raise ZeroHubError(
            f"Falha na requisição HTTP: {reason}"
        ) from error

    elapsed_ms = round(
        (
            time.perf_counter()
            - started_at
        )
        * 1000,
        2,
    )

    headers = headers_to_dict(
        response.headers
    )

    body, truncated = read_limited(
        response,
        MAX_BODY_BYTES,
    )

    return {
        "statusCode": response.status,
        "reason": getattr(
            response,
            "reason",
            "",
        ),
        "headers": headers,
        "body": body,
        "bodyTruncated": truncated,
        "elapsedMs": elapsed_ms,
    }


def inspect_redirect_chain(
    initial_url: str,
) -> tuple[
    list[dict[str, Any]],
    dict[str, Any],
    str,
]:
    current_url = initial_url
    chain: list[dict[str, Any]] = []
    visited: set[str] = set()

    for index in range(
        MAX_REDIRECTS + 1
    ):
        if current_url in visited:
            raise ZeroHubError(
                "Foi detectado um ciclo de redirecionamento."
            )

        visited.add(
            current_url
        )

        response = request_once(
            current_url
        )

        headers = response["headers"]
        status_code = response["statusCode"]
        location = headers.get(
            "location"
        )

        chain.append({
            "index": index,
            "url": current_url,
            "statusCode": status_code,
            "reason": response["reason"],
            "location":
                urljoin(
                    current_url,
                    location,
                )
                if location
                else None,

            "elapsedMs":
                response["elapsedMs"],
        })

        if (
            status_code
            in {
                301,
                302,
                303,
                307,
                308,
            }
            and location
        ):
            next_url = normalize_url(
                urljoin(
                    current_url,
                    location,
                )
            )

            current_url = next_url
            continue

        return (
            chain,
            response,
            current_url,
        )

    raise ZeroHubError(
        f"A cadeia excedeu {MAX_REDIRECTS} redirecionamentos."
    )


def resolve_host(
    hostname: str,
    port: int,
) -> list[str]:
    addresses: set[str] = set()

    try:
        results = socket.getaddrinfo(
            hostname,
            port,
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror as error:
        raise ZeroHubError(
            f"Não foi possível resolver o host: {error}"
        ) from error

    for result in results:
        sockaddr = result[4]

        if sockaddr:
            addresses.add(
                sockaddr[0]
            )

    return sorted(
        addresses
    )


def flatten_name(
    value: Any,
) -> str:
    parts: list[str] = []

    if not isinstance(value, tuple):
        return ""

    for group in value:
        if not isinstance(group, tuple):
            continue

        for item in group:
            if (
                isinstance(item, tuple)
                and len(item) == 2
            ):
                parts.append(
                    f"{item[0]}={item[1]}"
                )

    return ", ".join(parts)


def inspect_tls(
    hostname: str,
    port: int,
) -> dict[str, Any]:
    context = ssl.create_default_context()

    started_at = time.perf_counter()

    try:
        with socket.create_connection(
            (
                hostname,
                port,
            ),
            timeout=REQUEST_TIMEOUT_SECONDS,
        ) as raw_socket:
            with context.wrap_socket(
                raw_socket,
                server_hostname=hostname,
            ) as secure_socket:
                certificate = (
                    secure_socket
                    .getpeercert()
                )

                cipher = (
                    secure_socket
                    .cipher()
                )

                tls_version = (
                    secure_socket
                    .version()
                )

    except ssl.SSLCertVerificationError as error:
        return {
            "available": True,
            "verified": False,
            "error":
                f"Falha na validação do certificado: {error.verify_message}",

            "hostname": hostname,
            "port": port,
            "handshakeMs": None,
            "tlsVersion": None,
            "cipher": None,
            "subject": None,
            "issuer": None,
            "serialNumber": None,
            "notBefore": None,
            "notAfter": None,
            "daysRemaining": None,
            "subjectAltNames": [],
        }

    except (
        ssl.SSLError,
        TimeoutError,
        socket.timeout,
        OSError,
    ) as error:
        return {
            "available": True,
            "verified": False,
            "error":
                f"Não foi possível concluir o handshake TLS: {error}",

            "hostname": hostname,
            "port": port,
            "handshakeMs": None,
            "tlsVersion": None,
            "cipher": None,
            "subject": None,
            "issuer": None,
            "serialNumber": None,
            "notBefore": None,
            "notAfter": None,
            "daysRemaining": None,
            "subjectAltNames": [],
        }

    handshake_ms = round(
        (
            time.perf_counter()
            - started_at
        )
        * 1000,
        2,
    )

    not_after = certificate.get(
        "notAfter"
    )

    days_remaining = None
    not_after_iso = None

    if isinstance(
        not_after,
        str,
    ):
        try:
            expires_timestamp = (
                ssl.cert_time_to_seconds(
                    not_after
                )
            )

            expires = datetime.fromtimestamp(
                expires_timestamp,
                tz=timezone.utc,
            )

            not_after_iso = (
                expires.isoformat()
            )

            days_remaining = int(
                (
                    expires
                    - datetime.now(
                        timezone.utc
                    )
                ).total_seconds()
                // 86400
            )
        except (
            ValueError,
            OverflowError,
            OSError,
        ):
            pass

    not_before = certificate.get(
        "notBefore"
    )

    not_before_iso = None

    if isinstance(
        not_before,
        str,
    ):
        try:
            not_before_iso = (
                datetime.fromtimestamp(
                    ssl.cert_time_to_seconds(
                        not_before
                    ),
                    tz=timezone.utc,
                ).isoformat()
            )
        except (
            ValueError,
            OverflowError,
            OSError,
        ):
            pass

    subject_alt_names = [
        value
        for key, value in certificate.get(
            "subjectAltName",
            [],
        )
        if key == "DNS"
    ]

    return {
        "available": True,
        "verified": True,
        "error": None,
        "hostname": hostname,
        "port": port,
        "handshakeMs": handshake_ms,
        "tlsVersion": tls_version,
        "cipher":
            cipher[0]
            if cipher
            else None,

        "subject": flatten_name(
            certificate.get("subject")
        ),

        "issuer": flatten_name(
            certificate.get("issuer")
        ),

        "serialNumber":
            certificate.get(
                "serialNumber"
            ),

        "notBefore": not_before_iso,
        "notAfter": not_after_iso,
        "daysRemaining":
            days_remaining,

        "subjectAltNames":
            subject_alt_names[:200],
    }


def security_header_result(
    name: str,
    headers: dict[str, str],
    severity: str,
    recommendation: str,
    *,
    aliases: tuple[str, ...] = (),
    not_applicable: bool = False,
) -> dict[str, Any]:
    candidates = (
        name.lower(),
        *(
            alias.lower()
            for alias in aliases
        ),
    )

    found_name = None
    found_value = None

    for candidate in candidates:
        if candidate in headers:
            found_name = candidate
            found_value = headers[candidate]
            break

    if not_applicable:
        status = "not-applicable"
    elif found_value:
        status = "present"
    else:
        status = "missing"

    return {
        "name": name,
        "status": status,
        "severity":
            "none"
            if status == "present"
            else severity,

        "value": found_value,
        "matchedHeader": found_name,
        "recommendation": recommendation,
    }


def analyze_security_headers(
    headers: dict[str, str],
    is_https: bool,
) -> dict[str, Any]:
    checks = [
        security_header_result(
            "Strict-Transport-Security",
            headers,
            "high",
            "Ative HSTS em respostas HTTPS.",
            not_applicable=not is_https,
        ),

        security_header_result(
            "Content-Security-Policy",
            headers,
            "high",
            "Defina uma política CSP restritiva.",
        ),

        security_header_result(
            "X-Content-Type-Options",
            headers,
            "medium",
            "Defina X-Content-Type-Options: nosniff.",
        ),

        security_header_result(
            "X-Frame-Options",
            headers,
            "medium",
            "Proteja contra clickjacking usando X-Frame-Options ou CSP frame-ancestors.",
            aliases=(
                "content-security-policy",
            ),
        ),

        security_header_result(
            "Referrer-Policy",
            headers,
            "low",
            "Defina uma política de referer adequada.",
        ),

        security_header_result(
            "Permissions-Policy",
            headers,
            "low",
            "Restrinja recursos do navegador não utilizados.",
        ),

        security_header_result(
            "Cross-Origin-Opener-Policy",
            headers,
            "low",
            "Avalie isolamento de contexto com COOP.",
        ),
    ]

    applicable = [
        check
        for check in checks
        if check["status"]
        != "not-applicable"
    ]

    present = sum(
        1
        for check in applicable
        if check["status"]
        == "present"
    )

    score = round(
        (
            present
            / max(
                1,
                len(applicable),
            )
        )
        * 100
    )

    return {
        "score": score,
        "present": present,
        "total":
            len(applicable),

        "checks": checks,
    }


def fetch_text_resource(
    url: str,
) -> dict[str, Any]:
    request = Request(
        url,
        method="GET",
        headers={
            "User-Agent": USER_AGENT,
            "Accept":
                "text/plain,application/xml,text/xml,*/*",

            "Range": "bytes=0-524287",
        },
    )

    started_at = time.perf_counter()

    try:
        response = OPENER.open(
            request,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )

    except HTTPError as error:
        response = error

    except (
        URLError,
        TimeoutError,
        socket.timeout,
        OSError,
    ) as error:
        reason = getattr(
            error,
            "reason",
            error,
        )

        return {
            "url": url,
            "statusCode": None,
            "found": False,
            "contentType": None,
            "content": None,
            "truncated": False,
            "elapsedMs": None,
            "error": str(reason),
        }

    elapsed_ms = round(
        (
            time.perf_counter()
            - started_at
        )
        * 1000,
        2,
    )

    headers = headers_to_dict(
        response.headers
    )

    body, truncated = read_limited(
        response,
        MAX_STANDARD_FILE_BYTES,
    )

    text = decode_body(
        body,
        headers,
    )

    status_code = response.status

    return {
        "url": url,
        "statusCode": status_code,
        "found":
            200 <= status_code < 300,

        "contentType":
            headers.get(
                "content-type"
            ),

        "content":
            text
            if text
            else None,

        "truncated": truncated,
        "elapsedMs": elapsed_ms,
        "error": None,
    }


def inspect_standard_files(
    final_url: str,
) -> dict[str, Any]:
    parsed = urlsplit(
        final_url
    )

    origin = urlunsplit((
        parsed.scheme,
        parsed.netloc,
        "",
        "",
        "",
    ))

    robots_url = urljoin(
        origin,
        "/robots.txt",
    )

    robots = fetch_text_resource(
        robots_url
    )

    sitemap_urls: list[str] = []

    robots_content = robots.get(
        "content"
    )

    if isinstance(
        robots_content,
        str,
    ):
        for match in SITEMAP_PATTERN.finditer(
            robots_content
        ):
            candidate = match.group(1)

            try:
                normalized = normalize_url(
                    urljoin(
                        origin,
                        candidate,
                    )
                )
            except InvalidRequestError:
                continue

            if normalized not in sitemap_urls:
                sitemap_urls.append(
                    normalized
                )

    default_sitemap = urljoin(
        origin,
        "/sitemap.xml",
    )

    if default_sitemap not in sitemap_urls:
        sitemap_urls.append(
            default_sitemap
        )

    sitemap = fetch_text_resource(
        sitemap_urls[0]
    )

    return {
        "robots": robots,
        "sitemap": sitemap,
        "discoveredSitemaps":
            sitemap_urls[:50],
    }


def inspect_web_target(
    payload: dict[str, Any],
) -> dict[str, Any]:
    requested_url = normalize_url(
        require_string(
            payload,
            "url",
        )
    )

    requested_parts = urlsplit(
        requested_url
    )

    requested_port = (
        requested_parts.port
        or (
            443
            if requested_parts.scheme
            == "https"
            else 80
        )
    )

    addresses = resolve_host(
        requested_parts.hostname or "",
        requested_port,
    )

    (
        redirect_chain,
        final_response,
        final_url,
    ) = inspect_redirect_chain(
        requested_url
    )

    final_parts = urlsplit(
        final_url
    )

    final_headers = (
        final_response["headers"]
    )

    title = extract_title(
        final_response["body"],
        final_headers,
    )

    tls = (
        inspect_tls(
            final_parts.hostname or "",
            final_parts.port or 443,
        )
        if final_parts.scheme == "https"
        else {
            "available": False,
            "verified": None,
            "error": None,
            "hostname":
                final_parts.hostname,

            "port":
                final_parts.port or 80,

            "handshakeMs": None,
            "tlsVersion": None,
            "cipher": None,
            "subject": None,
            "issuer": None,
            "serialNumber": None,
            "notBefore": None,
            "notAfter": None,
            "daysRemaining": None,
            "subjectAltNames": [],
        }
    )

    security_headers = analyze_security_headers(
        final_headers,
        final_parts.scheme == "https",
    )

    standard_files = inspect_standard_files(
        final_url
    )

    return {
        "requestedUrl": requested_url,
        "finalUrl": final_url,
        "hostname":
            final_parts.hostname,

        "scheme":
            final_parts.scheme,

        "port":
            final_parts.port
            or (
                443
                if final_parts.scheme
                == "https"
                else 80
            ),

        "resolvedAddresses":
            addresses,

        "statusCode":
            final_response["statusCode"],

        "reason":
            final_response["reason"],

        "elapsedMs":
            final_response["elapsedMs"],

        "title": title,

        "server":
            final_headers.get(
                "server"
            ),

        "contentType":
            final_headers.get(
                "content-type"
            ),

        "contentLength":
            final_headers.get(
                "content-length"
            ),

        "headers":
            final_headers,

        "bodyPreview":
            decode_body(
                final_response["body"],
                final_headers,
            )[:5000],

        "bodyTruncated":
            final_response[
                "bodyTruncated"
            ],

        "redirectChain":
            redirect_chain,

        "securityHeaders":
            security_headers,

        "tls": tls,

        "robots":
            standard_files[
                "robots"
            ],

        "sitemap":
            standard_files[
                "sitemap"
            ],

        "discoveredSitemaps":
            standard_files[
                "discoveredSitemaps"
            ],
    }

