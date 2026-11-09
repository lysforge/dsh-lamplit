#!/usr/bin/env bash
# 把灯下提交到 dsh 市场（awesome-dsh-plugin 精选列表）。
#
# 规则（https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md）：
#   - 只加一个文件：data/plugins/<owner>__<repo>.yml
#   - 仓库需声明 dsh.bundle（本仓库已声明）
#   - 仓库创建需满 1 天
#
# 用法：bash scripts/submit-market.sh
set -euo pipefail

OWNER=lysforge
REPO=dsh-lamplit
UPSTREAM=awesome-dsh-plugin/awesome-dsh-plugin
FILE="data/plugins/${OWNER}__${REPO}.yml"
SRC="$(cd "$(dirname "$0")/.." && pwd)/market/${OWNER}__${REPO}.yml"

command -v gh >/dev/null || { echo "需要 GitHub CLI: https://cli.github.com"; exit 1; }
gh auth status --active >/dev/null

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

gh repo fork "$UPSTREAM" --clone --remote=false "$work/awesome" >/dev/null
cd "$work/awesome"
git checkout -b "add-${OWNER}-${REPO}"
cp "$SRC" "$FILE"
git add "$FILE"
git -c user.name="$OWNER" -c user.email="$(gh api user --jq .email 2>/dev/null || echo "$OWNER@users.noreply.github.com")" \
  commit -m "Add ${OWNER}/${REPO}"
git push -u origin "add-${OWNER}-${REPO}"
gh pr create --repo "$UPSTREAM" \
  --title "Add ${OWNER}/${REPO}" \
  --body "Adds \`${OWNER}/${REPO}\` — 灯下 Lamplit, a reading plugin: one shelf for WeChat Reading, GitHub book repos and your own EPUB/PDF/Markdown, with an immersive reader and AI notes.

Repo: https://github.com/${OWNER}/${REPO}
Declares \`dsh.bundle\` in package.json; ships Host + Client halves (browser UI via slots)."
