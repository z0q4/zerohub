from __future__ import annotations

import sys
import traceback
from collections.abc import Callable
from typing import Any

from core.errors import UnknownActionError, ZeroHubError
from core.protocol import parse_request, write_error, write_success
from modules.encoding import transform_text
from modules.file_analysis import inspect_file
from modules.file_cracker import crack_zip
from modules.hash_tools import hash_file, hash_text
from modules.network import dns_lookup, ping_host
from modules.osint import rdap_domain_lookup
from modules.threat_intelligence import (
    virustotal_file_lookup,
    virustotal_file_upload,
    virustotal_url_lookup,
    virustotal_url_scan,
)

from modules.secret_scanner import (
    scan_file as scan_secret_file,
    scan_folder as scan_secret_folder,
)


from modules.file_forensics import (
    inspect_file as inspect_forensic_file,
)


from modules.log_analysis import (
    inspect_log_file,
)


from modules.system_audit import (
    run_system_audit,
)


from modules.cryptography_tools import (
    constant_time_compare,
    create_hmac,
    decode_jwt,
    derive_pbkdf2,
    generate_random,
    verify_hmac,
)


from modules.web_recon import (
    inspect_web_target,
)


from modules.email_security import (
    inspect_email_security,
)


from modules.network_toolkit import (
    calculate_subnet,
    check_port,
    dns_explore,
    list_interfaces,
    list_routes,
    trace_route,
)


from modules.developer_tools import (
    diff_text,
    json_format,
    regex_test,
    timestamp_convert,
    toml_convert,
    uuid_generate,
    yaml_convert,
)


from modules.ioc_intelligence import (
    query_ioc_intelligence,
)

Handler = Callable[[dict[str, Any]], Any]

ACTIONS: dict[str, Handler] = {
    "ioc_intelligence.query":
        query_ioc_intelligence,

    "developer_tools.json":
        json_format,

    "developer_tools.yaml":
        yaml_convert,

    "developer_tools.toml":
        toml_convert,

    "developer_tools.regex":
        regex_test,

    "developer_tools.uuid":
        uuid_generate,

    "developer_tools.timestamp":
        timestamp_convert,

    "developer_tools.diff":
        diff_text,

    "network_toolkit.port_check":
        check_port,

    "network_toolkit.traceroute":
        trace_route,

    "network_toolkit.subnet":
        calculate_subnet,

    "network_toolkit.dns":
        dns_explore,

    "network_toolkit.interfaces":
        list_interfaces,

    "network_toolkit.routes":
        list_routes,

    "email_security.inspect":
        inspect_email_security,

    "web_recon.inspect":
        inspect_web_target,

    "cryptography.hmac_create":
        create_hmac,

    "cryptography.hmac_verify":
        verify_hmac,

    "cryptography.pbkdf2":
        derive_pbkdf2,

    "cryptography.random":
        generate_random,

    "cryptography.jwt_decode":
        decode_jwt,

    "cryptography.compare":
        constant_time_compare,

    "system_audit.run":
        run_system_audit,

    "log_analysis.inspect":
        inspect_log_file,

    "file_forensics.inspect":
        inspect_forensic_file,

    "encoding.transform": transform_text,
    "file_analysis.inspect": inspect_file,
    "file_cracker.crack_zip": crack_zip,
    "hash.text": hash_text,
    "hash.file": hash_file,
    "network.dns_lookup": dns_lookup,
    "network.ping": ping_host,
    "osint.rdap_domain": rdap_domain_lookup,
    "threat_intelligence.virustotal_file": virustotal_file_lookup,
    "threat_intelligence.virustotal_file_upload": virustotal_file_upload,
    "threat_intelligence.virustotal_url": virustotal_url_lookup,
    "threat_intelligence.virustotal_url_scan": virustotal_url_scan,
    "secret_scanner.scan_file":
        scan_secret_file,

    "secret_scanner.scan_folder":
        scan_secret_folder,
}


def dispatch(action: str, payload: dict[str, Any]) -> Any:
    handler = ACTIONS.get(action)
    if handler is None:
        raise UnknownActionError(f"A ação Python '{action}' não está registrada.")
    return handler(payload)


def run() -> None:
    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue

        request_id: str | None = None
        try:
            request = parse_request(line)
            request_id = request.request_id
            result = dispatch(request.action, request.payload)
            write_success(request.request_id, result)
        except ZeroHubError as error:
            write_error(request_id, str(error), type(error).__name__)
        except Exception as error:
            traceback.print_exc(file=sys.stderr)
            write_error(
                request_id,
                str(error) or "Erro interno no processo Python.",
                type(error).__name__,
            )


if __name__ == "__main__":
    run()
