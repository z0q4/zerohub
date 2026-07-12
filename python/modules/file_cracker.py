from __future__ import annotations

import argparse
import itertools
import string
import zipfile
from multiprocessing import Pool, cpu_count
from pathlib import Path
from typing import Any, Iterator, Optional, Tuple

from core.errors import InvalidRequestError, ZeroHubError

try:
    import pyzipper  # type: ignore
except ImportError:  # pragma: no cover - depends on the runtime environment
    pyzipper = None


def require_string(payload: dict[str, Any], field: str) -> str:
    value = payload.get(field)
    if not isinstance(value, str):
        raise InvalidRequestError(f"O campo '{field}' precisa ser um texto.")
    return value


def require_bool(payload: dict[str, Any], field: str) -> bool:
    value = payload.get(field)
    if not isinstance(value, bool):
        raise InvalidRequestError(f"O campo '{field}' precisa ser um booleano.")
    return value


def validate_zip_path(path_str: str) -> Path:
    path = Path(path_str).expanduser()
    if not path.exists():
        raise ZeroHubError("O arquivo ZIP selecionado não foi encontrado.")
    if not path.is_file():
        raise InvalidRequestError("O caminho selecionado não representa um arquivo ZIP válido.")
    return path


def iter_candidates(payload: dict[str, Any], charset: str, length: int, wordlist_path: Path | None) -> Iterator[str]:
    if wordlist_path is not None:
        with wordlist_path.open('r', encoding='utf-8', errors='ignore') as handle:
            for line in handle:
                candidate = line.strip()
                if candidate:
                    yield candidate
        return

    for chars in itertools.product(charset, repeat=length):
        yield ''.join(chars)


def try_password(args_tuple: Tuple[str, str]) -> Tuple[str, bool]:
    password, zip_path = args_tuple

    try:
        if pyzipper is not None:
            with pyzipper.AESZipFile(zip_path, 'r') as zf:
                names = zf.namelist()
                if names:
                    zf.read(names[0], pwd=password.encode('utf-8'))
                return password, True

        with zipfile.ZipFile(zip_path, 'r') as zf:
            names = zf.namelist()
            if names:
                zf.read(names[0], pwd=password.encode('utf-8'))
            return password, True
    except Exception:
        return password, False


def crack_zip(payload: dict[str, Any]) -> dict[str, Any]:
    zip_path_str = require_string(payload, 'zipPath')
    mode = require_string(payload, 'mode')
    zip_path = validate_zip_path(zip_path_str)

    if mode not in {'bruteforce', 'wordlist'}:
        raise InvalidRequestError("O modo de ataque precisa ser 'bruteforce' ou 'wordlist'.")

    wordlist_path: Path | None = None
    if mode == 'wordlist':
        wordlist_path_str = require_string(payload, 'wordlistPath')
        wordlist_path = Path(wordlist_path_str).expanduser()
        if not wordlist_path.exists() or not wordlist_path.is_file():
            raise ZeroHubError('A wordlist selecionada não foi encontrada.')

    length = payload.get('length', 4)
    if not isinstance(length, int) or not 1 <= length <= 10:
        raise InvalidRequestError('O tamanho da senha precisa estar entre 1 e 10.')

    use_letters = require_bool(payload, 'useLetters') if 'useLetters' in payload else True
    use_numbers = require_bool(payload, 'useNumbers') if 'useNumbers' in payload else True
    use_special = require_bool(payload, 'useSpecial') if 'useSpecial' in payload else False

    charset = ''
    if use_letters:
        charset += string.ascii_letters
    if use_numbers:
        charset += string.digits
    if use_special:
        charset += string.punctuation

    if not charset and mode == 'bruteforce':
        raise InvalidRequestError('Selecione ao menos um tipo de caractere para o brute force.')

    worker_args = ((candidate, str(zip_path)) for candidate in iter_candidates(payload, charset, length, wordlist_path))
    found_password: Optional[str] = None
    attempts = 0
    max_workers = max(1, min(cpu_count() or 1, 4))

    with Pool(max_workers) as pool:
        for password, success in pool.imap_unordered(try_password, worker_args, chunksize=50):
            attempts += 1
            if success:
                found_password = password
                pool.terminate()
                break

    message = 'Nenhuma senha compatível foi encontrada.'
    if found_password:
        message = 'Senha encontrada com sucesso.'
    elif pyzipper is None:
        message = 'Nenhuma senha compatível foi encontrada. O ambiente Python não possui pyzipper, então a verificação ficou limitada ao formato ZIP padrão.'

    return {
        'zipPath': str(zip_path),
        'mode': mode,
        'found': found_password is not None,
        'password': found_password,
        'attempts': attempts,
        'message': message,
    }


def zipcrack(argus: list) -> None:
    parser = argparse.ArgumentParser(description='Crack password-protected ZIP files')
    parser.add_argument('-w', '--wordlist', dest='wordlist', help='Path to wordlist file', default=None)
    parser.add_argument('-l', '--letters', dest='use_letters', help='Include letters (y/n)', default='n')
    parser.add_argument('-n', '--numbers', dest='use_numbers', help='Include digits (y/n)', default='n')
    parser.add_argument('-sc', '--specialcharacters', dest='use_special', help='Include special characters (y/n)', default='n')
    parser.add_argument('-s', '--size', dest='length', type=int, help='Password length to test (for brute force)')
    parser.add_argument('-p', '--path', dest='zip_path', required=True, help='Path to the target ZIP file')
    parser.add_argument('-m', '--mode', dest='mode', help='Attack mode: bruteforce or wordlist', default='bruteforce')
    args = parser.parse_args(argus)

    payload = {
        'zipPath': args.zip_path,
        'mode': args.mode,
        'wordlistPath': args.wordlist,
        'length': args.length,
        'useLetters': args.use_letters.lower() == 'y',
        'useNumbers': args.use_numbers.lower() == 'y',
        'useSpecial': args.use_special.lower() == 'y',
    }
    result = crack_zip(payload)
    print(result)
