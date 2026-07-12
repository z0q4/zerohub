from __future__ import annotations

import base64
import random
import re
import socket
import struct
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from core.errors import (
    InvalidRequestError,
    ZeroHubError,
)


DNS_TIMEOUT_SECONDS = 5
DNS_PORT = 53
MAX_DNS_PACKET = 65535
TYPE_A = 1
TYPE_CNAME = 5
TYPE_MX = 15
TYPE_TXT = 16
TYPE_AAAA = 28
CLASS_IN = 1

DOMAIN_PATTERN = re.compile(
    r"^(?=.{1,253}\.?$)"
    r"(?:"
    r"[a-z0-9]"
    r"(?:[a-z0-9-]{0,61}[a-z0-9])?"
    r"\."
    r")+"
    r"[a-z0-9]"
    r"(?:[a-z0-9-]{0,61}[a-z0-9])?"
    r"\.?$",
    re.IGNORECASE,
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


def normalize_domain(
    raw_value: str,
) -> str:
    value = raw_value.strip()

    if not value:
        raise InvalidRequestError(
            "Informe um domínio."
        )

    if len(value) > 2048:
        raise InvalidRequestError(
            "O domínio excede o limite permitido."
        )

    if "://" in value:
        parsed = urlsplit(value)
        host = parsed.hostname
    else:
        host = (
            value
            .split("/", 1)[0]
            .split(":", 1)[0]
        )

    if not host:
        raise InvalidRequestError(
            "O domínio informado é inválido."
        )

    try:
        ascii_domain = (
            host
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
        ascii_domain
    ):
        raise InvalidRequestError(
            "O domínio informado não possui um formato válido."
        )

    return ascii_domain


def normalize_selector(
    raw_value: str,
) -> str | None:
    selector = (
        raw_value
        .strip()
        .strip(".")
        .lower()
    )

    if not selector:
        return None

    if len(selector) > 253:
        raise InvalidRequestError(
            "O seletor DKIM excede o limite permitido."
        )

    if not re.fullmatch(
        r"[a-z0-9_-]+(?:\.[a-z0-9_-]+)*",
        selector,
        re.IGNORECASE,
    ):
        raise InvalidRequestError(
            "O seletor DKIM possui caracteres inválidos."
        )

    return selector


def system_nameservers() -> list[str]:
    nameservers: list[str] = []

    content = None

    try:
        content = Path(
            "/etc/resolv.conf"
        ).read_text(
            encoding="utf-8",
            errors="replace",
        )
    except OSError:
        content = None

    if content:
        for line in content.splitlines():
            stripped = line.strip()

            if (
                not stripped
                or stripped.startswith("#")
            ):
                continue

            parts = stripped.split()

            if (
                len(parts) >= 2
                and parts[0] == "nameserver"
            ):
                candidate = parts[1]

                try:
                    socket.inet_pton(
                        socket.AF_INET,
                        candidate,
                    )

                    nameservers.append(
                        candidate
                    )

                    continue
                except OSError:
                    pass

                try:
                    socket.inet_pton(
                        socket.AF_INET6,
                        candidate,
                    )

                    nameservers.append(
                        candidate
                    )
                except OSError:
                    continue

    if not nameservers:
        raise ZeroHubError(
            "Nenhum servidor DNS foi encontrado em /etc/resolv.conf."
        )

    return list(
        dict.fromkeys(
            nameservers
        )
    )


def encode_dns_name(
    name: str,
) -> bytes:
    output = bytearray()

    for label in name.rstrip(
        "."
    ).split("."):
        encoded = label.encode(
            "ascii"
        )

        if len(encoded) > 63:
            raise InvalidRequestError(
                "Um rótulo DNS excede 63 bytes."
            )

        output.append(
            len(encoded)
        )

        output.extend(
            encoded
        )

    output.append(0)

    return bytes(output)


def build_query(
    query_id: int,
    name: str,
    record_type: int,
) -> bytes:
    header = struct.pack(
        "!HHHHHH",
        query_id,
        0x0100,
        1,
        0,
        0,
        0,
    )

    question = (
        encode_dns_name(
            name
        )
        + struct.pack(
            "!HH",
            record_type,
            CLASS_IN,
        )
    )

    return header + question


def decode_dns_name(
    packet: bytes,
    offset: int,
) -> tuple[str, int]:
    labels: list[str] = []
    jumped = False
    next_offset = offset
    seen_offsets: set[int] = set()

    while True:
        if offset >= len(packet):
            raise ZeroHubError(
                "Resposta DNS truncada durante a leitura de um nome."
            )

        length = packet[offset]

        if length == 0:
            offset += 1

            if not jumped:
                next_offset = offset

            break

        if (
            length & 0xC0
        ) == 0xC0:
            if offset + 1 >= len(packet):
                raise ZeroHubError(
                    "Ponteiro DNS truncado."
                )

            pointer = (
                (
                    length & 0x3F
                )
                << 8
            ) | packet[offset + 1]

            if pointer in seen_offsets:
                raise ZeroHubError(
                    "Ciclo de compressão detectado na resposta DNS."
                )

            seen_offsets.add(
                pointer
            )

            if not jumped:
                next_offset = (
                    offset + 2
                )

            offset = pointer
            jumped = True
            continue

        if length & 0xC0:
            raise ZeroHubError(
                "Formato de nome DNS não suportado."
            )

        offset += 1
        end = offset + length

        if end > len(packet):
            raise ZeroHubError(
                "Rótulo DNS truncado."
            )

        labels.append(
            packet[
                offset:end
            ].decode(
                "ascii",
                errors="replace",
            )
        )

        offset = end

        if not jumped:
            next_offset = offset

    return (
        ".".join(labels),
        next_offset,
    )


def parse_txt_data(
    packet: bytes,
    start: int,
    length: int,
) -> str:
    end = start + length
    cursor = start
    chunks: list[str] = []

    while cursor < end:
        chunk_length = packet[cursor]
        cursor += 1
        chunk_end = cursor + chunk_length

        if chunk_end > end:
            break

        chunks.append(
            packet[
                cursor:chunk_end
            ].decode(
                "utf-8",
                errors="replace",
            )
        )

        cursor = chunk_end

    return "".join(
        chunks
    )


def parse_dns_response(
    packet: bytes,
    expected_id: int,
) -> dict[str, Any]:
    if len(packet) < 12:
        raise ZeroHubError(
            "A resposta DNS é muito curta."
        )

    (
        query_id,
        flags,
        question_count,
        answer_count,
        authority_count,
        additional_count,
    ) = struct.unpack_from(
        "!HHHHHH",
        packet,
        0,
    )

    if query_id != expected_id:
        raise ZeroHubError(
            "O identificador da resposta DNS não corresponde à consulta."
        )

    rcode = flags & 0x000F
    truncated = bool(
        flags & 0x0200
    )

    offset = 12

    for _ in range(
        question_count
    ):
        _, offset = decode_dns_name(
            packet,
            offset,
        )

        offset += 4

        if offset > len(packet):
            raise ZeroHubError(
                "Seção de perguntas DNS truncada."
            )

    records: list[dict[str, Any]] = []

    total_records = (
        answer_count
        + authority_count
        + additional_count
    )

    for _ in range(
        total_records
    ):
        name, offset = decode_dns_name(
            packet,
            offset,
        )

        if offset + 10 > len(packet):
            raise ZeroHubError(
                "Cabeçalho de registro DNS truncado."
            )

        (
            record_type,
            record_class,
            ttl,
            data_length,
        ) = struct.unpack_from(
            "!HHIH",
            packet,
            offset,
        )

        offset += 10
        data_start = offset
        data_end = (
            data_start
            + data_length
        )

        if data_end > len(packet):
            raise ZeroHubError(
                "Dados de registro DNS truncados."
            )

        value: Any = None

        if (
            record_class == CLASS_IN
            and record_type == TYPE_TXT
        ):
            value = parse_txt_data(
                packet,
                data_start,
                data_length,
            )

        elif (
            record_class == CLASS_IN
            and record_type == TYPE_MX
            and data_length >= 3
        ):
            preference = struct.unpack_from(
                "!H",
                packet,
                data_start,
            )[0]

            exchange, _ = decode_dns_name(
                packet,
                data_start + 2,
            )

            value = {
                "preference":
                    preference,

                "exchange":
                    exchange.rstrip(
                        "."
                    ),
            }

        elif (
            record_class == CLASS_IN
            and record_type == TYPE_CNAME
        ):
            cname, _ = decode_dns_name(
                packet,
                data_start,
            )

            value = cname.rstrip(
                "."
            )

        elif (
            record_class == CLASS_IN
            and record_type == TYPE_A
            and data_length == 4
        ):
            value = socket.inet_ntop(
                socket.AF_INET,
                packet[
                    data_start:data_end
                ],
            )

        elif (
            record_class == CLASS_IN
            and record_type == TYPE_AAAA
            and data_length == 16
        ):
            value = socket.inet_ntop(
                socket.AF_INET6,
                packet[
                    data_start:data_end
                ],
            )

        if value is not None:
            records.append({
                "name":
                    name.rstrip(
                        "."
                    ),

                "type":
                    record_type,

                "ttl":
                    ttl,

                "value":
                    value,
            })

        offset = data_end

    return {
        "rcode": rcode,
        "truncated": truncated,
        "records": records,
    }


def tcp_dns_query(
    nameserver: str,
    packet: bytes,
    query_id: int,
) -> dict[str, Any]:
    family = (
        socket.AF_INET6
        if ":" in nameserver
        else socket.AF_INET
    )

    with socket.socket(
        family,
        socket.SOCK_STREAM,
    ) as client:
        client.settimeout(
            DNS_TIMEOUT_SECONDS
        )

        client.connect((
            nameserver,
            DNS_PORT,
        ))

        client.sendall(
            struct.pack(
                "!H",
                len(packet),
            )
            + packet
        )

        prefix = b""

        while len(prefix) < 2:
            chunk = client.recv(
                2 - len(prefix)
            )

            if not chunk:
                raise ZeroHubError(
                    "A conexão DNS TCP foi encerrada prematuramente."
                )

            prefix += chunk

        response_length = struct.unpack(
            "!H",
            prefix,
        )[0]

        if response_length > MAX_DNS_PACKET:
            raise ZeroHubError(
                "A resposta DNS excede o limite suportado."
            )

        response = bytearray()

        while len(response) < response_length:
            chunk = client.recv(
                min(
                    4096,
                    response_length
                    - len(response),
                )
            )

            if not chunk:
                raise ZeroHubError(
                    "A resposta DNS TCP foi interrompida."
                )

            response.extend(
                chunk
            )

    return parse_dns_response(
        bytes(response),
        query_id,
    )


def dns_query(
    name: str,
    record_type: int,
    nameservers: list[str],
) -> dict[str, Any]:
    last_error: Exception | None = None

    for nameserver in nameservers:
        query_id = random.SystemRandom().randrange(
            0,
            65536,
        )

        packet = build_query(
            query_id,
            name,
            record_type,
        )

        family = (
            socket.AF_INET6
            if ":" in nameserver
            else socket.AF_INET
        )

        started_at = time.perf_counter()

        try:
            with socket.socket(
                family,
                socket.SOCK_DGRAM,
            ) as client:
                client.settimeout(
                    DNS_TIMEOUT_SECONDS
                )

                client.sendto(
                    packet,
                    (
                        nameserver,
                        DNS_PORT,
                    ),
                )

                response, _ = client.recvfrom(
                    MAX_DNS_PACKET
                )

            parsed = parse_dns_response(
                response,
                query_id,
            )

            if parsed["truncated"]:
                parsed = tcp_dns_query(
                    nameserver,
                    packet,
                    query_id,
                )

            parsed["nameserver"] = (
                nameserver
            )

            parsed["elapsedMs"] = round(
                (
                    time.perf_counter()
                    - started_at
                )
                * 1000,
                2,
            )

            return parsed

        except (
            TimeoutError,
            socket.timeout,
            OSError,
            ZeroHubError,
        ) as error:
            last_error = error
            continue

    raise ZeroHubError(
        f"Todas as consultas DNS falharam: {last_error}"
    )


def txt_values(
    response: dict[str, Any],
) -> list[str]:
    return [
        str(record["value"])
        for record in response[
            "records"
        ]
        if record["type"]
        == TYPE_TXT
    ]


def parse_tag_record(
    record: str,
) -> dict[str, str]:
    tags: dict[str, str] = {}

    for part in record.split(";"):
        item = part.strip()

        if not item:
            continue

        if "=" not in item:
            continue

        key, value = item.split(
            "=",
            1,
        )

        tags[
            key.strip().lower()
        ] = value.strip()

    return tags


def finding(
    severity: str,
    title: str,
    detail: str,
) -> dict[str, str]:
    return {
        "severity": severity,
        "title": title,
        "detail": detail,
    }


def analyze_spf(
    records: list[str],
) -> dict[str, Any]:
    spf_records = [
        record.strip()
        for record in records
        if record.strip().lower().startswith(
            "v=spf1"
        )
    ]

    findings: list[dict[str, str]] = []
    mechanisms: list[dict[str, Any]] = []

    if not spf_records:
        findings.append(
            finding(
                "high",
                "SPF ausente",
                "Nenhum registro TXT iniciado por v=spf1 foi encontrado.",
            )
        )

        return {
            "present": False,
            "record": None,
            "records": [],
            "multiple": False,
            "mechanisms": [],
            "lookupEstimate": 0,
            "allQualifier": None,
            "strength": "missing",
            "findings": findings,
        }

    if len(spf_records) > 1:
        findings.append(
            finding(
                "high",
                "Múltiplos registros SPF",
                "Mais de um registro SPF pode causar PermError.",
            )
        )

    record = spf_records[0]
    terms = record.split()[1:]
    lookup_estimate = 0
    all_qualifier = None

    for term in terms:
        qualifier = "+"

        if term[:1] in {
            "+",
            "-",
            "~",
            "?",
        }:
            qualifier = term[0]
            body = term[1:]
        else:
            body = term

        if "=" in body:
            name, value = body.split(
                "=",
                1,
            )

            kind = "modifier"
        elif ":" in body:
            name, value = body.split(
                ":",
                1,
            )

            kind = "mechanism"
        elif "/" in body:
            name, value = body.split(
                "/",
                1,
            )

            kind = "mechanism"
        else:
            name = body
            value = None
            kind = "mechanism"

        normalized_name = (
            name
            .strip()
            .lower()
        )

        if normalized_name in {
            "include",
            "a",
            "mx",
            "ptr",
            "exists",
        }:
            lookup_estimate += 1

        if (
            kind == "modifier"
            and normalized_name
            == "redirect"
        ):
            lookup_estimate += 1

        if normalized_name == "all":
            all_qualifier = qualifier

        mechanisms.append({
            "raw": term,
            "qualifier": qualifier,
            "name": normalized_name,
            "value": value,
            "kind": kind,
        })

    if lookup_estimate > 10:
        findings.append(
            finding(
                "high",
                "Possível excesso de consultas DNS",
                f"O registro possui ao menos {lookup_estimate} mecanismos/modificadores que podem consultar DNS.",
            )
        )

    if any(
        item["name"] == "ptr"
        for item in mechanisms
    ):
        findings.append(
            finding(
                "medium",
                "Mecanismo ptr encontrado",
                "O mecanismo ptr é custoso e deve ser evitado em SPF.",
            )
        )

    if all_qualifier is None:
        strength = "incomplete"

        findings.append(
            finding(
                "medium",
                "Mecanismo all ausente",
                "O registro não possui uma política final explícita.",
            )
        )

    elif all_qualifier == "+":
        strength = "very-weak"

        findings.append(
            finding(
                "high",
                "SPF permite qualquer remetente",
                "A política +all autoriza qualquer servidor a enviar pelo domínio.",
            )
        )

    elif all_qualifier == "?":
        strength = "weak"

        findings.append(
            finding(
                "medium",
                "SPF neutro",
                "A política ?all não aplica uma negação efetiva.",
            )
        )

    elif all_qualifier == "~":
        strength = "softfail"

        findings.append(
            finding(
                "low",
                "SPF em softfail",
                "A política ~all é permissiva; considere -all após validar a infraestrutura.",
            )
        )

    else:
        strength = "strong"

    return {
        "present": True,
        "record": record,
        "records": spf_records,
        "multiple":
            len(spf_records) > 1,

        "mechanisms": mechanisms,
        "lookupEstimate":
            lookup_estimate,

        "allQualifier":
            all_qualifier,

        "strength": strength,
        "findings": findings,
    }


def analyze_dmarc(
    records: list[str],
) -> dict[str, Any]:
    dmarc_records = [
        record.strip()
        for record in records
        if record.strip().lower().startswith(
            "v=dmarc1"
        )
    ]

    findings: list[dict[str, str]] = []

    if not dmarc_records:
        findings.append(
            finding(
                "high",
                "DMARC ausente",
                "Nenhum registro DMARC válido foi encontrado em _dmarc.",
            )
        )

        return {
            "present": False,
            "record": None,
            "records": [],
            "multiple": False,
            "tags": {},
            "policy": None,
            "subdomainPolicy": None,
            "percentage": None,
            "strength": "missing",
            "findings": findings,
        }

    if len(dmarc_records) > 1:
        findings.append(
            finding(
                "high",
                "Múltiplos registros DMARC",
                "O domínio deve publicar apenas um registro DMARC.",
            )
        )

    record = dmarc_records[0]
    tags = parse_tag_record(
        record
    )

    policy = tags.get(
        "p"
    )

    subdomain_policy = tags.get(
        "sp"
    )

    raw_percentage = tags.get(
        "pct",
        "100",
    )

    try:
        percentage = int(
            raw_percentage
        )
    except ValueError:
        percentage = None

        findings.append(
            finding(
                "medium",
                "pct inválido",
                "O valor pct do registro DMARC não é um inteiro válido.",
            )
        )

    if policy is None:
        strength = "invalid"

        findings.append(
            finding(
                "high",
                "Política DMARC ausente",
                "A tag p é obrigatória para uma política DMARC útil.",
            )
        )

    elif policy == "none":
        strength = "monitoring"

        findings.append(
            finding(
                "medium",
                "DMARC somente em monitoramento",
                "p=none coleta relatórios, mas não bloqueia mensagens não autenticadas.",
            )
        )

    elif policy == "quarantine":
        strength = "moderate"

        findings.append(
            finding(
                "low",
                "DMARC em quarentena",
                "p=quarantine oferece proteção, mas p=reject é mais rígido.",
            )
        )

    elif policy == "reject":
        strength = "strong"

    else:
        strength = "invalid"

        findings.append(
            finding(
                "high",
                "Política DMARC inválida",
                f"A política p={policy} não é reconhecida.",
            )
        )

    if (
        percentage is not None
        and percentage < 100
    ):
        findings.append(
            finding(
                "medium",
                "DMARC aplicado parcialmente",
                f"A política é aplicada a apenas {percentage}% das mensagens.",
            )
        )

    if "rua" not in tags:
        findings.append(
            finding(
                "info",
                "Relatório agregado não configurado",
                "A tag rua não está presente.",
            )
        )

    return {
        "present": True,
        "record": record,
        "records": dmarc_records,
        "multiple":
            len(dmarc_records) > 1,

        "tags": tags,
        "policy": policy,
        "subdomainPolicy":
            subdomain_policy,

        "percentage": percentage,
        "strength": strength,
        "findings": findings,
    }


def analyze_dkim(
    records: list[str],
    selector: str | None,
) -> dict[str, Any]:
    findings: list[dict[str, str]] = []

    if selector is None:
        return {
            "checked": False,
            "selector": None,
            "present": False,
            "record": None,
            "records": [],
            "multiple": False,
            "tags": {},
            "keyType": None,
            "publicKeyPresent": False,
            "decodedPublicKeyBytes": None,
            "revoked": False,
            "findings": [
                finding(
                    "info",
                    "Seletor DKIM não informado",
                    "Informe um seletor para consultar o registro DKIM correspondente.",
                )
            ],
        }

    dkim_records = [
        record.strip()
        for record in records
        if (
            "p=" in record.lower()
            or record.strip().lower().startswith(
                "v=dkim1"
            )
        )
    ]

    if not dkim_records:
        findings.append(
            finding(
                "medium",
                "DKIM não encontrado",
                f"Nenhum registro DKIM foi encontrado para o seletor {selector}.",
            )
        )

        return {
            "checked": True,
            "selector": selector,
            "present": False,
            "record": None,
            "records": [],
            "multiple": False,
            "tags": {},
            "keyType": None,
            "publicKeyPresent": False,
            "decodedPublicKeyBytes": None,
            "revoked": False,
            "findings": findings,
        }

    if len(dkim_records) > 1:
        findings.append(
            finding(
                "medium",
                "Múltiplos registros DKIM",
                "Mais de um registro TXT foi interpretado como DKIM para o seletor.",
            )
        )

    record = dkim_records[0]
    tags = parse_tag_record(
        record
    )

    public_key = tags.get(
        "p"
    )

    revoked = (
        public_key is not None
        and public_key == ""
    )

    public_key_present = bool(
        public_key
    )

    decoded_size = None

    if public_key_present:
        try:
            padding = "=" * (
                (
                    4
                    - len(public_key) % 4
                )
                % 4
            )

            decoded_size = len(
                base64.b64decode(
                    public_key + padding,
                    validate=True,
                )
            )
        except (
            ValueError,
            base64.binascii.Error,
        ):
            findings.append(
                finding(
                    "medium",
                    "Chave DKIM inválida",
                    "A chave pública não contém Base64 válido.",
                )
            )

    if revoked:
        findings.append(
            finding(
                "high",
                "Chave DKIM revogada",
                "A tag p está vazia, indicando uma chave revogada.",
            )
        )

    elif not public_key_present:
        findings.append(
            finding(
                "high",
                "Chave pública DKIM ausente",
                "O registro não possui uma tag p utilizável.",
            )
        )

    key_type = tags.get(
        "k",
        "rsa",
    ).lower()

    if key_type not in {
        "rsa",
        "ed25519",
    }:
        findings.append(
            finding(
                "medium",
                "Tipo de chave incomum",
                f"O tipo k={key_type} não é reconhecido pela análise.",
            )
        )

    return {
        "checked": True,
        "selector": selector,
        "present": True,
        "record": record,
        "records": dkim_records,
        "multiple":
            len(dkim_records) > 1,

        "tags": tags,
        "keyType": key_type,
        "publicKeyPresent":
            public_key_present,

        "decodedPublicKeyBytes":
            decoded_size,

        "revoked": revoked,
        "findings": findings,
    }


def calculate_score(
    mx_records: list[dict[str, Any]],
    spf: dict[str, Any],
    dmarc: dict[str, Any],
    dkim: dict[str, Any],
) -> int:
    score = 100

    if not mx_records:
        score -= 15

    if not spf["present"]:
        score -= 25
    elif spf["multiple"]:
        score -= 15
    elif spf["strength"] == "very-weak":
        score -= 30
    elif spf["strength"] == "weak":
        score -= 18
    elif spf["strength"] == "softfail":
        score -= 7
    elif spf["strength"] == "incomplete":
        score -= 12

    if not dmarc["present"]:
        score -= 30
    elif dmarc["multiple"]:
        score -= 15
    elif dmarc["strength"] == "monitoring":
        score -= 20
    elif dmarc["strength"] == "moderate":
        score -= 5
    elif dmarc["strength"] == "invalid":
        score -= 25

    percentage = dmarc.get(
        "percentage"
    )

    if (
        isinstance(
            percentage,
            int,
        )
        and percentage < 100
    ):
        score -= 5

    if dkim["checked"]:
        if not dkim["present"]:
            score -= 15
        elif dkim["revoked"]:
            score -= 20
        elif not dkim[
            "publicKeyPresent"
        ]:
            score -= 20

    return max(
        0,
        min(
            100,
            score,
        ),
    )


def inspect_email_security(
    payload: dict[str, Any],
) -> dict[str, Any]:
    domain = normalize_domain(
        require_string(
            payload,
            "domain",
        )
    )

    selector = normalize_selector(
        require_string(
            payload,
            "selector",
        )
    )

    nameservers = system_nameservers()
    query_log: list[dict[str, Any]] = []

    def query(
        name: str,
        record_type: int,
    ) -> dict[str, Any]:
        response = dns_query(
            name,
            record_type,
            nameservers,
        )

        query_log.append({
            "name": name,
            "type": record_type,
            "rcode": response["rcode"],
            "nameserver":
                response["nameserver"],

            "elapsedMs":
                response["elapsedMs"],

            "recordCount":
                len(
                    response["records"]
                ),
        })

        return response

    mx_response = query(
        domain,
        TYPE_MX,
    )

    root_txt_response = query(
        domain,
        TYPE_TXT,
    )

    dmarc_name = (
        f"_dmarc.{domain}"
    )

    dmarc_response = query(
        dmarc_name,
        TYPE_TXT,
    )

    dkim_records: list[str] = []
    dkim_name = None

    if selector:
        dkim_name = (
            f"{selector}._domainkey.{domain}"
        )

        dkim_response = query(
            dkim_name,
            TYPE_TXT,
        )

        dkim_records = txt_values(
            dkim_response
        )

    mx_records = sorted(
        (
            {
                "preference":
                    record["value"][
                        "preference"
                    ],

                "exchange":
                    record["value"][
                        "exchange"
                    ],

                "ttl":
                    record["ttl"],
            }
            for record in mx_response[
                "records"
            ]
            if record["type"]
            == TYPE_MX
        ),
        key=lambda item: (
            item["preference"],
            item["exchange"],
        ),
    )

    root_txt_records = txt_values(
        root_txt_response
    )

    dmarc_txt_records = txt_values(
        dmarc_response
    )

    spf = analyze_spf(
        root_txt_records
    )

    dmarc = analyze_dmarc(
        dmarc_txt_records
    )

    dkim = analyze_dkim(
        dkim_records,
        selector,
    )

    findings: list[dict[str, str]] = []

    if not mx_records:
        findings.append(
            finding(
                "high",
                "MX ausente",
                "Nenhum servidor de email foi publicado para o domínio.",
            )
        )

    findings.extend(
        spf["findings"]
    )

    findings.extend(
        dmarc["findings"]
    )

    findings.extend(
        dkim["findings"]
    )

    severity_order = {
        "high": 0,
        "medium": 1,
        "low": 2,
        "info": 3,
    }

    findings.sort(
        key=lambda item: (
            severity_order.get(
                item["severity"],
                9,
            ),
            item["title"],
        )
    )

    score = calculate_score(
        mx_records,
        spf,
        dmarc,
        dkim,
    )

    if score >= 85:
        grade = "A"
    elif score >= 70:
        grade = "B"
    elif score >= 55:
        grade = "C"
    elif score >= 40:
        grade = "D"
    else:
        grade = "F"

    return {
        "domain": domain,
        "selector": selector,
        "dkimName": dkim_name,
        "nameservers":
            nameservers,

        "score": score,
        "grade": grade,
        "mx": mx_records,
        "spf": spf,
        "dmarc": dmarc,
        "dkim": dkim,
        "findings": findings,

        "raw": {
            "rootTxt":
                root_txt_records,

            "dmarcTxt":
                dmarc_txt_records,

            "dkimTxt":
                dkim_records,
        },

        "queries": query_log,
    }

