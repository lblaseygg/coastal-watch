#!/bin/sh
set -eu

/app/docker-init.sh
exec /app/docker-entrypoint.sh
