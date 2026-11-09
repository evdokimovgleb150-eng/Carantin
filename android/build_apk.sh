#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/android"
BUILD_DIR="$ANDROID_DIR/build"
OUT_APK="${1:-$ROOT_DIR/CARANTIN.apk}"

ANDROID_SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/usr/local/lib/android/sdk}}"
if [[ ! -d "$ANDROID_SDK" ]]; then
  echo "Android SDK not found at $ANDROID_SDK" >&2
  exit 1
fi

PLATFORM_DIR="$(ls -d "$ANDROID_SDK"/platforms/android-* 2>/dev/null | sort -V | tail -n 1)"
BUILD_TOOLS_DIR="$(ls -d "$ANDROID_SDK"/build-tools/* 2>/dev/null | sort -V | tail -n 1)"
if [[ -z "$PLATFORM_DIR" || -z "$BUILD_TOOLS_DIR" ]]; then
  echo "Missing Android platforms or build-tools in $ANDROID_SDK" >&2
  exit 1
fi

ANDROID_JAR="$PLATFORM_DIR/android.jar"
AAPT2="$BUILD_TOOLS_DIR/aapt2"
D8="$BUILD_TOOLS_DIR/d8"
ZIPALIGN="$BUILD_TOOLS_DIR/zipalign"
APKSIGNER="$BUILD_TOOLS_DIR/apksigner"

echo "Using platform: $PLATFORM_DIR"
echo "Using build-tools: $BUILD_TOOLS_DIR"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"/{gen,obj,dex,res/values,res/mipmap-mdpi,res/mipmap-hdpi,res/mipmap-xhdpi,res/mipmap-xxhdpi,res/mipmap-xxxhdpi,assets/www}

cp "$ANDROID_DIR/res/values/"*.xml "$BUILD_DIR/res/values/"
cp "$ROOT_DIR/icon-192.png" "$BUILD_DIR/res/mipmap-mdpi/ic_launcher.png"
cp "$ROOT_DIR/icon-192.png" "$BUILD_DIR/res/mipmap-hdpi/ic_launcher.png"
cp "$ROOT_DIR/icon-192.png" "$BUILD_DIR/res/mipmap-xhdpi/ic_launcher.png"
cp "$ROOT_DIR/icon-192.png" "$BUILD_DIR/res/mipmap-xxhdpi/ic_launcher.png"
cp "$ROOT_DIR/icon-512.png" "$BUILD_DIR/res/mipmap-xxxhdpi/ic_launcher.png"

cp "$ROOT_DIR/index.html" "$ROOT_DIR/campaign.js" "$ROOT_DIR/manifest.json" "$ROOT_DIR/sw.js" "$ROOT_DIR/icon-192.png" "$ROOT_DIR/icon-512.png" "$BUILD_DIR/assets/www/"

"$AAPT2" compile --dir "$BUILD_DIR/res" -o "$BUILD_DIR/compiled.zip"
"$AAPT2" link \
  -I "$ANDROID_JAR" \
  --manifest "$ANDROID_DIR/AndroidManifest.xml" \
  -A "$BUILD_DIR/assets" \
  --java "$BUILD_DIR/gen" \
  -o "$BUILD_DIR/unaligned.apk" \
  "$BUILD_DIR/compiled.zip"

javac -source 11 -target 11 \
  -classpath "$ANDROID_JAR" \
  -d "$BUILD_DIR/obj" \
  "$BUILD_DIR/gen/com/carantin/game/R.java" \
  "$ANDROID_DIR/src/com/carantin/game/MainActivity.java"

find "$BUILD_DIR/obj" -name '*.class' > "$BUILD_DIR/classes.txt"
"$D8" --min-api 24 --lib "$ANDROID_JAR" --output "$BUILD_DIR/dex" $(cat "$BUILD_DIR/classes.txt")

(cd "$BUILD_DIR/dex" && zip -q "$BUILD_DIR/unaligned.apk" classes*.dex)

"$ZIPALIGN" -f -p 4 "$BUILD_DIR/unaligned.apk" "$BUILD_DIR/aligned.apk"

KEYSTORE="$BUILD_DIR/carantin-release.keystore"
KEY_PASS="carantin123"
keytool -genkeypair -noprompt \
  -keystore "$KEYSTORE" \
  -alias carantin \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$KEY_PASS" -keypass "$KEY_PASS" \
  -dname "CN=CARANTIN, O=CarantinGame, L=Quarantine, C=RU"

"$APKSIGNER" sign \
  --ks "$KEYSTORE" \
  --ks-key-alias carantin \
  --ks-pass "pass:$KEY_PASS" \
  --key-pass "pass:$KEY_PASS" \
  --out "$OUT_APK" \
  "$BUILD_DIR/aligned.apk"

"$APKSIGNER" verify --verbose "$OUT_APK"
ls -lh "$OUT_APK"
