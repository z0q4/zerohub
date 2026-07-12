from __future__ import annotations

import hashlib
import math
import os
import re
import time
from pathlib import Path
from typing import Any

from core.errors import InvalidRequestError, ZeroHubError

MAX_FILE_BYTES = 2 * 1024 * 1024
MAX_TOTAL_BYTES = 250 * 1024 * 1024
MAX_FILES = 5000
MAX_FINDINGS = 1000

IGNORED_DIRS = {
    ".git", ".hg", ".svn", ".next", ".nuxt", ".cache",
    ".pytest_cache", ".mypy_cache", ".ruff_cache", ".tox",
    ".zerohub-backups", "__pycache__", "build", "coverage",
    "dist", "node_modules", "out", "target", "vendor", "venv", ".venv",
}

BINARY_EXTENSIONS = {
    ".7z", ".a", ".avi", ".bin", ".bmp", ".class", ".db", ".deb",
    ".dll", ".dylib", ".exe", ".flac", ".gif", ".gz", ".ico", ".iso",
    ".jar", ".jpeg", ".jpg", ".mkv", ".mov", ".mp3", ".mp4", ".o",
    ".ogg", ".otf", ".pdf", ".png", ".pyc", ".rar", ".so", ".sqlite",
    ".sqlite3", ".tar", ".ttf", ".wav", ".webm", ".webp", ".woff",
    ".woff2", ".xz", ".zip",
}

PLACEHOLDERS = (
    "changeme", "dummy", "example", "fake", "placeholder", "replace_me",
    "sample", "your_api", "your_key", "your_secret", "${", "process.env",
    "import.meta.env", "<secret", "<token",
)

SEVERITY_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3}
DOWNGRADE = {"critical": "high", "high": "medium", "medium": "low", "low": "low"}

RULES = (
    (
        "private-key", "Private Key", "critical",
        re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----"),
        0,
        "Chave privada encontrada.",
        "Revogue a chave, gere outra e remova-a do histórico do repositório.",
    ),
    (
        "aws-access-key", "AWS Access Key", "critical",
        re.compile(r"\b(?:AKIA|ASIA)[A-Z0-9]{16}\b"), 0,
        "Identificador de credencial AWS encontrado.",
        "Desative a credencial no IAM e faça a rotação.",
    ),
    (
        "github-token", "GitHub Token", "critical",
        re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{36,255}|github_pat_[A-Za-z0-9_]{40,255})\b"), 0,
        "Token do GitHub encontrado.",
        "Revogue o token e remova-o do histórico Git.",
    ),
    (
        "google-api-key", "Google API Key", "high",
        re.compile(r"\bAIza[0-9A-Za-z_-]{35}\b"), 0,
        "Chave da API do Google encontrada.",
        "Restrinja ou revogue a chave e armazene-a fora do código.",
    ),
    (
        "slack-token", "Slack Token", "critical",
        re.compile(r"\bxox[baprs]-[0-9A-Za-z-]{10,250}\b"), 0,
        "Token do Slack encontrado.",
        "Revogue o token e gere uma nova credencial.",
    ),
    (
        "stripe-key", "Stripe Live Key", "critical",
        re.compile(r"\b(?:sk|rk)_live_[0-9A-Za-z]{16,}\b"), 0,
        "Chave ativa da Stripe encontrada.",
        "Faça a rotação da chave no painel da Stripe.",
    ),
    (
        "jwt", "JWT", "high",
        re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b"), 0,
        "JSON Web Token encontrado em texto.",
        "Invalide o token e não o armazene diretamente no projeto.",
    ),
    (
        "bearer-token", "Bearer Token", "high",
        re.compile(r"(?i)\bBearer\s+([A-Za-z0-9._~+/=-]{16,})"), 1,
        "Token Bearer encontrado.",
        "Revogue o token e use um cofre de segredos.",
    ),
    (
        "database-url", "Database Credential", "critical",
        re.compile(r"(?i)\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp|mssql)://[^:\s/@]+:([^@\s/]{3,})@"), 1,
        "Senha incorporada em URL de banco encontrada.",
        "Troque a senha e remova credenciais da URL versionada.",
    ),
)

