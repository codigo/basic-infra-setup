#!/bin/sh
TOKEN=$(cat /run/secrets/mau-app_typesense_api_key)
exec typesense --data-dir /data --api-key "$TOKEN"
