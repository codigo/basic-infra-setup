#!/bin/sh
ENCRYPTION_KEY=$(cat /run/secrets/mau-app_pb_encryption_key)
exec pocketbase serve --dir /pb_data --publicDir /pb_public --migrationsDir /pb_migrations --encryptionEnv ${ENCRYPTION_KEY} --http=0.0.0.0:8090 --hooksDir=/pb_hooks
