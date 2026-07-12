from __future__ import annotations

import ipaddress
import json
import re
import shutil
import socket
import subprocess
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from core.errors import (
    InvalidRequestError,
    ZeroHubError,
)

from modules.email_security import (
    CLASS_IN,
    TYPE_A,
    TYPE_AAAA,
    TYPE_CNAME,
    TYPE_MX,
    TYPE_TXT,
    dns_query,
    normalize_domain,
    system_nameservers,
)


COMMAND_TIMEOUT_SECONDS = 90
MAX_TRACEROUTE_HOPS = 64
MAX_COMMAND_OUTPUT = 2_000_000
MAX_DNS_RECORDS = 500

HOST_PATTERN = re.compile(
    r"^(?=.{1,253}$)"
    r"(?:"
    r"[A-Z0-9]"
    r"(?:[A-Z0-9-]{0,61}[A-Z0-9])?"
    r"\."
    r")*"
    r"[A-Z0-9]"
    r"(?:[A-Z0-9-]{0,61}[A-Z0-9])?$",
    re.IGNORECASE,
)

TRACE_HOP_PATTERN = re.compile(
    r"^\s*(?P<hop>\d+)"
    r"(?:\?:)?\s+"
    r"(?P<body>.*)$"
)

IP_IN_TEXT_PATTERN = re.compile(
    r"(?:"
    r"(?:\d{1,3}\.){3}\d{1,3}"
    r"|"
    r"(?:[0-9A-Fa-f]{0,4}:){2,7}"
    r"[0-9A-Fa-f]{0,4}"
    r")"
)

RTT_PATTERN = re.compile(
    r"(?P<rtt>\d+(?:\.\d+)?)\s*ms",
    re.IGNORECASE,
)

DNS_TYPES = {
    "A": TYPE_A,
    "AAAA": TYPE_AAAA,
    "CNAME": TYPE_CNAME,
    "MX": TYPE_MX,
    "TXT": TYPE_TXT,
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


def require_integer(
    payload: dict[str, Any],
    field: str,
) -> int:
    value = payload.get(field)

    if isinstance(value, bool) or not isinstance(value, int):
        raise InvalidRequestError(
            f"O campo '{field}' precisa ser um número inteiro."
        )

    return value


def normalize_target(
    raw_target: str,
) -> str:
    value = raw_target.strip()

    if not value:
        raise InvalidRequestError(
            "Informe um host ou endereço IP."
        )

    if len(value) > 2048:
        raise InvalidRequestError(
            "O alvo excede o limite permitido."
        )

    if "://" in value:
        parsed = urlsplit(value)
        host = parsed.hostname
    else:
        host = value.strip(
            "[]"
        )

        if "/" in host:
            host = host.split(
                "/",
                1,
            )[0]

    if not host:
        raise InvalidRequestError(
            "O alvo informado é inválido."
        )

    try:
        return str(
            ipaddress.ip_address(
                host
            )
        )
    except ValueError:
        pass

    try:
        ascii_host = (
            host
            .encode("idna")
            .decode("ascii")
            .lower()
        )
    except UnicodeError as error:
        raise InvalidRequestError(
            "O host não pôde ser convertido para IDNA."
        ) from error

    if not HOST_PATTERN.fullmatch(
        ascii_host
    ):
        raise InvalidRequestError(
            "O host informado possui formato inválido."
        )

    return ascii_host


def run_command(
    command: list[str],
    timeout: int = COMMAND_TIMEOUT_SECONDS,
) -> tuple[int, str, str]:
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
            shell=False,
        )

        stdout = result.stdout[
            :MAX_COMMAND_OUTPUT
        ]

        stderr = result.stderr[
            :MAX_COMMAND_OUTPUT
        ]

        return (
            result.returncode,
            stdout.strip(),
            stderr.strip(),
        )

    except FileNotFoundError:
        return (
            127,
            "",
            "Comando não encontrado.",
        )

    except subprocess.TimeoutExpired as error:
        stdout = (
            error.stdout.decode(
                "utf-8",
                errors="replace",
            )
            if isinstance(
                error.stdout,
                bytes,
            )
            else error.stdout or ""
        )

        stderr = (
            error.stderr.decode(
                "utf-8",
                errors="replace",
            )
            if isinstance(
                error.stderr,
                bytes,
            )
            else error.stderr or ""
        )

        return (
            124,
            stdout[
                :MAX_COMMAND_OUTPUT
            ].strip(),
            (
                stderr
                or "Tempo limite excedido."
            )[
                :MAX_COMMAND_OUTPUT
            ].strip(),
        )

    except OSError as error:
        return (
            1,
            "",
            str(error),
        )


