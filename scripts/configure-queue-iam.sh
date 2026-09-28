#!/usr/bin/env bash
set -euo pipefail
BROADCAST_PROJECT_ID="${1:?Uso: bash scripts/configure-queue-iam.sh SEU_PROJECT_ID}"
BROADCAST_REGION="us-central1"
BROADCAST_RUNTIME_ACCOUNT="$(gcloud functions describe enqueueMessage --gen2 --project="$BROADCAST_PROJECT_ID" --region="$BROADCAST_REGION" --format='value(serviceConfig.serviceAccountEmail)')"
BROADCAST_DELIVERY_SERVICE="$(gcloud functions describe deliverMessage --gen2 --project="$BROADCAST_PROJECT_ID" --region="$BROADCAST_REGION" --format='value(serviceConfig.service)')"
if [[ -z "$BROADCAST_RUNTIME_ACCOUNT" || -z "$BROADCAST_DELIVERY_SERVICE" ]]; then
  echo 'Publique as funções antes de configurar as permissões da fila.' >&2
  exit 1
fi
gcloud projects add-iam-policy-binding "$BROADCAST_PROJECT_ID" --member="serviceAccount:$BROADCAST_RUNTIME_ACCOUNT" --role=roles/cloudtasks.enqueuer --condition=None
gcloud projects add-iam-policy-binding "$BROADCAST_PROJECT_ID" --member="serviceAccount:$BROADCAST_RUNTIME_ACCOUNT" --role=roles/datastore.user --condition=None
gcloud iam service-accounts add-iam-policy-binding "$BROADCAST_RUNTIME_ACCOUNT" --project="$BROADCAST_PROJECT_ID" --member="serviceAccount:$BROADCAST_RUNTIME_ACCOUNT" --role=roles/iam.serviceAccountUser --condition=None
gcloud run services add-iam-policy-binding "${BROADCAST_DELIVERY_SERVICE##*/}" --project="$BROADCAST_PROJECT_ID" --region="$BROADCAST_REGION" --member="serviceAccount:$BROADCAST_RUNTIME_ACCOUNT" --role=roles/run.invoker --condition=None
