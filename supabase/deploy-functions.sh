#!/bin/sh
# Run by the Supabase project owner from the project root:  sh supabase/deploy-functions.sh
# Needs the Supabase CLI (global or the project-local npm dependency) and supabase/.env.secrets.
set -e
REF=rgffdzyiwqmlyvbazxuc
SECRETS=supabase/.env.secrets
if [ ! -f "$SECRETS" ]; then
	echo "Missing $SECRETS. Copy it from the project owner securely." >&2
	exit 1
fi
if command -v supabase >/dev/null 2>&1; then
	run_supabase() { command supabase "$@"; }
elif command -v npx >/dev/null 2>&1; then
	run_supabase() { npx supabase "$@"; }
else
	echo "Supabase CLI is required. Install it globally or run npm install first." >&2
	exit 1
fi

# Do not upload database credentials from .env.secrets to Edge Functions.
TMP_ENV=$(mktemp)
trap 'rm -f "$TMP_ENV"' EXIT HUP INT TERM
awk -F= '/^[[:space:]]*(SB_SECRET_KEY|MPESA_ENV|MPESA_CONSUMER_KEY|MPESA_CONSUMER_SECRET|MPESA_SHORTCODE|MPESA_PASSKEY|MPESA_CALLBACK_TOKEN)[[:space:]]*=/ { sub(/^[[:space:]]*/, ""); print }' "$SECRETS" > "$TMP_ENV"
for name in SB_SECRET_KEY MPESA_ENV MPESA_CONSUMER_KEY MPESA_CONSUMER_SECRET MPESA_SHORTCODE MPESA_PASSKEY MPESA_CALLBACK_TOKEN; do
	if ! grep -q "^$name=" "$TMP_ENV"; then
		echo "Missing $name in $SECRETS." >&2
		exit 1
	fi
done

run_supabase login
run_supabase secrets set --env-file "$TMP_ENV" --project-ref "$REF"
run_supabase functions deploy mpesa-stk-push --no-verify-jwt --project-ref "$REF"
run_supabase functions deploy mpesa-callback --no-verify-jwt --project-ref "$REF"
echo "Done. Callback URL: https://$REF.supabase.co/functions/v1/mpesa-callback"
