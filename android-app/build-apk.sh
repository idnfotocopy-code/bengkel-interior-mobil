#!/usr/bin/env bash
# Build APK Android rilis (bertanda tangan) lalu salin ke public/download web app.
# Pakai: bash build-apk.sh [DEFAULT_URL]
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WEB="${WEB_DIR:-/workspace/bengkel-interior-mobil}"
export JAVA_HOME="${JAVA_HOME:-/home/box/android/jdk17}" ANDROID_HOME="${ANDROID_HOME:-/home/box/android/sdk}"
export PATH="$JAVA_HOME/bin:/home/box/android/gradle-8.7/bin:$PATH"
cd "$HERE"
[ -f local.properties ] || echo "sdk.dir=$ANDROID_HOME" > local.properties
EXTRA=()
[ -n "${1:-}" ] && EXTRA+=("-PDEFAULT_URL=$1")
if command -v gradle >/dev/null; then gradle --no-daemon -q assembleRelease "${EXTRA[@]}"; else ./gradlew --no-daemon -q assembleRelease "${EXTRA[@]}"; fi
APK=app/build/outputs/apk/release/app-release.apk
"$ANDROID_HOME/build-tools/34.0.0/apksigner" verify "$APK"
mkdir -p "$WEB/public/download"
cp "$APK" "$WEB/public/download/bengkel-interior-mobil.apk"
VN=$(grep '^VERSION_NAME=' config.properties | cut -d= -f2); VC=$(grep '^VERSION_CODE=' config.properties | cut -d= -f2)
printf '{"package":"com.idnindonesia.bengkelinterior","versionName":"%s","versionCode":%s,"updated":"%s"}\n' "$VN" "$VC" "$(date +%F)" > "$WEB/public/download/apk.json"
echo "APK -> $WEB/public/download/bengkel-interior-mobil.apk ($(stat -c%s "$APK") bytes, v$VN)"
