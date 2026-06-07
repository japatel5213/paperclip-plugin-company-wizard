#!/usr/bin/env bash
#
# install.sh — Build & install the TEC multi-provider Company Wizard into Paperclip.
#
# Run this from the root of the cloned repo:
#   bash install.sh
#
# It will:
#   1. Install dependencies (pnpm)
#   2. Build the plugin (dist/)
#   3. Copy the built plugin into Paperclip's plugin node_modules
#   4. Restart the Paperclip tmux session
#
# Override defaults with env vars, e.g.:
#   PAPERCLIP_TMUX=paperclip PAPERCLIP_RUN_CMD="npx paperclipai run" bash install.sh
#
set -euo pipefail

# ── Config (override via env) ────────────────────────────────────────────────
PKG_NAME="@yesterday-ai/paperclip-plugin-company-wizard"   # dir Paperclip already loads
PLUGIN_ROOT="${PLUGIN_ROOT:-$HOME/.paperclip/plugins/node_modules}"
TARGET_DIR="$PLUGIN_ROOT/$PKG_NAME"
PAPERCLIP_TMUX="${PAPERCLIP_TMUX:-paperclip}"
PAPERCLIP_RUN_CMD="${PAPERCLIP_RUN_CMD:-npx paperclipai run}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "▶ Repo:        $REPO_DIR"
echo "▶ Target:      $TARGET_DIR"
echo "▶ tmux sess:   $PAPERCLIP_TMUX"
echo ""

# ── 1. Install deps ──────────────────────────────────────────────────────────
echo "▶ Installing dependencies..."
cd "$REPO_DIR"
if ! command -v pnpm >/dev/null 2>&1; then
  echo "  pnpm not found — installing globally via npm..."
  npm install -g pnpm
fi
pnpm install --no-frozen-lockfile

# Approve esbuild's build script non-interactively (needed by newer pnpm).
pnpm rebuild esbuild >/dev/null 2>&1 || true

# ── 2. Build (call esbuild directly to avoid pnpm deps-status precheck) ───────
echo "▶ Building plugin..."
node ./esbuild.config.mjs

if [[ ! -f dist/worker.js || ! -f dist/manifest.js || ! -d dist/ui ]]; then
  echo "✗ Build did not produce expected dist/ output. Aborting."
  exit 1
fi
echo "  ✓ Build OK (dist/worker.js, dist/manifest.js, dist/ui/)"

# ── 3. Install into Paperclip ────────────────────────────────────────────────
if [[ ! -d "$TARGET_DIR" ]]; then
  echo "✗ Plugin target not found: $TARGET_DIR"
  echo "  Install the original plugin once from the Paperclip UI first, then re-run."
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
echo "▶ Backing up current plugin → ${TARGET_DIR}.bak-${STAMP}"
cp -a "$TARGET_DIR" "${TARGET_DIR}.bak-${STAMP}"

echo "▶ Copying built files into Paperclip..."
# Replace dist + templates + manifest-relevant files; keep node_modules of the target intact.
rm -rf "$TARGET_DIR/dist"
cp -a "$REPO_DIR/dist"        "$TARGET_DIR/dist"
cp -a "$REPO_DIR/templates"  "$TARGET_DIR/templates"
cp -a "$REPO_DIR/package.json" "$TARGET_DIR/package.json"
[[ -d "$REPO_DIR/public" ]] && cp -a "$REPO_DIR/public" "$TARGET_DIR/public"
echo "  ✓ Installed"

# ── 4. Restart Paperclip tmux session ────────────────────────────────────────
if tmux has-session -t "$PAPERCLIP_TMUX" 2>/dev/null; then
  echo "▶ Restarting Paperclip in tmux session '$PAPERCLIP_TMUX'..."
  tmux send-keys -t "$PAPERCLIP_TMUX" C-c
  sleep 3
  tmux send-keys -t "$PAPERCLIP_TMUX" "$PAPERCLIP_RUN_CMD" Enter
  echo "  ✓ Sent restart command"
else
  echo "⚠ tmux session '$PAPERCLIP_TMUX' not found — restart Paperclip manually."
fi

echo ""
echo "✅ Done. Now configure the provider in:"
echo "   Paperclip → Settings → Plugins → Company Wizard"
echo ""
echo "   Set aiProvider to one of: anthropic | gemini | openai | opencode"
echo "   and fill in the matching key/URL. See README.md → 'AI Providers'."
echo ""
echo "   Rollback if needed:"
echo "     rm -rf \"$TARGET_DIR\" && mv \"${TARGET_DIR}.bak-${STAMP}\" \"$TARGET_DIR\""
