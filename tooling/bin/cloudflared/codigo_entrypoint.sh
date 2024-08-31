#!/bin/sh
TOKEN=$(cat /run/secrets/codigo_tunnel_token)
exec cloudflared tunnel run --token "$TOKEN"
