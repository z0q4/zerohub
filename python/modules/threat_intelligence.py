from __future__ import annotations

import base64
import hashlib
import json
import socket
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlsplit
from urllib.request import Request, urlopen

from core.errors import InvalidRequestError, ZeroHubError

API = "https://www.virustotal.com/api/v3"
TIMEOUT = 30
MAX_RESPONSE = 8 * 1024 * 1024
UPLOAD_LIMIT = 32 * 1024 * 1024
CHUNK = 1024 * 1024
WAIT_SECONDS = 12


def require_text(payload: dict[str, Any], field: str) -> str:
    value = payload.get(field)
    if not isinstance(value, str):
        raise InvalidRequestError(f"O campo '{field}' precisa ser um texto.")
    return value


def require_key(payload: dict[str, Any]) -> str:
    key = require_text(payload, "apiKey").strip()
    if not key:
        raise InvalidRequestError("Configure uma chave da API do VirusTotal.")
    if len(key) > 512:
        raise InvalidRequestError("A chave da API excede o limite permitido.")
    return key


def as_string(value: Any) -> str | None:
    return value if isinstance(value, str) else None


def as_int(value: Any, default: int = 0) -> int:
    return value if isinstance(value, int) and not isinstance(value, bool) else default


def string_list(value: Any, limit: int = 50) -> list[str]:
    if not isinstance(value, list):
        return []
    output: list[str] = []
    for item in value:
        if isinstance(item, str) and item not in output:
            output.append(item)
        if len(output) >= limit:
            break
    return output


def timestamp(value: Any) -> str | None:
    if not isinstance(value, int) or isinstance(value, bool):
        return None
    try:
        return datetime.fromtimestamp(value, tz=timezone.utc).isoformat()
    except (ValueError, OverflowError, OSError):
        return None


def error_message(error: HTTPError) -> str:
    api_message: str | None = None
    try:
        parsed = json.loads(error.read(262144).decode("utf-8"))
        if isinstance(parsed, dict) and isinstance(parsed.get("error"), dict):
            message = parsed["error"].get("message")
            if isinstance(message, str):
                api_message = message
    except Exception:
        pass

    messages = {
        400: "O VirusTotal rejeitou a solicitação.",
        401: "A chave da API do VirusTotal é inválida.",
        403: "A chave não possui permissão para essa operação.",
        404: "O recurso não foi encontrado no VirusTotal.",
        429: "O limite de requisições do VirusTotal foi atingido. Aguarde e tente novamente.",
    }
    return api_message or messages.get(error.code, f"O VirusTotal respondeu com HTTP {error.code}.")


def request_json(
    method: str,
    url: str,
    api_key: str,
    *,
    body: bytes | None = None,
    content_type: str | None = None,
    allow_not_found: bool = False,
) -> Any | None:
    headers = {
        "Accept": "application/json",
        "x-apikey": api_key,
        "User-Agent": "ZeroHub/0.1.0",
    }
    if content_type:
        headers["Content-Type"] = content_type

    request = Request(url, data=body, method=method, headers=headers)

    try:
        with urlopen(request, timeout=TIMEOUT) as response:
            raw = response.read(MAX_RESPONSE + 1)
            if len(raw) > MAX_RESPONSE:
                raise ZeroHubError("A resposta do VirusTotal excede o limite permitido.")
            try:
                return json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as error:
                raise ZeroHubError("O VirusTotal retornou uma resposta inválida.") from error
    except HTTPError as error:
        if error.code == 404 and allow_not_found:
            return None
        raise ZeroHubError(error_message(error)) from error
    except (URLError, TimeoutError, socket.timeout) as error:
        reason = getattr(error, "reason", error)
        raise ZeroHubError(f"Não foi possível conectar ao VirusTotal: {reason}") from error
    except OSError as error:
        raise ZeroHubError(f"Erro de rede durante a consulta ao VirusTotal: {error}") from error


def normalize_url(raw: str) -> str:
    value = raw.strip()
    if not value:
        raise InvalidRequestError("Informe uma URL.")
    if len(value) > 2048:
        raise InvalidRequestError("A URL excede o limite permitido.")
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise InvalidRequestError("Informe uma URL completa iniciada por http:// ou https://.")
    if parsed.username or parsed.password:
        raise InvalidRequestError("URLs contendo usuário ou senha não são aceitas.")
    return value


def url_id(url: str) -> str:
    return base64.urlsafe_b64encode(url.encode("utf-8")).decode("ascii").rstrip("=")


