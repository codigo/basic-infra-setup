#!/bin/sh
TOKEN=$(cat /run/secrets/maumercado_tunnel_token)
exec cloudflared tunnel run --token "$TOKEN"