GENERIC = re.compile(
    r'''(?ix)\b(api[_-]?key|access[_-]?key|auth[_-]?token|client[_-]?secret|'''
    r'''private[_-]?key|secret[_-]?key|secret|token|password|passwd|pwd)\b'''
    r'''\s*[:=]\s*["']?([^\s"'`,;#]{8,})'''
)

QUOTED = re.compile(r'''["']([A-Za-z0-9_./+=:@-]{28,160})["']''')


def require_string(payload: dict[str, Any], field: str) -> str:
    value = payload.get(field)
    if not isinstance(value, str):
        raise InvalidRequestError(f"O campo '{field}' precisa ser um texto.")
    return value


def is_placeholder(value: str) -> bool:
    normalized = value.strip().lower()
    return (
        not normalized
        or normalized in {"null", "none", "undefined", "true", "false"}
        or any(marker in normalized for marker in PLACEHOLDERS)
        or len(set(normalized)) <= 2
    )


def entropy(value: str) -> float:
    if not value:
        return 0.0
    counts: dict[str, int] = {}
    for char in value:
        counts[char] = counts.get(char, 0) + 1
    return -sum((count / len(value)) * math.log2(count / len(value)) for count in counts.values())


def high_entropy(value: str) -> bool:
    if is_placeholder(value) or "://" in value or len(value) > 160:
        return False
    if len(value) in {32, 40, 64, 96, 128} and re.fullmatch(r"[0-9a-fA-F]+", value):
        return False
    classes = sum((
        any(c.islower() for c in value),
        any(c.isupper() for c in value),
        any(c.isdigit() for c in value),
        any(not c.isalnum() for c in value),
    ))
    return classes >= 3 and entropy(value) >= 4.2


def mask(value: str) -> str:
    if "PRIVATE KEY" in value:
        return "[PRIVATE KEY BLOCK]"
    if len(value) <= 8:
        return "•" * len(value)
    if len(value) <= 16:
        return value[:2] + "•" * (len(value) - 4) + value[-2:]
    return value[:4] + "•" * min(max(len(value) - 8, 8), 32) + value[-4:]


