#!/usr/bin/env bash
#
# Registra (idempotente) el webhook del bot de Telegram con la configuración
# correcta. CLAVE: `allowed_updates` DEBE incluir "callback_query"; sin él,
# Telegram no entrega los toques de botón del menú inline y los botones "no
# responden" (issue #16). También re-envía el `secret_token` que el handler
# verifica, para no dejar el webhook sin protección.
#
# Uso:
#   scripts/set-telegram-webhook.sh [WEBHOOK_URL]
#
# Si no se pasa WEBHOOK_URL, se toma del output `WebhookUrl` de
# VenezuelaHelpBotStack. Requiere AWS SSO activo (perfil VenezuelaHelp).
#
set -euo pipefail

PROFILE="${AWS_PROFILE:-VenezuelaHelp}"
REGION="${AWS_REGION:-us-east-1}"

URL="${1:-}"
if [ -z "$URL" ]; then
  URL=$(aws cloudformation describe-stacks --stack-name VenezuelaHelpBotStack \
    --profile "$PROFILE" --region "$REGION" \
    --query "Stacks[0].Outputs[?OutputKey=='WebhookUrl'].OutputValue" \
    --output text 2>/dev/null || true)
fi
if [ -z "$URL" ] || [ "$URL" = "None" ]; then
  echo "No se pudo determinar la WEBHOOK_URL. Pásala como argumento:" >&2
  echo "  scripts/set-telegram-webhook.sh https://<api>/webhook" >&2
  exit 1
fi

TOKEN=$(aws ssm get-parameter --name /venezuelahelp/telegram-token \
  --with-decryption --profile "$PROFILE" --region "$REGION" \
  --query "Parameter.Value" --output text)
SECRET=$(aws ssm get-parameter --name /venezuelahelp/telegram-webhook-secret \
  --with-decryption --profile "$PROFILE" --region "$REGION" \
  --query "Parameter.Value" --output text 2>/dev/null || true)

echo "Registrando webhook → ${URL}"
curl -s "https://api.telegram.org/bot${TOKEN}/setWebhook" \
  --data-urlencode "url=${URL}" \
  ${SECRET:+--data-urlencode "secret_token=${SECRET}"} \
  --data-urlencode 'allowed_updates=["message","callback_query"]' \
  | python3 -m json.tool

echo "--- getWebhookInfo ---"
curl -s "https://api.telegram.org/bot${TOKEN}/getWebhookInfo" | python3 -c "
import sys, json
d = json.load(sys.stdin)['result']
print('url:', d.get('url'))
print('allowed_updates:', d.get('allowed_updates'))
print('pending:', d.get('pending_update_count'))
print('last_error:', d.get('last_error_message', 'none'))
"
