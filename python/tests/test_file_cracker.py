import os
import sys
import tempfile
import zipfile

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from modules.file_cracker import zipcrack


def test_zipcrack_wordlist(tmp_path):
    zip_path = tmp_path / 'sample.zip'
    with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr('secret.txt', 'data')

    wordlist_path = tmp_path / 'words.txt'
    wordlist_path.write_text('123456\nsecret\n', encoding='utf-8')

    class DummyLogger:
        def info(self, *args, **kwargs):
            pass

        def error(self, *args, **kwargs):
            pass

        def warning(self, *args, **kwargs):
            pass

    import modules.file_cracker as file_cracker_module
    file_cracker_module.logger = DummyLogger()

    import types
    import pyzipper

    # Create a password-protected zip using pyzipper
    with pyzipper.AESZipFile(zip_path, 'w', compression=pyzipper.ZIP_DEFLATED) as zf:
        zf.setpassword(b'secret')
        zf.writestr('secret.txt', 'data')

    zipcrack(['-p', str(zip_path), '-w', str(wordlist_path), '-m', 'wordlist'])
