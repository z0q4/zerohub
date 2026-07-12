from __future__ import annotations

import sys
import traceback
from collections.abc import Callable
from typing import Any

from core.errors import UnknownActionError, ZeroHubError
from core.protocol import parse_request, write_error, write_success
from modules.encoding import transform_text
from modules.file_analysis import inspect_file
from modules.hash_tools import hash_file, hash_text
from modules.network import dns_lookup, ping_host
from modules.osint import rdap_domain_lookup
from modules.threat_intelligence import (
    virustotal_file_lookup,
    virustotal_file_upload,
    virustotal_url_lookup,
    virustotal_url_scan,
)

Handler = Callable[[dict[str, Any]], Any]

ACTIONS: dict[str, Handler] = {
    "encoding.transform": transform_text,
    "file_analysis.inspect": inspect_file,
    "hash.text": hash_text,
    "hash.file": hash_file,
    "network.dns_lookup": dns_lookup,
    "network.ping": ping_host,
    "osint.rdap_domain": rdap_domain_lookup,
    "threat_intelligence.virustotal_file": virustotal_file_lookup,
    "threat_intelligence.virustotal_file_upload": virustotal_file_upload,
    "threat_intelligence.virustotal_url": virustotal_url_lookup,
    "threat_intelligence.virustotal_url_scan": virustotal_url_scan,
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
