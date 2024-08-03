#!/bin/bash
set -eu

docker run \
    -v ~/shared-docker/preview/ipc:/ipc \
    -v ~/shared-docker/preview/db:/db \
    -p 1337:1337 \
    -e MODE=both \
    -e NETWORK=preview \
    koralabs/handles-api --include-transaction-cbor