def prepare_file(raw_path: str) -> tuple[Path, dict[str, Any]]:
    if not raw_path.strip() or len(raw_path) > 4096:
        raise InvalidRequestError("O caminho do arquivo é inválido.")
    path = Path(raw_path).expanduser()
    if not path.is_file():
        raise InvalidRequestError("O caminho selecionado não representa um arquivo.")

    sha256 = hashlib.sha256()
    sha1 = hashlib.sha1()
    md5 = hashlib.md5()
    size = 0
    try:
        with path.open("rb") as file:
            while chunk := file.read(CHUNK):
                size += len(chunk)
                sha256.update(chunk)
                sha1.update(chunk)
                md5.update(chunk)
    except PermissionError as error:
        raise ZeroHubError("O ZeroHub não possui permissão para ler o arquivo.") from error
    except OSError as error:
        raise ZeroHubError(f"Não foi possível ler o arquivo: {error}") from error

    return path, {
        "fileName": path.name,
        "filePath": str(path.resolve()),
        "sizeBytes": size,
        "sha256": sha256.hexdigest(),
        "sha1": sha1.hexdigest(),
        "md5": md5.hexdigest(),
    }


def stats(value: Any) -> dict[str, int]:
    raw = value if isinstance(value, dict) else {}
    return {
        "malicious": as_int(raw.get("malicious")),
        "suspicious": as_int(raw.get("suspicious")),
        "undetected": as_int(raw.get("undetected")),
        "harmless": as_int(raw.get("harmless")),
        "timeout": as_int(raw.get("timeout")),
        "failure": as_int(raw.get("failure")),
        "typeUnsupported": as_int(raw.get("type-unsupported")),
        "confirmedTimeout": as_int(raw.get("confirmed-timeout")),
    }


def engines(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, dict):
        return []
    output: list[dict[str, Any]] = []
    for key, raw in value.items():
        if not isinstance(raw, dict):
            continue
        output.append({
            "engineName": as_string(raw.get("engine_name")) or str(key),
            "category": as_string(raw.get("category")) or "unknown",
            "result": as_string(raw.get("result")),
            "engineVersion": as_string(raw.get("engine_version")),
            "engineUpdate": as_string(raw.get("engine_update")),
        })
    priority = {"malicious": 0, "suspicious": 1, "harmless": 2, "undetected": 3}
    output.sort(key=lambda item: (priority.get(item["category"], 9), item["engineName"].lower()))
    return output


def parse_report(response: Any, target: str) -> dict[str, Any]:
    if not isinstance(response, dict) or not isinstance(response.get("data"), dict):
        raise ZeroHubError("O relatório retornado é inválido.")
    attributes = response["data"].get("attributes")
    if not isinstance(attributes, dict):
        raise ZeroHubError("O relatório não possui atributos válidos.")

    report_stats = stats(attributes.get("last_analysis_stats"))
    verdict = "malicious" if report_stats["malicious"] else (
        "suspicious" if report_stats["suspicious"] else "no-detections"
    )

    return {
        "meaningfulName": as_string(attributes.get("meaningful_name")),
        "title": as_string(attributes.get("title")),
        "typeDescription": as_string(attributes.get("type_description")),
        "typeExtension": as_string(attributes.get("type_extension")),
        "sizeBytes": as_int(attributes.get("size")),
        "reputation": as_int(attributes.get("reputation")),
        "timesSubmitted": as_int(attributes.get("times_submitted")),
        "firstSubmissionAt": timestamp(attributes.get("first_submission_date")),
        "lastSubmissionAt": timestamp(attributes.get("last_submission_date")),
        "lastAnalysisAt": timestamp(attributes.get("last_analysis_date")),
        "lastFinalUrl": as_string(attributes.get("last_final_url")),
        "httpResponseCode": as_int(attributes.get("last_http_response_code")) if target == "url" else None,
        "tags": string_list(attributes.get("tags")),
        "names": string_list(attributes.get("names"), 20),
        "stats": report_stats,
        "totalEngines": sum(report_stats.values()),
        "detectedEngines": report_stats["malicious"] + report_stats["suspicious"],
        "verdict": verdict,
        "engines": engines(attributes.get("last_analysis_results")),
    }


def make_result(
    target: str,
    state: str,
    display_name: str,
    identifier: str,
    report_url: str,
    message: str,
    *,
    local_file: dict[str, Any] | None = None,
    submitted_url: str | None = None,
    report: dict[str, Any] | None = None,
    analysis_id: str | None = None,
) -> dict[str, Any]:
    return {
        "targetType": target,
        "state": state,
        "displayName": display_name,
        "identifier": identifier,
        "reportUrl": report_url,
        "analysisId": analysis_id,
        "message": message,
        "localFile": local_file,
        "submittedUrl": submitted_url,
        "report": report,
    }


def file_report(sha256: str, key: str) -> dict[str, Any] | None:
    response = request_json("GET", f"{API}/files/{quote(sha256, safe='')}", key, allow_not_found=True)
    return None if response is None else parse_report(response, "file")


def url_report(url: str, key: str) -> dict[str, Any] | None:
    identifier = url_id(url)
    response = request_json("GET", f"{API}/urls/{quote(identifier, safe='')}", key, allow_not_found=True)
    return None if response is None else parse_report(response, "url")