def fingerprint(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8", errors="replace")).hexdigest()[:12]


def is_example(path: Path) -> bool:
    parts = {part.lower() for part in path.parts}
    name = path.name.lower()
    return bool(parts & {"docs", "examples", "fixtures", "samples", "tests"}) or name.startswith("readme") or any(x in name for x in (".example", ".sample", ".template", ".dist"))


def make_finding(
    path: Path,
    root: Path,
    line_number: int,
    column: int,
    rule_id: str,
    category: str,
    severity: str,
    secret: str,
    line: str,
    description: str,
    remediation: str,
) -> dict[str, Any]:
    example = is_example(path)
    severity = DOWNGRADE[severity] if example else severity
    secret_fp = fingerprint(secret)
    try:
        relative_path = str(path.relative_to(root))
    except ValueError:
        relative_path = path.name
    redacted = line.replace(secret, mask(secret)).strip()
    if len(redacted) > 220:
        redacted = redacted[:217] + "..."
    finding_key = f"{path}:{line_number}:{rule_id}:{secret_fp}"
    return {
        "id": hashlib.sha256(finding_key.encode()).hexdigest()[:16],
        "ruleId": rule_id,
        "category": category,
        "severity": severity,
        "filePath": str(path),
        "relativePath": relative_path,
        "line": line_number,
        "column": column,
        "maskedValue": mask(secret),
        "fingerprint": secret_fp,
        "redactedContext": redacted,
        "description": description,
        "remediation": remediation,
        "exampleOrTestFile": example,
    }


def decode_text(raw: bytes) -> str | None:
    if not raw:
        return ""
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        try:
            return raw.decode("utf-16")
        except UnicodeDecodeError:
            return None
    if b"\x00" in raw[:8192]:
        return None
    try:
        return raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")
        sample = text[:8192]
        printable = sum(c.isprintable() or c in "\r\n\t" for c in sample)
        return text if not sample or printable / len(sample) >= 0.85 else None


def scan_one(path: Path, root: Path, finding_limit: int) -> tuple[list[dict[str, Any]], int, str | None]:
    try:
        size = path.stat().st_size
    except OSError as error:
        return [], 0, str(error)
    if size > MAX_FILE_BYTES:
        return [], 0, "Arquivo excede 2 MB."
    if path.suffix.lower() in BINARY_EXTENSIONS:
        return [], 0, "Extensão binária ignorada."
    try:
        raw = path.read_bytes()
    except PermissionError:
        return [], 0, "Sem permissão de leitura."
    except OSError as error:
        return [], 0, str(error)
    text = decode_text(raw)
    if text is None:
        return [], len(raw), "Arquivo binário ignorado."

    findings: list[dict[str, Any]] = []
    dedupe: set[tuple[int, str]] = set()
    name = path.name.lower()

    if (name == ".env" or name.startswith(".env.") or name.endswith(".env")) and not is_example(path):
        secret_fp = fingerprint(str(path))
        findings.append({
            "id": hashlib.sha256(f"{path}:env".encode()).hexdigest()[:16],
            "ruleId": "environment-file",
            "category": "Environment File",
            "severity": "medium",
            "filePath": str(path),
            "relativePath": str(path.relative_to(root)) if path != root else path.name,
            "line": 1,
            "column": 1,
            "maskedValue": path.name,
            "fingerprint": secret_fp,
            "redactedContext": "Arquivo de ambiente presente no projeto.",
            "description": "Arquivo de ambiente encontrado; ele pode conter configurações privadas.",
            "remediation": "Confirme que está no .gitignore e que nunca foi versionado.",
            "exampleOrTestFile": False,
        })

    for line_number, line in enumerate(text.splitlines(), start=1):
        if len(findings) >= finding_limit:
            break
        for rule_id, category, severity, pattern, group, description, remediation in RULES:
            for match in pattern.finditer(line):
                secret = match.group(group)
                if not secret or is_placeholder(secret):
                    continue
                key = (line_number, fingerprint(secret))
                if key in dedupe:
                    continue
                dedupe.add(key)
                findings.append(make_finding(
                    path, root, line_number, match.start(group) + 1,
                    rule_id, category, severity, secret, line, description, remediation,
                ))
                if len(findings) >= finding_limit:
                    break
            if len(findings) >= finding_limit:
                break
        if len(findings) >= finding_limit:
            break

        match = GENERIC.search(line)
        if match:
            variable = match.group(1).lower()
            secret = match.group(2)
            key = (line_number, fingerprint(secret))
            if key not in dedupe and not is_placeholder(secret):
                dedupe.add(key)
                severity = "critical" if any(x in variable for x in ("password", "passwd", "pwd", "private", "client_secret")) else "high"
                findings.append(make_finding(
                    path, root, line_number, match.start(2) + 1,
                    "generic-secret", "Generic Secret", severity, secret, line,
                    f"Valor sensível atribuído a '{variable}'.",
                    "Remova o valor do código e use variável de ambiente ou cofre de segredos.",
                ))

        if len(findings) >= finding_limit:
            break

        for match in QUOTED.finditer(line):
            secret = match.group(1)
            key = (line_number, fingerprint(secret))
            if key in dedupe or not high_entropy(secret):
                continue
            dedupe.add(key)
            findings.append(make_finding(
                path, root, line_number, match.start(1) + 1,
                "high-entropy-string", "High-Entropy String", "medium", secret, line,
                "String de alta entropia encontrada; ela pode representar um token ou chave.",
                "Confirme a finalidade e remova o valor caso seja uma credencial.",
            ))
            if len(findings) >= finding_limit:
                break

    return findings, len(raw), None


def finish(target_type: str, target: Path, findings: list[dict[str, Any]], scanned: int, skipped: int, total_bytes: int, started: float, truncated: bool, reasons: dict[str, int]) -> dict[str, Any]:
    findings.sort(key=lambda item: (SEVERITY_RANK.get(item["severity"], 9), item["relativePath"].lower(), item["line"]))
    summary = {"critical": 0, "high": 0, "medium": 0, "low": 0, "total": len(findings)}
    for item in findings:
        summary[item["severity"]] += 1
    return {
        "targetType": target_type,
        "targetPath": str(target.resolve()),
        "scannedFiles": scanned,
        "skippedFiles": skipped,
        "totalBytes": total_bytes,
        "durationMs": round((time.perf_counter() - started) * 1000, 2),
        "truncated": truncated,
        "limits": {
            "maxFiles": MAX_FILES,
            "maxFindings": MAX_FINDINGS,
            "maxFileBytes": MAX_FILE_BYTES,
            "maxTotalBytes": MAX_TOTAL_BYTES,
        },
        "ignoredDirectories": sorted(IGNORED_DIRS),
        "skipReasons": reasons,
        "summary": summary,
        "findings": findings,
    }


def scan_file(payload: dict[str, Any]) -> dict[str, Any]:
    raw_path = require_string(payload, "filePath").strip()
    if not raw_path:
        raise InvalidRequestError("O caminho do arquivo está vazio.")
    try:
        path = Path(raw_path).expanduser().resolve(strict=True)
    except FileNotFoundError as error:
        raise ZeroHubError("O arquivo selecionado não foi encontrado.") from error
    if not path.is_file():
        raise InvalidRequestError("O caminho selecionado não representa um arquivo.")
    started = time.perf_counter()
    findings, read_bytes, reason = scan_one(path, path.parent, MAX_FINDINGS)
    reasons = {reason: 1} if reason else {}
    return finish("file", path, findings, 0 if reason else 1, 1 if reason else 0, read_bytes, started, False, reasons)


def scan_folder(payload: dict[str, Any]) -> dict[str, Any]:
    raw_path = require_string(payload, "folderPath").strip()
    if not raw_path:
        raise InvalidRequestError("O caminho da pasta está vazio.")
    try:
        root = Path(raw_path).expanduser().resolve(strict=True)
    except FileNotFoundError as error:
        raise ZeroHubError("A pasta selecionada não foi encontrada.") from error
    if not root.is_dir():
        raise InvalidRequestError("O caminho selecionado não representa uma pasta.")

    started = time.perf_counter()
    findings: list[dict[str, Any]] = []
    scanned = skipped = total_bytes = 0
    truncated = False
    reasons: dict[str, int] = {}

    for current_root, directories, files in os.walk(root, followlinks=False):
        directories[:] = [
            directory for directory in directories
            if directory not in IGNORED_DIRS and not Path(current_root, directory).is_symlink()
        ]
        for file_name in files:
            if scanned + skipped >= MAX_FILES or total_bytes >= MAX_TOTAL_BYTES or len(findings) >= MAX_FINDINGS:
                truncated = True
                break
            path = Path(current_root, file_name)
            if path.is_symlink():
                skipped += 1
                reasons["Link simbólico ignorado."] = reasons.get("Link simbólico ignorado.", 0) + 1
                continue
            file_findings, read_bytes, reason = scan_one(path, root, MAX_FINDINGS - len(findings))
            total_bytes += read_bytes
            if reason:
                skipped += 1
                reasons[reason] = reasons.get(reason, 0) + 1
            else:
                scanned += 1
                findings.extend(file_findings)
        if truncated:
            break

    return finish("folder", root, findings, scanned, skipped, total_bytes, started, truncated, reasons)
