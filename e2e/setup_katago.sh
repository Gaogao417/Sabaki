#!/usr/bin/env bash
set -euo pipefail

# KataGo + Sabaki setup script.
# This script prepares a local KataGo environment and writes structured Sabaki
# engine settings. It does not start KataGo; Sabaki builds the runtime command.

KATAGO_VERSION="${KATAGO_VERSION:-v1.16.4}"
MODEL_NAME="${KATAGO_MODEL_NAME:-kata1-b18c384nbt-s9996604416-d4316597426}"
MODEL_URL="${KATAGO_MODEL_URL:-https://media.katagotraining.org/uploaded/networks/models/kata1/${MODEL_NAME}.bin.gz}"
HUMANSL_MODEL_NAME="${HUMANSL_MODEL_NAME:-b18c384nbt-humanv0.bin.gz}"
HUMANSL_MODEL_URL="${HUMANSL_MODEL_URL:-https://github.com/lightvector/KataGo/releases/download/v1.15.0/${HUMANSL_MODEL_NAME}}"
GITHUB_BASE="https://github.com/lightvector/KataGo/releases/download/${KATAGO_VERSION}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() {
  echo -e "${RED}[ERROR]${NC} $*" >&2
  exit 1
}

OS="$(uname -s)"
ARCH="$(uname -m)"
IS_WSL=0
if [ "$OS" = "Linux" ] && grep -qi microsoft /proc/version 2>/dev/null; then
  IS_WSL=1
fi

case "$OS" in
  Darwin)
    PLATFORM="macos"
    SABAKI_SETTINGS="$HOME/Library/Application Support/Sabaki/settings.json"
    ;;
  Linux)
    if [ "$IS_WSL" = "1" ]; then
      PLATFORM="wsl-windows"
      EXISTING_SETTINGS="$(compgen -G '/mnt/c/Users/*/AppData/Roaming/Sabaki/settings.json' | head -1 || true)"
      if [ -n "$EXISTING_SETTINGS" ]; then
        WIN_APPDATA_UNIX="$(dirname "$(dirname "$EXISTING_SETTINGS")")"
      else
        WIN_APPDATA_UNIX="$(compgen -G '/mnt/c/Users/*/AppData/Roaming' | head -1 || true)"
      fi
      [ -n "$WIN_APPDATA_UNIX" ] || error "Could not locate Windows AppData/Roaming from WSL."
      SABAKI_SETTINGS="$WIN_APPDATA_UNIX/Sabaki/settings.json"
    else
      PLATFORM="linux"
      SABAKI_SETTINGS="$HOME/.config/Sabaki/settings.json"
    fi
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

to_windows_path() {
  local p="$1"
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$p"
  elif command -v wslpath >/dev/null 2>&1; then
    wslpath -w "$p"
  else
    echo "$p"
  fi
}

json_escape() {
  python3 - "$1" <<'PY'
import json, sys
print(json.dumps(sys.argv[1], ensure_ascii=False)[1:-1])
PY
}

download_if_missing() {
  local path="$1"
  local url="$2"
  local label="$3"

  mkdir -p "$(dirname "$path")"

  if [ -f "$path" ]; then
    info "$label already exists: $path"
    return
  fi

  info "Downloading $label..."
  local temp_path="${path}.download"
  rm -f "$temp_path"
  curl -fL --retry 3 --retry-delay 2 -o "$temp_path" "$url"
  mv "$temp_path" "$path"
  info "$label downloaded: $path"
}

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="${KATAGO_DATA_DIR:-$REPO_ROOT/katago_data}"
mkdir -p "$DATA_DIR"
info "Data directory: $DATA_DIR"

# Step 1: locate or install KataGo.
KATAGO_BIN="${KATAGO_BIN:-}"

if [ -z "$KATAGO_BIN" ] && command -v katago >/dev/null 2>&1; then
  KATAGO_BIN="$(command -v katago)"
  info "Found KataGo on PATH: $KATAGO_BIN"
fi

