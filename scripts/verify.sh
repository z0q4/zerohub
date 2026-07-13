#!/usr/bin/env bash

set -euo pipefail

readonly REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${REPOSITORY_ROOT}"

echo '==> TypeScript check'
npm run check

echo '==> ESLint'
npm run lint

if [[ -x "${REPOSITORY_ROOT}/.venv/bin/python" ]]; then
  readonly PYTHON="${REPOSITORY_ROOT}/.venv/bin/python"
else
  readonly PYTHON="python3"
fi

echo '==> Python source compilation'
"${PYTHON}" -m compileall -q "${REPOSITORY_ROOT}/python"

echo '==> Python tests'
PYTHONPATH="${REPOSITORY_ROOT}/python" \
  "${PYTHON}" -m pytest "${REPOSITORY_ROOT}/python/tests" -q

echo '==> Git whitespace check'
git diff --check

echo '==> All validations passed'
