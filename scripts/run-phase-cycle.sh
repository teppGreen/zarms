#!/usr/bin/env bash
set -euo pipefail

# Phase4-5向けの最小自律サイクル補助スクリプト
# 使い方: ./scripts/run-phase-cycle.sh frontend|database|all

TARGET="${1:-frontend}"
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

run_deploy() {
  case "$TARGET" in
    frontend)
      npm run deploy:frontend:dev
      ;;
    database)
      npm run deploy:db:dev
      ;;
    all)
      npm run deploy:all:dev
      ;;
    *)
      echo "[ERROR] target must be frontend|database|all"
      exit 1
      ;;
  esac
}

echo "[PhaseCycle] START target=$TARGET"
run_deploy

echo "[PhaseCycle] DONE"
echo "[PhaseCycle] 次の手順: docs/table-coverage-checklist.md を更新し、docs/testing-guide.md に検証結果を追記してください。"