if [ -z "$KATAGO_BIN" ] && command -v katago.exe >/dev/null 2>&1; then
  KATAGO_BIN="$(command -v katago.exe)"
  info "Found KataGo on PATH: $KATAGO_BIN"
fi

if [ -z "$KATAGO_BIN" ]; then
  case "$PLATFORM" in
    macos)
      if command -v brew >/dev/null 2>&1; then
        info "Installing KataGo via Homebrew..."
        brew install katago
        KATAGO_BIN="$(command -v katago)"
      else
        error "KataGo not found. Install Homebrew or set KATAGO_BIN."
      fi
      ;;
    linux)
      KATAGO_BIN="$DATA_DIR/katago"
      if [ ! -x "$KATAGO_BIN" ]; then
        ZIP_NAME="katago-${KATAGO_VERSION}-eigenavx2-linux-x64.zip"
        ZIP_PATH="$DATA_DIR/$ZIP_NAME"
        download_if_missing "$ZIP_PATH" "${GITHUB_BASE}/${ZIP_NAME}" "KataGo ${KATAGO_VERSION} Linux package"
        unzip -o -q "$ZIP_PATH" -d "$DATA_DIR"
        EXTRACTED_BIN="$(find "$DATA_DIR" -name katago -type f | head -1)"
        [ -n "$EXTRACTED_BIN" ] || error "Could not find katago in downloaded package."
        mv "$EXTRACTED_BIN" "$KATAGO_BIN"
        chmod +x "$KATAGO_BIN"
        find "$DATA_DIR" -maxdepth 1 -name 'katago-*' -type d -exec rm -rf {} +
        rm -f "$ZIP_PATH"
      fi
      ;;
    windows|wsl-windows)
      KATAGO_BIN="$DATA_DIR/katago.exe"
      if [ ! -f "$KATAGO_BIN" ]; then
        ZIP_NAME="katago-${KATAGO_VERSION}-eigenavx2-windows-x64.zip"
        ZIP_PATH="$DATA_DIR/$ZIP_NAME"
        download_if_missing "$ZIP_PATH" "${GITHUB_BASE}/${ZIP_NAME}" "KataGo ${KATAGO_VERSION} Windows package"
        unzip -o -q "$ZIP_PATH" -d "$DATA_DIR"
        EXTRACTED_BIN="$(find "$DATA_DIR" -name katago.exe -type f | head -1)"
        [ -n "$EXTRACTED_BIN" ] || error "Could not find katago.exe in downloaded package."
        mv "$EXTRACTED_BIN" "$KATAGO_BIN"
        find "$DATA_DIR" -maxdepth 1 -name 'katago-*' -type d -exec rm -rf {} +
        rm -f "$ZIP_PATH"
      fi
      ;;
  esac
fi

[ -n "$KATAGO_BIN" ] || error "KataGo binary was not configured."
info "KataGo binary: $KATAGO_BIN"

# Step 2: ensure normal and HumanSL models.
MODEL_PATH="${KATAGO_MODEL_PATH:-$DATA_DIR/${MODEL_NAME}.bin.gz}"
HUMANSL_MODEL_PATH="${HUMANSL_MODEL_PATH:-$DATA_DIR/$HUMANSL_MODEL_NAME}"

download_if_missing "$MODEL_PATH" "$MODEL_URL" "KataGo model"
download_if_missing "$HUMANSL_MODEL_PATH" "$HUMANSL_MODEL_URL" "HumanSL model"

# Step 3: write a minimal config. Search limits are controlled at runtime.
CONFIG_PATH="${KATAGO_CONFIG_PATH:-$DATA_DIR/gtp.cfg}"
cat > "$CONFIG_PATH" <<'EOF'
logDir = gtp_logs
logAllGTPCommunication = false
logSearchInfo = false
logSearchInfoForChosenMove = false
logToStderr = false

rules = tromp-taylor
allowResignation = true
resignThreshold = -0.90
resignConsecTurns = 3
ponderingEnabled = false
maxTimePondering = 60.0
lagBuffer = 1.0
numSearchThreads = 4
searchFactorAfterOnePass = 0.50
searchFactorAfterTwoPass = 0.25
searchFactorWhenWinning = 0.40
searchFactorWhenWinningThreshold = 0.95

