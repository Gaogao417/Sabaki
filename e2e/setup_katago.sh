#!/usr/bin/env bash
set -euo pipefail

# KataGo + Sabaki Setup Script
# Downloads KataGo engine, neural network model, and configures Sabaki.
# Supports: macOS (arm64/x86_64), Linux (x86_64), Windows (Git Bash/MSYS2)

KATAGO_VERSION="v1.16.4"
KATAGO_VERSION_NUM="1.16.4"
MODEL_NAME="kata1-b18c384nbt-s9996604416-d4316597426"
MODEL_URL="https://media.katagotraining.org/uploaded/networks/models/kata1/${MODEL_NAME}.bin.gz"
GITHUB_BASE="https://github.com/lightvector/KataGo/releases/download/${KATAGO_VERSION}"

# ── Colors ───────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Detect platform ──────────────────────────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin)
    PLATFORM="macos"
    SABAKI_SETTINGS="$HOME/Library/Application Support/Sabaki/settings.json"
    ;;
  Linux)
    PLATFORM="linux"
    SABAKI_SETTINGS="$HOME/.config/Sabaki/settings.json"
    ;;
  MINGW*|MSYS*|CYGWIN*)
    PLATFORM="windows"
    SABAKI_SETTINGS="$(cygpath "$APPDATA")/Sabaki/settings.json"
    ;;
  *)
    error "Unsupported OS: $OS"
    ;;
esac

info "Detected: $PLATFORM ($ARCH)"

# ── Data directory ───────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="${KATAGO_DATA_DIR:-$REPO_ROOT/katago_data}"
mkdir -p "$DATA_DIR"

info "Data directory: $DATA_DIR"

# ── Step 1: KataGo engine ────────────────────────────────────────────
KATAGO_BIN=""

if [ "$PLATFORM" = "macos" ]; then
  # macOS: prefer homebrew, fallback to checking PATH
  if command -v katago &>/dev/null; then
    KATAGO_BIN="$(command -v katago)"
    info "Found KataGo: $KATAGO_BIN"
  elif command -v brew &>/dev/null; then
    info "Installing KataGo via Homebrew..."
    brew install katago
    KATAGO_BIN="$(command -v katago)"
  else
    error "KataGo not found. Install Homebrew (brew.sh) then run: brew install katago"
  fi

elif [ "$PLATFORM" = "linux" ]; then
  KATAGO_EXE="$DATA_DIR/katago"
  if [ -x "$KATAGO_EXE" ]; then
    KATAGO_BIN="$KATAGO_EXE"
    info "Found existing KataGo: $KATAGO_BIN"
  else
    ZIP_NAME="katago-${KATAGO_VERSION}-eigenavx2-linux-x64.zip"
    ZIP_URL="${GITHUB_BASE}/${ZIP_NAME}"
    ZIP_PATH="$DATA_DIR/$ZIP_NAME"

    info "Downloading KataGo ${KATAGO_VERSION} (Eigen AVX2) for Linux..."
    curl -fSL -o "$ZIP_PATH" "$ZIP_URL"

    info "Extracting..."
    unzip -o -q "$ZIP_PATH" -d "$DATA_DIR"
    # Find the katago binary inside the extracted directory
    EXTRACTED_BIN="$(find "$DATA_DIR" -name "katago" -type f | head -1)"
    if [ -n "$EXTRACTED_BIN" ]; then
      mv "$EXTRACTED_BIN" "$KATAGO_EXE"
      chmod +x "$KATAGO_EXE"
      # Clean up extracted directory
      find "$DATA_DIR" -maxdepth 1 -name "katago-*" -type d -exec rm -rf {} +
    fi
    rm -f "$ZIP_PATH"
    KATAGO_BIN="$KATAGO_EXE"
    info "KataGo installed: $KATAGO_BIN"
  fi

