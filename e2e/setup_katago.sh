#!/usr/bin/env bash
set -euo pipefail

# KataGo + Sabaki Setup Script
# Downloads or reuses KataGo, writes a small GTP config, and configures Sabaki.
# Supports: macOS, Linux, Windows Git Bash/MSYS2, and WSL configuring Windows Sabaki.

KATAGO_VERSION="v1.16.4"
KATAGO_VERSION_NUM="1.16.4"
MODEL_NAME="${KATAGO_MODEL_NAME:-kata1-b18c384nbt-s9996604416-d4316597426}"
MODEL_URL="${KATAGO_MODEL_URL:-https://media.katagotraining.org/uploaded/networks/models/kata1/${MODEL_NAME}.bin.gz}"
GITHUB_BASE="https://github.com/lightvector/KataGo/releases/download/${KATAGO_VERSION}"
HUMANSL_MODEL_NAME="b18c384nbt-humanv0.bin.gz"
HUMANSL_MODEL_URL="${HUMANSL_MODEL_URL:-https://github.com/lightvector/KataGo/releases/download/v1.15.0/${HUMANSL_MODEL_NAME}}"

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
    PLATFORM="linux"
    if [ "$IS_WSL" = "1" ]; then
      PLATFORM="wsl-windows"
      WIN_USER="$(cmd.exe /c 'echo %USERNAME%' 2>/dev/null | tr -d '\r' || true)"
      if [ -n "$WIN_USER" ] && [ -d "/mnt/c/Users/${WIN_USER}/AppData/Roaming" ]; then
        WIN_APPDATA_UNIX="/mnt/c/Users/${WIN_USER}/AppData/Roaming"
      else
        EXISTING_SETTINGS="$(compgen -G '/mnt/c/Users/*/AppData/Roaming/Sabaki/settings.json' | head -1 || true)"
        if [ -n "$EXISTING_SETTINGS" ]; then
          WIN_APPDATA_UNIX="$(dirname "$(dirname "$EXISTING_SETTINGS")")"
        else
          WIN_APPDATA_UNIX="$(compgen -G '/mnt/c/Users/*/AppData/Roaming' | head -1 || true)"
        fi
      fi
      [ -n "$WIN_APPDATA_UNIX" ] || error "Could not locate Windows AppData/Roaming from WSL."
      SABAKI_SETTINGS="$WIN_APPDATA_UNIX/Sabaki/settings.json"
    else
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

to_unix_path() {
  local p="$1"
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -u "$p"
  elif [[ "$p" =~ ^([A-Za-z]):\\(.*)$ ]]; then
    local drive="${BASH_REMATCH[1],,}"
    local rest="${BASH_REMATCH[2]//\\//}"
    echo "/mnt/$drive/$rest"
  else
    echo "$p"
  fi
}

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

# ── Data directory ───────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DATA_DIR="${KATAGO_DATA_DIR:-$REPO_ROOT/katago_data}"
mkdir -p "$DATA_DIR"

info "Data directory: $DATA_DIR"

# ── Step 1: KataGo engine ────────────────────────────────────────────
KATAGO_BIN=""

WINDOWS_KATAGO_CANDIDATES=(
  "D:\\KataGo\\engine\\v1.16.4-cuda12.8-cudnn9.8.0\\katago.exe"
  "D:\\KataGo\\katago.exe"
  "C:\\KataGo\\katago.exe"
)

WINDOWS_MODEL_CANDIDATES=(
  "D:\\KataGo\\models\\kata1-zhizi-b28c512nbt-muonfd2.bin.gz"
  "D:\\KataGo\\models\\${MODEL_NAME}.bin.gz"
  "D:\\KataGo\\${MODEL_NAME}.bin.gz"
  "C:\\KataGo\\models\\${MODEL_NAME}.bin.gz"
)

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

elif [ "$PLATFORM" = "windows" ] || [ "$PLATFORM" = "wsl-windows" ]; then
  for candidate in "${WINDOWS_KATAGO_CANDIDATES[@]}"; do
    candidate_unix="$(to_unix_path "$candidate")"
    if [ -f "$candidate_unix" ]; then
      KATAGO_BIN="$candidate_unix"
      info "Found existing Windows KataGo: $candidate"
      break
    fi
  done

  KATAGO_EXE="$DATA_DIR/katago.exe"
  if [ -n "$KATAGO_BIN" ]; then
    :
  elif [ -x "$KATAGO_EXE" ] || [ -f "$KATAGO_EXE" ]; then
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
MODEL_PATH=""

if [ "$PLATFORM" = "windows" ] || [ "$PLATFORM" = "wsl-windows" ]; then
  for candidate in "${WINDOWS_MODEL_CANDIDATES[@]}"; do
    candidate_unix="$(to_unix_path "$candidate")"
    if [ -f "$candidate_unix" ]; then
      MODEL_PATH="$candidate_unix"
      info "Found existing Windows model: $candidate"
      break
    fi
  done
fi

if [ -z "$MODEL_PATH" ]; then
  MODEL_PATH="$DATA_DIR/${MODEL_NAME}.bin.gz"