reportAnalysisWinratesAs = BLACK
humanSLProfile = rank_1d
ignorePreRootHistory = false
analysisIgnorePreRootHistory = false
rootNumSymmetriesToSample = 2
useLcbForSelection = false
EOF
info "Config written: $CONFIG_PATH"

# Step 4: write structured Sabaki settings.
if [ "$PLATFORM" = "windows" ] || [ "$PLATFORM" = "wsl-windows" ]; then
  KATAGO_BIN_FOR_APP="$(to_windows_path "$KATAGO_BIN")"
  MODEL_PATH_FOR_APP="$(to_windows_path "$MODEL_PATH")"
  HUMANSL_MODEL_FOR_APP="$(to_windows_path "$HUMANSL_MODEL_PATH")"
  CONFIG_PATH_FOR_APP="$(to_windows_path "$CONFIG_PATH")"
else
  KATAGO_BIN_FOR_APP="$KATAGO_BIN"
  MODEL_PATH_FOR_APP="$MODEL_PATH"
  HUMANSL_MODEL_FOR_APP="$HUMANSL_MODEL_PATH"
  CONFIG_PATH_FOR_APP="$CONFIG_PATH"
fi

KATAGO_BIN_JSON="$(json_escape "$KATAGO_BIN_FOR_APP")"
MODEL_PATH_JSON="$(json_escape "$MODEL_PATH_FOR_APP")"
HUMANSL_MODEL_JSON="$(json_escape "$HUMANSL_MODEL_FOR_APP")"
CONFIG_PATH_JSON="$(json_escape "$CONFIG_PATH_FOR_APP")"

mkdir -p "$(dirname "$SABAKI_SETTINGS")"
if [ ! -f "$SABAKI_SETTINGS" ]; then
  echo '{}' > "$SABAKI_SETTINGS"
fi

SETTINGS=$(python3 - "$SABAKI_SETTINGS" <<PY
import json, sys

settings_path = sys.argv[1]
with open(settings_path, "r", encoding="utf-8") as f:
    try:
        settings = json.load(f)
    except Exception:
        settings = {}

engine = {
    "id": "primary-engine",
    "enabled": True,
    "kind": "katago",
    "name": "KataGo local",
    "path": "$KATAGO_BIN_JSON",
    "modelPath": "$MODEL_PATH_JSON",
    "configPath": "$CONFIG_PATH_JSON",
    "enableHumanSL": True,
    "humanModelPath": "$HUMANSL_MODEL_JSON",
    "humanSLProfile": "rank_1d",
    "defaultShowAISuggestions": True,
    "defaultShowHumanPreference": True,
    "humanSLExplore": "light",
    "args": "",
    "commands": "",
    "analysis": {
        "visits": "800",
        "playouts": "0",
        "maxTime": "15",
        "candidates": "5",
        "temperature": "1",
    },
}

engines = settings.get("engines.list", [])
if not isinstance(engines, list):
    engines = []

for index, existing in enumerate(engines):
    if existing.get("id") == "primary-engine" or existing.get("kind") == "katago":
        engines[index] = engine
        break
else:
    engines.insert(0, engine)

settings["engines.list"] = engines
settings["board.show_analysis"] = True
settings["board.show_ai_suggestions"] = True
settings["board.show_human_preference"] = True

with open(settings_path, "w", encoding="utf-8") as f:
    json.dump(settings, f, indent=2, ensure_ascii=False)
    f.write("\\n")

print("UPDATED")
PY
)

[ "$SETTINGS" = "UPDATED" ] || error "Could not update Sabaki settings."
info "Sabaki settings updated: $SABAKI_SETTINGS"

echo ""
info "Setup complete."
echo "  Engine:  $KATAGO_BIN"
echo "  Model:   $MODEL_PATH"
echo "  HumanSL: $HUMANSL_MODEL_PATH"
echo "  Config:  $CONFIG_PATH"
echo ""
echo "Restart Sabaki to use the configured engine."
