#!/usr/bin/env bash
set -euo pipefail

: "${NAMECHEAP_FTPS_USERNAME:?Set the Namecheap deployment username secret}"
: "${NAMECHEAP_FTPS_PASSWORD:?Set the Namecheap deployment password secret}"

dist=apps/web/dist
host=ftp://server358.web-hosting.com:21
for file in index.html .htaccess evaluation-status.php; do
  test -f "$dist/$file"
done

ready=false
for attempt in {1..40}; do
  main_sha=$(gh api "repos/$GITHUB_REPOSITORY/git/ref/heads/main" --jq .object.sha)
  if [[ "$main_sha" != "$RELEASE_SHA" ]]; then
    echo 'A newer commit is on main. Skipping this release.'
    exit 0
  fi
  if curl -fsS --max-time 10 "$VITE_API_URL/api/health" | jq -e --arg sha "$RELEASE_SHA" \
    '.status == "healthy" and .database == "connected" and .revision == $sha' >/dev/null; then
    ready=true
    break
  fi
  sleep 15
done
if [[ "$ready" != true ]]; then
  echo 'Render did not serve the matching healthy API revision. Frontend deployment stopped.' >&2
  exit 1
fi

upload() {
  local path=$1 temporary
  if [[ ! "$path" =~ ^[a-zA-Z0-9._/-]+$ ]]; then
    echo "Unsupported filename in frontend build: $path" >&2
    exit 1
  fi
  temporary="$path.advisio-upload"
  curl --silent --show-error --fail --ssl-reqd --proto '=ftp' --ftp-create-dirs \
    --max-time 45 --retry 2 --user "$NAMECHEAP_FTPS_USERNAME:$NAMECHEAP_FTPS_PASSWORD" \
    --upload-file "$dist/$path" --quote "-RNFR /$temporary" --quote "-RNTO /$path" \
    "$host/$temporary"
}

# Keep the previous index and its hashed assets usable until the upload completes.
while IFS= read -r -d '' file; do
  upload "${file#"$dist/"}"
done < <(find "$dist" -type f ! -path "$dist/index.html" ! -path "$dist/.htaccess" -print0)
upload .htaccess
upload index.html

served_index=$(mktemp)
trap 'rm -f "$served_index"' EXIT
curl -fsS --retry 3 --max-time 20 "https://advisio-ua.com/?release=$RELEASE_SHA" -o "$served_index"
cmp "$dist/index.html" "$served_index"
