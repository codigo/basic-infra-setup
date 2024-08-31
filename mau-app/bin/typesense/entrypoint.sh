#!/bin/sh
TOKEN=$(cat /run/secrets/mau-app_typesense_api_key)
exec /opt/typesense-server --data-dir /data --api-key "$TOKEN"