fi

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
if [ "$PLATFORM" = "windows" ] || [ "$PLATFORM" = "wsl-windows" ]; then
  MODEL_PATH_FOR_APP="$(to_windows_path "$MODEL_PATH")"
  CONFIG_PATH_FOR_APP="$(to_windows_path "$CONFIG_PATH")"
  KATAGO_BIN_FOR_APP="$(to_windows_path "$KATAGO_BIN")"
  HUMANSL_MODEL_FOR_APP="$(to_windows_path "$(dirname "$SABAKI_SETTINGS")/models/$HUMANSL_MODEL_NAME")"
else
  MODEL_PATH_FOR_APP="$MODEL_PATH"
  CONFIG_PATH_FOR_APP="$CONFIG_PATH"
  KATAGO_BIN_FOR_APP="$KATAGO_BIN"
  HUMANSL_MODEL_FOR_APP="$(dirname "$SABAKI_SETTINGS")/models/$HUMANSL_MODEL_NAME"
fi

# ── Step 4: Ensure HumanSL model before enabling the engine ───────────
HUMANSL_MODEL_UNIX="$(to_unix_path "$HUMANSL_MODEL_FOR_APP")"
mkdir -p "$(dirname "$HUMANSL_MODEL_UNIX")"

if [ ! -f "$HUMANSL_MODEL_UNIX" ]; then
  info "HumanSL model missing; downloading before enabling engine..."
  info "HumanSL URL: $HUMANSL_MODEL_URL"
  TEMP_HUMANSL="${HUMANSL_MODEL_UNIX}.download"
  rm -f "$TEMP_HUMANSL"
  curl -fL --retry 3 --retry-delay 2 -o "$TEMP_HUMANSL" "$HUMANSL_MODEL_URL"
  mv "$TEMP_HUMANSL" "$HUMANSL_MODEL_UNIX"
  info "HumanSL model downloaded: $HUMANSL_MODEL_UNIX"
else
  info "HumanSL model already exists: $HUMANSL_MODEL_UNIX"
fi

HUMANSL_ENABLED=true
HUMANSL_ENABLED_PY=True
HUMANSL_MODEL_JSON="$(json_escape "$HUMANSL_MODEL_FOR_APP")"

# ── Step 5: Smoke-test the engine binary ──────────────────────────────
if "$KATAGO_BIN" version >/tmp/katago-version.out 2>/tmp/katago-version.err; then
  info "KataGo binary smoke test passed: $(head -1 /tmp/katago-version.out)"
else
  cat /tmp/katago-version.err >&2 || true
  error "KataGo binary did not run."
fi
rm -f /tmp/katago-version.out /tmp/katago-version.err

MODEL_PATH_JSON="$(json_escape "$MODEL_PATH_FOR_APP")"
CONFIG_PATH_JSON="$(json_escape "$CONFIG_PATH_FOR_APP")"
KATAGO_BIN_JSON="$(json_escape "$KATAGO_BIN_FOR_APP")"
ARGS_JSON="$(json_escape "gtp -model \"$MODEL_PATH_FOR_APP\" -config \"$CONFIG_PATH_FOR_APP\"")"

ENGINE_NAME="KataGo local"

mkdir -p "$(dirname "$SABAKI_SETTINGS")"
if [ ! -f "$SABAKI_SETTINGS" ]; then
  echo '{}' > "$SABAKI_SETTINGS"
fi

SETTINGS=$(python3 - "$SABAKI_SETTINGS" <<PY
import json, sys

settings_path = sys.argv[1]
with open(settings_path, 'r', encoding='utf-8') as f:
    try:
        settings = json.load(f)
    except Exception:
        settings = {}

engine = {
    "id": "primary-engine",
    "enabled": True,
    "kind": "katago",
    "name": "$ENGINE_NAME",
    "path": "$KATAGO_BIN_JSON",
    "modelPath": "$MODEL_PATH_JSON",
    "configPath": "$CONFIG_PATH_JSON",
    "enableHumanSL": $HUMANSL_ENABLED_PY,
    "humanModelPath": "$HUMANSL_MODEL_JSON",
    "humanSLProfile": "rank_1d",
    "defaultShowAISuggestions": True,
    "defaultShowHumanPreference": True,
    "humanSLExplore": "light",
    "args": "$ARGS_JSON",
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

replaced = False
for i, existing in enumerate(engines):
    if existing.get("id") == "primary-engine" or existing.get("kind") == "katago":
        engines[i] = engine
        replaced = True
        break
if not replaced:
    engines.insert(0, engine)

settings["engines.list"] = engines
settings["board.show_analysis"] = True
settings["board.show_ai_suggestions"] = True
settings["board.show_human_preference"] = True

with open(settings_path, 'w', encoding='utf-8') as f:
    json.dump(settings, f, indent=2, ensure_ascii=False)
    f.write("\\n")

print("UPDATED")
PY
)

if [ "$SETTINGS" = "UPDATED" ]; then
  info "Sabaki settings updated: $SABAKI_SETTINGS"
else
  error "Could not update Sabaki settings."
fi

# ── Done ──────────────────────────────────────────────────────────────
echo ""
info "Setup complete!"
echo ""
echo "  Engine:   $KATAGO_BIN"
echo "  Model:    $MODEL_PATH"
echo "  Config:   $CONFIG_PATH"
echo "  HumanSL:  $([ "$HUMANSL_ENABLED" = true ] && echo "$HUMANSL_MODEL_FOR_APP" || echo 'disabled (model missing)')"
echo ""
echo "Restart Sabaki to use the engine."
