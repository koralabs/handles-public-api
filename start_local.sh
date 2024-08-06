#!/bin/bash
set -eu

if ! [ -x "$(command -v docker)" ]; then
    echo 'Remember to start Docker Desktop!'
fi

if [ "$( docker container inspect -f '{{.State.Pid}}' local-ogmios )" = "0" ]; then
    echo 'local-ogmios found. Starting...'
    docker start local-ogmios
else
    if ! [ "$( docker container inspect -f '{{.State.Status}}' local-ogmios )" = "running" ]; then
        echo 'starting local-ogmios...'
        docker run -d \
            --name local-ogmios \
            -v ~/shared-docker/preview/ipc:/ipc \
            -v ~/shared-docker/preview/db:/db \
            -p 1337:1337 \
            -e MODE=both \
            -e NETWORK=${NETWORK} \
            koralabs/handles-api --include-transaction-cbor
    else
        echo 'local-omgios already running...'
    fi
fi