def analysis_id(response: Any) -> str:
    if not isinstance(response, dict) or not isinstance(response.get("data"), dict):
        raise ZeroHubError("O VirusTotal não retornou um ID de análise.")
    value = response["data"].get("id")
    if not isinstance(value, str) or not value:
        raise ZeroHubError("O VirusTotal não retornou um ID de análise válido.")
    return value


def completed(identifier: str, key: str) -> bool:
    response = request_json("GET", f"{API}/analyses/{quote(identifier, safe='')}", key)
    if not isinstance(response, dict) or not isinstance(response.get("data"), dict):
        return False
    attributes = response["data"].get("attributes")
    return isinstance(attributes, dict) and attributes.get("status") == "completed"


def check_later(identifier: str, key: str) -> bool:
    time.sleep(WAIT_SECONDS)
    try:
        return completed(identifier, key)
    except ZeroHubError:
        return False


def multipart(path: Path) -> tuple[bytes, str]:
    boundary = "----ZeroHub" + uuid.uuid4().hex
    filename = path.name.replace('"', "_").replace("\r", "_").replace("\n", "_")
    prefix = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        "Content-Type: application/octet-stream\r\n\r\n"
    ).encode("utf-8")
    suffix = f"\r\n--{boundary}--\r\n".encode("ascii")
    try:
        body = prefix + path.read_bytes() + suffix
    except OSError as error:
        raise ZeroHubError(f"Não foi possível preparar o arquivo para envio: {error}") from error
    return body, f"multipart/form-data; boundary={boundary}"


def virustotal_file_lookup(payload: dict[str, Any]) -> dict[str, Any]:
    key = require_key(payload)
    _, local = prepare_file(require_text(payload, "filePath"))
    report = file_report(local["sha256"], key)
    report_url = "https://www.virustotal.com/gui/file/" + local["sha256"]
    if report is None:
        return make_result("file", "missing", local["fileName"], local["sha256"], report_url,
                           "O arquivo ainda não possui relatório. Você pode enviá-lo manualmente.",
                           local_file=local)
    return make_result("file", "found", local["fileName"], local["sha256"], report_url,
                       "Relatório encontrado no VirusTotal.", local_file=local, report=report)


def virustotal_file_upload(payload: dict[str, Any]) -> dict[str, Any]:
    key = require_key(payload)
    path, local = prepare_file(require_text(payload, "filePath"))
    report_url = "https://www.virustotal.com/gui/file/" + local["sha256"]
    existing = file_report(local["sha256"], key)
    if existing is not None:
        return make_result("file", "found", local["fileName"], local["sha256"], report_url,
                           "O arquivo já possuía relatório.", local_file=local, report=existing)
    if local["sizeBytes"] > UPLOAD_LIMIT:
        raise ZeroHubError("O upload direto desta versão aceita arquivos de até 32 MB.")

    body, content_type = multipart(path)
    response = request_json("POST", f"{API}/files", key, body=body, content_type=content_type)
    identifier = analysis_id(response)
    if check_later(identifier, key):
        report = file_report(local["sha256"], key)
        if report is not None:
            return make_result("file", "found", local["fileName"], local["sha256"], report_url,
                               "Upload concluído e relatório carregado.", local_file=local,
                               report=report, analysis_id=identifier)
    return make_result("file", "processing", local["fileName"], local["sha256"], report_url,
                       "O arquivo foi enviado e está sendo analisado. Atualize em alguns instantes.",
                       local_file=local, analysis_id=identifier)


def virustotal_url_lookup(payload: dict[str, Any]) -> dict[str, Any]:
    key = require_key(payload)
    url = normalize_url(require_text(payload, "url"))
    identifier = url_id(url)
    report_url = "https://www.virustotal.com/gui/url/" + identifier
    report = url_report(url, key)
    if report is None:
        return make_result("url", "missing", url, identifier, report_url,
                           "A URL ainda não possui relatório. Você pode enviá-la para análise.",
                           submitted_url=url)
    return make_result("url", "found", url, identifier, report_url,
                       "Relatório da URL encontrado.", submitted_url=url, report=report)


def virustotal_url_scan(payload: dict[str, Any]) -> dict[str, Any]:
    key = require_key(payload)
    url = normalize_url(require_text(payload, "url"))
    identifier = url_id(url)
    report_url = "https://www.virustotal.com/gui/url/" + identifier
    body = urlencode({"url": url}).encode("utf-8")
    response = request_json("POST", f"{API}/urls", key, body=body,
                            content_type="application/x-www-form-urlencoded")
    analysis = analysis_id(response)
    if check_later(analysis, key):
        report = url_report(url, key)
        if report is not None:
            return make_result("url", "found", url, identifier, report_url,
                               "Análise concluída e relatório carregado.", submitted_url=url,
                               report=report, analysis_id=analysis)
    return make_result("url", "processing", url, identifier, report_url,
                       "A URL foi enviada e está sendo analisada. Atualize em alguns instantes.",
                       submitted_url=url, analysis_id=analysis)