def resolve_addresses(
    host: str,
    port: int,
) -> list[dict[str, Any]]:
    try:
        results = socket.getaddrinfo(
            host,
            port,
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror as error:
        raise ZeroHubError(
            f"Não foi possível resolver o host: {error}"
        ) from error

    addresses: list[dict[str, Any]] = []
    seen: set[
        tuple[int, str, int]
    ] = set()

    for (
        family,
        socket_type,
        protocol,
        _canonical_name,
        sockaddr,
    ) in results:
        address = sockaddr[0]
        resolved_port = sockaddr[1]

        key = (
            family,
            address,
            resolved_port,
        )

        if key in seen:
            continue

        seen.add(key)

        addresses.append({
            "family":
                "IPv6"
                if family == socket.AF_INET6
                else "IPv4",

            "familyCode": family,
            "socketType": socket_type,
            "protocol": protocol,
            "address": address,
            "port": resolved_port,
            "sockaddr": sockaddr,
        })

    return addresses


def check_port(
    payload: dict[str, Any],
) -> dict[str, Any]:
    host = normalize_target(
        require_string(
            payload,
            "host",
        )
    )

    port = require_integer(
        payload,
        "port",
    )

    timeout_ms = require_integer(
        payload,
        "timeoutMs",
    )

    if port < 1 or port > 65535:
        raise InvalidRequestError(
            "A porta precisa estar entre 1 e 65535."
        )

    if timeout_ms < 100 or timeout_ms > 30_000:
        raise InvalidRequestError(
            "O timeout precisa estar entre 100 e 30000 ms."
        )

    addresses = resolve_addresses(
        host,
        port,
    )

    attempts: list[dict[str, Any]] = []
    connected = False
    selected_address = None
    total_started_at = time.perf_counter()

    for item in addresses:
        started_at = time.perf_counter()

        try:
            with socket.socket(
                item["familyCode"],
                item["socketType"],
                item["protocol"],
            ) as client:
                client.settimeout(
                    timeout_ms / 1000
                )

                result_code = client.connect_ex(
                    item["sockaddr"]
                )

            elapsed_ms = round(
                (
                    time.perf_counter()
                    - started_at
                )
                * 1000,
                2,
            )

            open_state = (
                result_code == 0
            )

            attempts.append({
                "family": item["family"],
                "address": item["address"],
                "port": port,
                "open": open_state,
                "elapsedMs": elapsed_ms,
                "errorCode":
                    None
                    if open_state
                    else result_code,

                "error":
                    None
                    if open_state
                    else (
                        os_error_name(
                            result_code
                        )
                    ),
            })

            if open_state:
                connected = True
                selected_address = (
                    item["address"]
                )

                break

        except (
            TimeoutError,
            socket.timeout,
            OSError,
        ) as error:
            attempts.append({
                "family": item["family"],
                "address": item["address"],
                "port": port,
                "open": False,
                "elapsedMs": round(
                    (
                        time.perf_counter()
                        - started_at
                    )
                    * 1000,
                    2,
                ),
                "errorCode": None,
                "error": str(error),
            })

    return {
        "host": host,
        "port": port,
        "open": connected,
        "selectedAddress":
            selected_address,

        "attempts": attempts,
        "elapsedMs": round(
            (
                time.perf_counter()
                - total_started_at
            )
            * 1000,
            2,
        ),
    }


def os_error_name(
    error_code: int,
) -> str:
    try:
        return (
            Path(
                f"/proc/self/fd/{error_code}"
            ).name
        )
    except Exception:
        pass

    import os

    try:
        return os.strerror(
            error_code
        )
    except ValueError:
        return (
            f"Erro de conexão {error_code}"
        )


def parse_trace_output(
    stdout: str,
) -> list[dict[str, Any]]:
    hops: list[dict[str, Any]] = []

    for line in stdout.splitlines():
        match = TRACE_HOP_PATTERN.match(
            line
        )

        if not match:
            continue

        body = match.group(
            "body"
        ).strip()

        addresses: list[str] = []

        for candidate in IP_IN_TEXT_PATTERN.findall(
            body
        ):
            normalized_candidate = (
                candidate.strip()
            )

            try:
                normalized = str(
                    ipaddress.ip_address(
                        normalized_candidate
                    )
                )
            except ValueError:
                continue

            if normalized not in addresses:
                addresses.append(
                    normalized
                )

        rtts = [
            float(
                rtt.group("rtt")
            )
            for rtt in RTT_PATTERN.finditer(
                body
            )
        ]

        hops.append({
            "hop": int(
                match.group("hop")
            ),
            "addresses": addresses,
            "rttsMs": rtts,
            "timeout":
                "*" in body
                and not addresses,

            "raw": body,
        })

    return hops


def trace_route(
    payload: dict[str, Any],
) -> dict[str, Any]:
    host = normalize_target(
        require_string(
            payload,
            "host",
        )
    )

    max_hops = require_integer(
        payload,
        "maxHops",
    )

    if (
        max_hops < 1
        or max_hops
        > MAX_TRACEROUTE_HOPS
    ):
        raise InvalidRequestError(
            f"O limite de saltos precisa estar entre 1 e {MAX_TRACEROUTE_HOPS}."
        )

    command = None
    command_name = None

    if shutil.which(
        "traceroute"
    ):
        command_name = "traceroute"
        command = [
            "traceroute",
            "-n",
            "-m",
            str(max_hops),
            "-w",
            "2",
            "-q",
            "1",
            host,
        ]

    elif shutil.which(
        "tracepath"
    ):
        command_name = "tracepath"
        command = [
            "tracepath",
            "-n",
            "-m",
            str(max_hops),
            host,
        ]

    else:
        raise ZeroHubError(
            "Instale 'traceroute' ou 'tracepath' para usar esta ferramenta."
        )

    started_at = time.perf_counter()

    return_code, stdout, stderr = (
        run_command(
            command,
            timeout=COMMAND_TIMEOUT_SECONDS,
        )
    )

    elapsed_ms = round(
        (
            time.perf_counter()
            - started_at
        )
        * 1000,
        2,
    )

    hops = parse_trace_output(
        stdout
    )

    if (
        return_code not in {
            0,
            1,
        }
        and not hops
    ):
        raise ZeroHubError(
            stderr
            or (
                f"{command_name} terminou com código {return_code}."
            )
        )

    return {
        "host": host,
        "tool": command_name,
        "returnCode": return_code,
        "elapsedMs": elapsed_ms,
        "hops": hops,
        "rawOutput": stdout,
        "stderr": stderr or None,
    }


def calculate_subnet(
    payload: dict[str, Any],
) -> dict[str, Any]:
    raw_value = require_string(
        payload,
        "network",
    ).strip()

    if not raw_value:
        raise InvalidRequestError(
            "Informe um endereço com prefixo CIDR."
        )

    try:
        interface = ipaddress.ip_interface(
            raw_value
        )
    except ValueError as error:
        raise InvalidRequestError(
            f"CIDR inválido: {error}"
        ) from error

    network = interface.network
    total_addresses = network.num_addresses

    if isinstance(
        network,
        ipaddress.IPv4Network,
    ):
        broadcast = str(
            network.broadcast_address
        )

        if network.prefixlen <= 30:
            usable_addresses = max(
                0,
                total_addresses - 2,
            )

            first_host = str(
                network.network_address + 1
            )

            last_host = str(
                network.broadcast_address - 1
            )

        elif network.prefixlen == 31:
            usable_addresses = 2
            first_host = str(
                network.network_address
            )

            last_host = str(
                network.broadcast_address
            )

        else:
            usable_addresses = 1
            first_host = str(
                network.network_address
            )

            last_host = str(
                network.network_address
            )

    else:
        broadcast = None
        usable_addresses = total_addresses
        first_host = str(
            network.network_address
        )

        last_host = str(
            network[
                total_addresses - 1
            ]
        )

    return {
        "input": raw_value,
        "ip": str(
            interface.ip
        ),
        "version":
            interface.version,

        "prefixLength":
            network.prefixlen,

        "networkAddress":
            str(
                network.network_address
            ),

        "broadcastAddress":
            broadcast,

        "netmask":
            str(
                network.netmask
            ),

        "hostmask":
            str(
                network.hostmask
            ),

        "firstHost":
            first_host,

        "lastHost":
            last_host,

        "totalAddresses":
            total_addresses,

        "usableAddresses":
            usable_addresses,

        "isPrivate":
            network.is_private,

        "isGlobal":
            network.is_global,

        "isLoopback":
            network.is_loopback,

        "isLinkLocal":
            network.is_link_local,

        "reversePointer":
            interface.ip.reverse_pointer,
    }


def dns_explore(
    payload: dict[str, Any],
) -> dict[str, Any]:
    domain = normalize_domain(
        require_string(
            payload,
            "domain",
        )
    )

    record_type_name = (
        require_string(
            payload,
            "recordType",
        )
        .strip()
        .upper()
    )

    record_type = DNS_TYPES.get(
        record_type_name
    )

    if record_type is None:
        raise InvalidRequestError(
            "Tipo DNS suportado: A, AAAA, CNAME, MX ou TXT."
        )

    nameservers = system_nameservers()
    response = dns_query(
        domain,
        record_type,
        nameservers,
    )

    records = [
        record
        for record in response[
            "records"
        ]
        if (
            record["type"]
            == record_type
            and record.get(
                "value"
            )
            is not None
        )
    ][
        :MAX_DNS_RECORDS
    ]

    return {
        "domain": domain,
        "recordType":
            record_type_name,

        "rcode":
            response["rcode"],

        "nameserver":
            response["nameserver"],

        "elapsedMs":
            response["elapsedMs"],

        "records": records,
    }


def list_interfaces(
    payload: dict[str, Any],
) -> dict[str, Any]:
    del payload

    if not shutil.which(
        "ip"
    ):
        raise ZeroHubError(
            "O comando 'ip' não está instalado."
        )

    return_code, stdout, stderr = (
        run_command([
            "ip",
            "-json",
            "address",
            "show",
        ])
    )

    if return_code != 0:
        raise ZeroHubError(
            stderr
            or "Não foi possível listar as interfaces."
        )

    try:
        raw_interfaces = json.loads(
            stdout
        )
    except json.JSONDecodeError as error:
        raise ZeroHubError(
            "A saída do comando ip não contém JSON válido."
        ) from error

    interfaces: list[dict[str, Any]] = []

    for item in raw_interfaces:
        addresses: list[dict[str, Any]] = []

        for address in item.get(
            "addr_info",
            [],
        ):
            addresses.append({
                "family":
                    address.get(
                        "family"
                    ),

                "local":
                    address.get(
                        "local"
                    ),

                "prefixLength":
                    address.get(
                        "prefixlen"
                    ),

                "scope":
                    address.get(
                        "scope"
                    ),

                "broadcast":
                    address.get(
                        "broadcast"
                    ),

                "label":
                    address.get(
                        "label"
                    ),
            })

        interfaces.append({
            "index":
                item.get(
                    "ifindex"
                ),

            "name":
                item.get(
                    "ifname"
                ),

            "state":
                item.get(
                    "operstate"
                ),

            "mtu":
                item.get(
                    "mtu"
                ),

            "mac":
                item.get(
                    "address"
                ),

            "broadcast":
                item.get(
                    "broadcast"
                ),

            "flags":
                item.get(
                    "flags",
                    [],
                ),

            "addresses":
                addresses,
        })

    return {
        "interfaces": interfaces,
    }


def list_routes(
    payload: dict[str, Any],
) -> dict[str, Any]:
    del payload

    if not shutil.which(
        "ip"
    ):
        raise ZeroHubError(
            "O comando 'ip' não está instalado."
        )

    return_code, stdout, stderr = (
        run_command([
            "ip",
            "-json",
            "route",
            "show",
        ])
    )

    if return_code != 0:
        raise ZeroHubError(
            stderr
            or "Não foi possível listar as rotas."
        )

    try:
        raw_routes = json.loads(
            stdout
        )
    except json.JSONDecodeError as error:
        raise ZeroHubError(
            "A saída do comando ip não contém JSON válido."
        ) from error

    routes = [
        {
            "destination":
                item.get(
                    "dst",
                    "default",
                ),

            "gateway":
                item.get(
                    "gateway"
                ),

            "device":
                item.get(
                    "dev"
                ),

            "protocol":
                item.get(
                    "protocol"
                ),

            "scope":
                item.get(
                    "scope"
                ),

            "source":
                item.get(
                    "prefsrc"
                ),

            "metric":
                item.get(
                    "metric"
                ),

            "type":
                item.get(
                    "type",
                    "unicast",
                ),

            "flags":
                item.get(
                    "flags",
                    [],
                ),
        }
        for item in raw_routes
    ]

    return {
        "routes": routes,
    }

