from __future__ import annotations

import ipaddress
import os
import re
import secrets
import socket
import struct
import subprocess
import time
from pathlib import Path
from typing import Any

from core.errors import (
    InvalidRequestError,
    ZeroHubError,
)


DNS_RECORD_TYPES = {
    "A": 1,
    "NS": 2,
    "CNAME": 5,
    "MX": 15,
    "TXT": 16,
    "AAAA": 28,
}

DNS_TIMEOUT_SECONDS = 4.0
DNS_PORT = 53
MAX_DNS_PACKET_SIZE = 65_535

MAX_PING_OUTPUT_LENGTH = (
    128 * 1024
)

HOST_LABEL_PATTERN = re.compile(
    r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$",
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


def require_integer(
    payload: dict[str, Any],
    field: str,
) -> int:
    value = payload.get(field)

    if (
        isinstance(value, bool)
        or not isinstance(value, int)
    ):
        raise InvalidRequestError(
            f"O campo '{field}' precisa ser um número inteiro."
        )

    return value


def normalize_hostname(
    raw_value: str,
    *,
    require_complete_domain: bool,
) -> str:
    value = (
        raw_value
        .strip()
        .lower()
        .rstrip(".")
    )

    if not value:
        raise InvalidRequestError(
            "Informe um domínio, hostname ou endereço IP."
        )

    if (
        "://" in value
        or "/" in value
        or "?" in value
        or "#" in value
        or any(
            character.isspace()
            for character in value
        )
    ):
        raise InvalidRequestError(
            "Informe somente o domínio, hostname ou IP, sem protocolo, caminho ou espaços."
        )

    try:
        ipaddress.ip_address(value)
        return value
    except ValueError:
        pass

    try:
        ascii_hostname = (
            value
            .encode("idna")
            .decode("ascii")
        )
    except UnicodeError as error:
        raise InvalidRequestError(
            "O hostname informado é inválido."
        ) from error

    if len(ascii_hostname) > 253:
        raise InvalidRequestError(
            "O hostname informado excede o limite permitido."
        )

    labels = ascii_hostname.split(".")

    if (
        require_complete_domain
        and len(labels) < 2
    ):
        raise InvalidRequestError(
            "Informe um domínio completo, como example.com."
        )

    if any(
        not label
        or len(label) > 63
        or not HOST_LABEL_PATTERN.fullmatch(label)
        for label in labels
    ):
        raise InvalidRequestError(
            "O hostname informado possui um formato inválido."
        )

    return ascii_hostname


def read_system_nameservers() -> list[str]:
    resolv_conf = Path(
        "/etc/resolv.conf"
    )

    nameservers: list[str] = []

    try:
        content = resolv_conf.read_text(
            encoding="utf-8",
            errors="replace",
        )
    except OSError as error:
        raise ZeroHubError(
            f"Não foi possível ler a configuração DNS do sistema: {error}"
        ) from error

    for raw_line in content.splitlines():
        line = raw_line.strip()

        if (
            not line
            or line.startswith("#")
        ):
            continue

        parts = line.split()

        if (
            len(parts) >= 2
            and parts[0] == "nameserver"
        ):
            nameserver = parts[1]

            try:
                ipaddress.ip_address(
                    nameserver.split("%", 1)[0]
                )
            except ValueError:
                continue

            if nameserver not in nameservers:
                nameservers.append(
                    nameserver
                )

    if not nameservers:
        raise ZeroHubError(
            "Nenhum servidor DNS foi encontrado em /etc/resolv.conf."
        )

    return nameservers[:3]


def encode_dns_name(
    domain: str,
) -> bytes:
    encoded = bytearray()

    for label in domain.split("."):
        label_bytes = label.encode(
            "ascii"
        )

        if len(label_bytes) > 63:
            raise InvalidRequestError(
                "Uma parte do domínio excede 63 caracteres."
            )

        encoded.append(
            len(label_bytes)
        )

        encoded.extend(
            label_bytes
        )

    encoded.append(0)

    return bytes(encoded)


def build_dns_query(
    transaction_id: int,
    domain: str,
    query_type: int,
) -> bytes:
    header = struct.pack(
        "!HHHHHH",
        transaction_id,
        0x0100,
        1,
        0,
        0,
        0,
    )

    question = (
        encode_dns_name(domain)
        + struct.pack(
            "!HH",
            query_type,
            1,
        )
    )

    return header + question


def decode_dns_name(
    packet: bytes,
    initial_offset: int,
) -> tuple[str, int]:
    labels: list[str] = []
    offset = initial_offset
    next_offset = initial_offset
    jumped = False
    visited_offsets: set[int] = set()

    while True:
        if offset >= len(packet):
            raise ZeroHubError(
                "A resposta DNS contém um nome incompleto."
            )

        if offset in visited_offsets:
            raise ZeroHubError(
                "A resposta DNS contém um ponteiro circular."
            )

        visited_offsets.add(offset)

        length = packet[offset]

        if (
            length & 0xC0
        ) == 0xC0:
            if offset + 1 >= len(packet):
                raise ZeroHubError(
                    "A resposta DNS contém um ponteiro incompleto."
                )

            pointer = (
                ((length & 0x3F) << 8)
                | packet[offset + 1]
            )

            if not jumped:
                next_offset = (
                    offset + 2
                )

            offset = pointer
            jumped = True
            continue

        if length == 0:
            if not jumped:
                next_offset = (
                    offset + 1
                )

            break

        offset += 1
        end = offset + length

        if end > len(packet):
            raise ZeroHubError(
                "A resposta DNS contém um label incompleto."
            )

        labels.append(
            packet[offset:end]
            .decode(
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


def receive_exact(
    connection: socket.socket,
    length: int,
) -> bytes:
    chunks: list[bytes] = []
    remaining = length

    while remaining > 0:
        chunk = connection.recv(
            remaining
        )

        if not chunk:
            raise ZeroHubError(
                "A conexão DNS TCP foi encerrada antes do fim da resposta."
            )

        chunks.append(chunk)
        remaining -= len(chunk)

    return b"".join(chunks)


def query_dns_udp(
    nameserver: str,
    request: bytes,
) -> bytes:
    clean_nameserver = (
        nameserver.split("%", 1)[0]
    )

    address = ipaddress.ip_address(
        clean_nameserver
    )

    family = (
        socket.AF_INET6
        if address.version == 6
        else socket.AF_INET
    )

    destination: Any

    if family == socket.AF_INET6:
        destination = (
            nameserver,
            DNS_PORT,
            0,
            0,
        )
    else:
        destination = (
            nameserver,
            DNS_PORT,
        )

    with socket.socket(
        family,
        socket.SOCK_DGRAM,
    ) as dns_socket:
        dns_socket.settimeout(
            DNS_TIMEOUT_SECONDS
        )

        dns_socket.sendto(
            request,
            destination,
        )

        response, _ = (
            dns_socket.recvfrom(
                MAX_DNS_PACKET_SIZE
            )
        )

    return response


def query_dns_tcp(
    nameserver: str,
    request: bytes,
) -> bytes:
    with socket.create_connection(
        (
            nameserver,
            DNS_PORT,
        ),
        timeout=DNS_TIMEOUT_SECONDS,
    ) as connection:
        connection.settimeout(
            DNS_TIMEOUT_SECONDS
        )

        connection.sendall(
            struct.pack(
                "!H",
                len(request),
            )
            + request
        )

        response_length = (
            struct.unpack(
                "!H",
                receive_exact(
                    connection,
                    2,
                ),
            )[0]
        )

        if (
            response_length <= 0
            or response_length
            > MAX_DNS_PACKET_SIZE
        ):
            raise ZeroHubError(
                "O servidor DNS retornou um tamanho de resposta inválido."
            )

        return receive_exact(
            connection,
            response_length,
        )


def perform_dns_query(
    domain: str,
    query_type: int,
) -> bytes:
    transaction_id = (
        secrets.randbelow(
            65_536
        )
    )

    request = build_dns_query(
        transaction_id,
        domain,
        query_type,
    )

    errors: list[str] = []

    for nameserver in (
        read_system_nameservers()
    ):
        try:
            response = query_dns_udp(
                nameserver,
                request,
            )

            if len(response) < 12:
                raise ZeroHubError(
                    "O servidor DNS retornou uma resposta incompleta."
                )

            (
                response_id,
                flags,
                _questions,
                _answers,
                _authority,
                _additional,
            ) = struct.unpack(
                "!HHHHHH",
                response[:12],
            )

            if (
                response_id
                != transaction_id
            ):
                raise ZeroHubError(
                    "O servidor DNS retornou uma identificação inesperada."
                )

            is_truncated = bool(
                flags & 0x0200
            )

            if is_truncated:
                response = query_dns_tcp(
                    nameserver,
                    request,
                )

            return response

        except (
            OSError,
            TimeoutError,
            ZeroHubError,
        ) as error:
            errors.append(
                f"{nameserver}: {error}"
            )

    detail = (
        "; ".join(errors)
        or "nenhum servidor respondeu"
    )

    raise ZeroHubError(
        f"Não foi possível concluir a consulta DNS: {detail}"
    )


def parse_txt_record(
    packet: bytes,
    offset: int,
    length: int,
) -> str:
    end = offset + length
    parts: list[str] = []

    while offset < end:
        segment_length = packet[offset]
        offset += 1

        segment_end = (
            offset + segment_length
        )

        if segment_end > end:
            raise ZeroHubError(
                "O registro TXT recebido está incompleto."
            )

        parts.append(
            packet[offset:segment_end]
            .decode(
                "utf-8",
                errors="replace",
            )
        )

        offset = segment_end

    return "".join(parts)


def parse_dns_records(
    packet: bytes,
    expected_transaction_id: int | None,
    query_type: int,
) -> list[str]:
    if len(packet) < 12:
        raise ZeroHubError(
            "A resposta DNS está incompleta."
        )

    (
        transaction_id,
        flags,
        question_count,
        answer_count,
        authority_count,
        additional_count,
    ) = struct.unpack(
        "!HHHHHH",
        packet[:12],
    )

    if (
        expected_transaction_id
        is not None
        and transaction_id
        != expected_transaction_id
    ):
        raise ZeroHubError(
            "A resposta DNS pertence a outra consulta."
        )

    response_code = (
        flags & 0x000F
    )

    if response_code == 3:
        raise ZeroHubError(
            "O domínio não foi encontrado."
        )

    if response_code == 2:
        raise ZeroHubError(
            "O servidor DNS não conseguiu processar a consulta."
        )

    if response_code == 5:
        raise ZeroHubError(
            "A consulta foi recusada pelo servidor DNS."
        )

    if response_code != 0:
        raise ZeroHubError(
            f"O servidor DNS retornou o código de erro {response_code}."
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
                "A seção de perguntas da resposta DNS está incompleta."
            )

    total_records = (
        answer_count
        + authority_count
        + additional_count
    )

    records: list[str] = []

    for _ in range(
        total_records
    ):
        _, offset = decode_dns_name(
            packet,
            offset,
        )

        if offset + 10 > len(packet):
            raise ZeroHubError(
                "A resposta DNS contém um registro incompleto."
            )

        (
            record_type,
            record_class,
            _ttl,
            data_length,
        ) = struct.unpack(
            "!HHIH",
            packet[
                offset:
                offset + 10
            ],
        )

        offset += 10
        data_offset = offset
        data_end = (
            data_offset
            + data_length
        )

        if data_end > len(packet):
            raise ZeroHubError(
                "Os dados de um registro DNS estão incompletos."
            )

        if (
            record_class == 1
            and record_type
            == query_type
        ):
            if (
                record_type == 1
                and data_length == 4
            ):
                records.append(
                    socket.inet_ntop(
                        socket.AF_INET,
                        packet[
                            data_offset:
                            data_end
                        ],
                    )
                )

            elif (
                record_type == 28
                and data_length == 16
            ):
                records.append(
                    socket.inet_ntop(
                        socket.AF_INET6,
                        packet[
                            data_offset:
                            data_end
                        ],
                    )
                )

            elif record_type in {
                2,
                5,
            }:
                name, _ = (
                    decode_dns_name(
                        packet,
                        data_offset,
                    )
                )

                records.append(name)

            elif record_type == 15:
                if data_length < 3:
                    raise ZeroHubError(
                        "O registro MX recebido é inválido."
                    )

                priority = (
                    struct.unpack(
                        "!H",
                        packet[
                            data_offset:
                            data_offset + 2
                        ],
                    )[0]
                )

                exchange, _ = (
                    decode_dns_name(
                        packet,
                        data_offset + 2,
                    )
                )

                records.append(
                    f"{priority} {exchange}"
                )

            elif record_type == 16:
                records.append(
                    parse_txt_record(
                        packet,
                        data_offset,
                        data_length,
                    )
                )

        offset = data_end

    unique_records: list[str] = []

    for record in records:
        if (
            record
            and record
            not in unique_records
        ):
            unique_records.append(
                record
            )

    return unique_records


def dns_lookup(
    payload: dict[str, Any],
) -> dict[str, Any]:
    domain = normalize_hostname(
        require_string(
            payload,
            "domain",
        ),
        require_complete_domain=True,
    )

    record_type = require_string(
        payload,
        "recordType",
    ).upper()

    query_type = DNS_RECORD_TYPES.get(
        record_type
    )

    if query_type is None:
        raise InvalidRequestError(
            f"O tipo de registro DNS '{record_type}' não é suportado."
        )

    started_at = (
        time.perf_counter()
    )

    packet = perform_dns_query(
        domain,
        query_type,
    )

    records = parse_dns_records(
        packet,
        None,
        query_type,
    )

    if not records:
        raise ZeroHubError(
            "Nenhum registro desse tipo foi encontrado para o domínio."
        )

    if record_type == "MX":
        records.sort(
            key=lambda item: int(
                item.split(
                    " ",
                    1,
                )[0]
            )
        )

    return {
        "domain": domain,
        "recordType": record_type,
        "records": records,
        "elapsedMs": round(
            (
                time.perf_counter()
                - started_at
            )
            * 1000,
            2,
        ),
    }


def normalize_ping_target(
    raw_target: str,
) -> str:
    return normalize_hostname(
        raw_target,
        require_complete_domain=False,
    )


def limit_output(
    value: str,
) -> str:
    if (
        len(value)
        <= MAX_PING_OUTPUT_LENGTH
    ):
        return value

    return (
        value[
            :MAX_PING_OUTPUT_LENGTH
        ]
        + "\n\n[Saída limitada pelo ZeroHub]"
    )


def timeout_output(
    value: str | bytes | None,
) -> str:
    if value is None:
        return ""

    if isinstance(value, bytes):
        return value.decode(
            "utf-8",
            errors="replace",
        )

    return value


def build_ping_command(
    target: str,
    count: int,
    timeout_ms: int,
) -> list[str]:
    try:
        ip_version = (
            ipaddress
            .ip_address(target)
            .version
        )
    except ValueError:
        ip_version = 0

    if os.name == "nt":
        command = [
            "ping",
        ]

        if ip_version == 6:
            command.append("-6")

        command.extend([
            "-n",
            str(count),
            "-w",
            str(timeout_ms),
            target,
        ])

        return command

    if os.name == "posix":
        command = [
            "ping",
        ]

        if ip_version == 6:
            command.append("-6")

        command.extend([
            "-n",
            "-c",
            str(count),
            "-W",
            str(
                max(
                    1,
                    (
                        timeout_ms
                        + 999
                    )
                    // 1000,
                )
            ),
            target,
        ])

        return command

    raise ZeroHubError(
        f"Ping não é suportado nesta plataforma: {os.name}."
    )


def ping_host(
    payload: dict[str, Any],
) -> dict[str, Any]:
    target = normalize_ping_target(
        require_string(
            payload,
            "target",
        )
    )

    count = require_integer(
        payload,
        "count",
    )

    timeout_ms = require_integer(
        payload,
        "timeoutMs",
    )

    if (
        count < 1
        or count > 10
    ):
        raise InvalidRequestError(
            "A quantidade de pacotes precisa estar entre 1 e 10."
        )

    if (
        timeout_ms < 500
        or timeout_ms > 10_000
    ):
        raise InvalidRequestError(
            "O timeout precisa estar entre 500 e 10000 milissegundos."
        )

    command = build_ping_command(
        target,
        count,
        timeout_ms,
    )

    maximum_duration = min(
        60.0,
        (
            count
            * timeout_ms
            / 1000
        )
        + 5.0,
    )

    started_at = (
        time.perf_counter()
    )

    try:
        process = subprocess.run(
            command,
            shell=False,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=maximum_duration,
            check=False,
        )

        output = "\n".join(
            part.strip()
            for part in (
                process.stdout,
                process.stderr,
            )
            if part.strip()
        )

        return {
            "target": target,
            "output": limit_output(
                output
                or "O comando não retornou nenhuma saída."
            ),
            "success": (
                process.returncode == 0
            ),
            "timedOut": False,
            "exitCode": (
                process.returncode
            ),
            "elapsedMs": round(
                (
                    time.perf_counter()
                    - started_at
                )
                * 1000,
                2,
            ),
        }

    except FileNotFoundError as error:
        raise ZeroHubError(
            "O comando ping não foi encontrado no sistema."
        ) from error

    except subprocess.TimeoutExpired as error:
        output = "\n".join(
            part.strip()
            for part in (
                timeout_output(
                    error.stdout
                ),
                timeout_output(
                    error.stderr
                ),
            )
            if part.strip()
        )

        return {
            "target": target,
            "output": limit_output(
                output
                or "A execução do Ping excedeu o tempo limite."
            ),
            "success": False,
            "timedOut": True,
            "exitCode": None,
            "elapsedMs": round(
                (
                    time.perf_counter()
                    - started_at
                )
                * 1000,
                2,
            ),
        }

    except OSError as error:
        raise ZeroHubError(
            f"Não foi possível executar o Ping: {error}"
        ) from error
