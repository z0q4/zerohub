from __future__ import annotations

import os
import sys
from pathlib import Path

import pyzipper

sys.path.insert(
    0,
    os.path.abspath(
        os.path.join(
            os.path.dirname(__file__),
            "..",
        )
    ),
)

from modules.file_cracker import crack_zip


def test_crack_zip_finds_aes_password_from_wordlist(
    tmp_path: Path,
) -> None:
    zip_path = tmp_path / "sample.zip"

    with pyzipper.AESZipFile(
        zip_path,
        "w",
        compression=pyzipper.ZIP_DEFLATED,
        encryption=pyzipper.WZ_AES,
    ) as archive:
        archive.setpassword(b"secret")
        archive.writestr(
            "secret.txt",
            "ZeroHub test data",
        )

    wordlist_path = tmp_path / "words.txt"
    wordlist_path.write_text(
        "incorrect\nsecret\n",
        encoding="utf-8",
    )

    result = crack_zip(
        {
            "zipPath": str(zip_path),
            "mode": "wordlist",
            "wordlistPath": str(wordlist_path),
        }
    )

    assert result["found"] is True
    assert result["password"] == "secret"
    assert result["attempts"] >= 1
    assert result["zipPath"] == str(zip_path)
