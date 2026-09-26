#!/usr/bin/env bash
# Fails if any APK in <dir> is larger than <maxMB> (spec §10: ≤ 20 MB per ABI).
set -euo pipefail
dir="$1"
max_mb="$2"
max=$((max_mb * 1024 * 1024))
shopt -s nullglob
apks=("$dir"/*.apk)
if [ ${#apks[@]} -eq 0 ]; then
  echo "no APKs in $dir" >&2
  exit 1
fi
status=0
for apk in "${apks[@]}"; do
  size=$(stat -c %s "$apk")
  printf '%-40s %6.1f MB\n' "$(basename "$apk")" "$(echo "$size / 1048576" | bc -l)"
  if [ "$size" -gt "$max" ]; then
    echo "  over ${max_mb} MB" >&2
    status=1
  fi
done
exit $status
