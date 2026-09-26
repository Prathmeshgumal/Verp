#!/usr/bin/env bash
# Downloads the Site Ledger fonts (SIL Open Font License) as static TTFs into the Android assets.
# Google Fonts serves TrueType to clients that do not send a browser User-Agent.
set -euo pipefail
dest="$(cd "$(dirname "$0")/.." && pwd)/android/app/src/main/assets/fonts"
mkdir -p "$dest"

fetch() { # family weight file
  local css url
  css=$(curl -fsS "https://fonts.googleapis.com/css2?family=$1:wght@$2")
  url=$(grep -o 'https://fonts.gstatic.com/[^)]*\.ttf' <<<"$css" | head -1)
  [ -n "$url" ] || { echo "no ttf for $1 $2" >&2; exit 1; }
  curl -fsSL "$url" -o "$dest/$3.ttf"
  echo "saved $3.ttf"
}

fetch Archivo 800 Archivo-ExtraBold
fetch Public+Sans 400 PublicSans-Regular
fetch Public+Sans 500 PublicSans-Medium
fetch Public+Sans 600 PublicSans-SemiBold
fetch Public+Sans 700 PublicSans-Bold
fetch IBM+Plex+Mono 500 IBMPlexMono-Medium
fetch IBM+Plex+Mono 600 IBMPlexMono-SemiBold
