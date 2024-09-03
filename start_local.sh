#!/bin/bash
set -eu

if [ ! -x "$(command -v docker)" ] || [[ ! "$(docker --version)" == "Docker version"* ]]; then
    echo -en "\033[31m"
    echo '******** Remember to start Docker Desktop! ***********';
    echo -en "\033[0m"
    exit 1
fi

if [ "$( docker container inspect -f '{{.State.Pid}}' local-ogmios )" = "0" ]; then
    echo 'local-ogmios found. Starting...'
    docker start local-ogmios
else
    if ! [ "$( docker container inspect -f '{{.State.Status}}' local-ogmios )" = "running" ]; then
        echo 'starting local-ogmios...'
        docker run -d \
            --name local-ogmios \
            -v ~/shared-docker/${NETWORK}/ipc:/ipc \
            -v ~/shared-docker/${NETWORK}/db:/db \
            -p 1337:1337 \
            -e MODE=both \
            -e NETWORK=${NETWORK} \
            koralabs/handles-api --include-transaction-cbor
    else
        echo 'local-omgios already running...'
    fi
fi