elif [ "$PLATFORM" = "windows" ]; then
  KATAGO_EXE="$DATA_DIR/katago.exe"
  if [ -x "$KATAGO_EXE" ] || [ -f "$KATAGO_EXE" ]; then
    KATAGO_BIN="$KATAGO_EXE"
    info "Found existing KataGo: $KATAGO_BIN"
  else
    ZIP_NAME="katago-${KATAGO_VERSION}-eigenavx2-windows-x64.zip"
    ZIP_URL="${GITHUB_BASE}/${ZIP_NAME}"
    ZIP_PATH="$DATA_DIR/$ZIP_NAME"

    info "Downloading KataGo ${KATAGO_VERSION} (Eigen AVX2) for Windows..."
    curl -fSL -o "$ZIP_PATH" "$ZIP_URL"

    info "Extracting..."
    unzip -o -q "$ZIP_PATH" -d "$DATA_DIR"
    EXTRACTED_BIN="$(find "$DATA_DIR" -name "katago.exe" -type f | head -1)"
    if [ -n "$EXTRACTED_BIN" ]; then
      mv "$EXTRACTED_BIN" "$KATAGO_EXE"
      find "$DATA_DIR" -maxdepth 1 -name "katago-*" -type d -exec rm -rf {} +
    fi
    rm -f "$ZIP_PATH"
    KATAGO_BIN="$KATAGO_EXE"
    info "KataGo installed: $KATAGO_BIN"
  fi
fi

# ── Step 2: Download model ───────────────────────────────────────────
MODEL_PATH="$DATA_DIR/${MODEL_NAME}.bin.gz"

if [ -f "$MODEL_PATH" ]; then
  info "Model already exists: $MODEL_PATH"
else
  info "Downloading KataGo b18c384nbt model (~45MB)..."
  curl -fSL -o "$MODEL_PATH" "$MODEL_URL"
  info "Model downloaded: $MODEL_PATH"
fi

# ── Step 3: Write config ─────────────────────────────────────────────
CONFIG_PATH="$DATA_DIR/gtp.cfg"

cat > "$CONFIG_PATH" << 'EOF'
numSearchThreads = 4
maxVisits = 500
reportAnalysisWinratesAs = BLACK
EOF

info "Config written: $CONFIG_PATH"

# ── Step 4: Update Sabaki settings ───────────────────────────────────
# Use forward slashes for JSON compatibility
MODEL_PATH_JSON="${MODEL_PATH//\\//}"
CONFIG_PATH_JSON="${CONFIG_PATH//\\//}"
KATAGO_BIN_JSON="${KATAGO_BIN//\\//}"

ENGINE_NAME="KataGo b18c384"

if [ -f "$SABAKI_SETTINGS" ]; then
  # Read existing settings, update engines.list
  SETTINGS=$(python3 -c "
import json, sys

with open(sys.argv[1], 'r') as f:
    settings = json.load(f)

# Check if engine already exists
engines = settings.get('engines.list', [])
for e in engines:
    if '$KATAGO_BIN_JSON' in e.get('path', ''):
        print('EXISTS')
        sys.exit(0)

# Add new engine at index 0
new_engine = {
    'name': '$ENGINE_NAME',
    'path': '$KATAGO_BIN_JSON',
    'args': 'gtp -model $MODEL_PATH_JSON -config $CONFIG_PATH_JSON'
}
engines.insert(0, new_engine)
settings['engines.list'] = engines

with open(sys.argv[1], 'w') as f:
    json.dump(settings, f, indent=2, ensure_ascii=False)

print('UPDATED')
" "$SABAKI_SETTINGS" 2>/dev/null)

  if [ "$SETTINGS" = "EXISTS" ]; then
    info "Engine already configured in Sabaki."
  elif [ "$SETTINGS" = "UPDATED" ]; then
    info "Sabaki settings updated: $SABAKI_SETTINGS"
  else
    warn "Could not update Sabaki settings automatically."
    echo ""
    echo "Add this engine manually in Sabaki Preferences:"
    echo "  Name: $ENGINE_NAME"
    echo "  Path: $KATAGO_BIN"
    echo "  Args: gtp -model $MODEL_PATH -config $CONFIG_PATH"
  fi
else
  warn "Sabaki settings not found at: $SABAKI_SETTINGS"
  echo ""
  echo "Add this engine manually in Sabaki Preferences:"
  echo "  Name: $ENGINE_NAME"
  echo "  Path: $KATAGO_BIN"
  echo "  Args: gtp -model $MODEL_PATH -config $CONFIG_PATH"
fi

# ── Done ──────────────────────────────────────────────────────────────
echo ""
info "Setup complete!"
echo ""
echo "  Engine:   $KATAGO_BIN"
echo "  Model:    $MODEL_PATH"
echo "  Config:   $CONFIG_PATH"
echo ""
echo "Restart Sabaki to use the engine."
