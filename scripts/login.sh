#!/usr/bin/env bash
# =============================================================================
# shdrch — Keycloak device-flow login
# =============================================================================
# Mints a Keycloak ID token from auth.shdr.ch (toolbox client) via device flow
# and caches it at ~/.aether-toolbox/keycloak/id_token.
#
# tofu's aws provider then reads that path as `web_identity_token_file` to
# assume the aether-admin role on RGW. No aether-root creds touch this repo.
#
# Path conventions match aether-toolbox: caches under ~/.aether-toolbox/ so
# tokens are shareable with other apps that need the same federation.

set -euo pipefail

KEYCLOAK_URL="https://auth.shdr.ch"
KEYCLOAK_REALM="aether"
KEYCLOAK_CLIENT_ID="toolbox"
AETHER_CACHE_DIR="${AETHER_CACHE_DIR:-$HOME/.aether-toolbox}"
CACHE_DIR="$AETHER_CACHE_DIR/keycloak"
TOKEN_FILE="${CACHE_DIR}/id_token"

# Reuse cached token if it has more than 5 minutes left.
ENV_FILE="${AETHER_CACHE_DIR}/aether-admin-env"

# Reuse cached STS creds if they have more than 5 minutes left.
if [[ -f "$ENV_FILE" ]]; then
  if mtime=$(stat -c %Y "$ENV_FILE" 2>/dev/null || stat -f %m "$ENV_FILE" 2>/dev/null); then
    # STS token TTL is 1h by default. Treat anything < 50 min old as still valid.
    if (( $(date +%s) - mtime < 3000 )); then
      echo "[login] STS env still fresh at $ENV_FILE"
      exit 0
    fi
  fi
fi

mkdir -p "$CACHE_DIR"

# Helper: exchange a Keycloak id_token for short-lived RGW STS creds and
# cache them as AWS env vars.
mint_aws_env_from_jwt() {
  local id_token="$1"
  local role_arn="${AETHER_ADMIN_ROLE_ARN:-arn:aws:iam::RGW65051373228719292:role/aether-admin}"
  local rgw_url="${RGW_STS_URL:-https://s3.home.shdr.ch}"
  local resp
  resp=$(aws --no-sign-request sts assume-role-with-web-identity \
    --endpoint-url "$rgw_url" \
    --role-arn "$role_arn" \
    --role-session-name "shdrch-tofu-$(date +%s)" \
    --web-identity-token "$id_token" 2>&1)
  if ! echo "$resp" | jq -e '.Credentials' >/dev/null 2>&1; then
    echo "[login] STS exchange failed:" >&2
    echo "$resp" >&2
    return 1
  fi
  cat > "$ENV_FILE" <<EOF
export AWS_ACCESS_KEY_ID=$(echo "$resp" | jq -r '.Credentials.AccessKeyId')
export AWS_SECRET_ACCESS_KEY=$(echo "$resp" | jq -r '.Credentials.SecretAccessKey')
export AWS_SESSION_TOKEN=$(echo "$resp" | jq -r '.Credentials.SessionToken')
EOF
  chmod 600 "$ENV_FILE"
  local exp
  exp=$(echo "$resp" | jq -r '.Credentials.Expiration')
  echo "[login] cached AWS env at $ENV_FILE (expires $exp)"
}

# If we already have a fresh id_token, skip the device flow and just
# re-mint STS creds. Keycloak ID tokens are short-lived; treat anything
# with > 60s of life left as usable for STS exchange.
if [[ -f "$TOKEN_FILE" ]]; then
  jwt_exp=$(awk -F. 'NR==1{
    s=$2; n=length(s); pad=4-(n%4); if (pad<4) for(i=0;i<pad;i++) s=s"=";
    gsub(/-/,"+",s); gsub(/_/,"/",s);
    cmd="printf %s " s " | base64 -d 2>/dev/null"
    cmd | getline out; close(cmd); print out
  }' "$TOKEN_FILE" | jq -r '.exp // 0' 2>/dev/null || echo 0)
  if (( jwt_exp > $(date +%s) + 60 )); then
    echo "[login] reusing fresh id_token (exp $(date -r "$jwt_exp" 2>/dev/null || date -d @"$jwt_exp"))"
    mint_aws_env_from_jwt "$(cat "$TOKEN_FILE")" && exit 0
  fi
fi

echo "[login] requesting device code from Keycloak"
device_resp=$(curl -sSf -X POST \
  "$KEYCLOAK_URL/realms/$KEYCLOAK_REALM/protocol/openid-connect/auth/device" \
  -d "client_id=$KEYCLOAK_CLIENT_ID" \
  -d "scope=openid profile email roles")

device_code=$(echo "$device_resp" | jq -r .device_code)
user_code=$(echo "$device_resp" | jq -r .user_code)
verify_uri=$(echo "$device_resp" | jq -r .verification_uri_complete)
interval=$(echo "$device_resp" | jq -r '.interval // 5')
expires_in=$(echo "$device_resp" | jq -r '.expires_in // 600')

echo
echo "    Visit: $verify_uri"
echo "    Code:  $user_code"
echo

if command -v open >/dev/null 2>&1; then
  open "$verify_uri" >/dev/null 2>&1 || true
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$verify_uri" >/dev/null 2>&1 || true
fi

deadline=$(( $(date +%s) + expires_in ))
echo "[login] polling for token (Ctrl-C to abort)"
while (( $(date +%s) < deadline )); do
  sleep "$interval"
  resp=$(curl -sS -X POST \
    "$KEYCLOAK_URL/realms/$KEYCLOAK_REALM/protocol/openid-connect/token" \
    -d "grant_type=urn:ietf:params:oauth:grant-type:device_code" \
    -d "device_code=$device_code" \
    -d "client_id=$KEYCLOAK_CLIENT_ID")

  err=$(echo "$resp" | jq -r '.error // ""')
  case "$err" in
    "")
      id_token=$(echo "$resp" | jq -r '.id_token')
      umask 077
      printf '%s' "$id_token" > "$TOKEN_FILE"
      echo "[login] cached id_token at $TOKEN_FILE"
      mint_aws_env_from_jwt "$id_token"
      exit 0
      ;;
    authorization_pending)
      ;;
    slow_down)
      interval=$(( interval + 5 ))
      ;;
    *)
      echo "[login] error: $err — $(echo "$resp" | jq -r '.error_description // ""')" >&2
      exit 1
      ;;
  esac
done

echo "[login] timed out waiting for authorization" >&2
exit 1
