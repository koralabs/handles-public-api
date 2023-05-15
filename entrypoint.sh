#!/bin/bash
# DEFAULT_NODE_OPTIONS=--max-old-space-size=12288
# export NODE_OPTIONS=--max-old-space-size=12288
export NETWORK=${NETWORK:-mainnet}
export OGMIOS_HOST=${OGMIOS_HOST:-'http://0.0.0.0:1337'}
export DISABLE_HANDLES_SNAPSHOT=${DISABLE_HANDLES_SNAPSHOT:-false}
DISABLE_NODE_SNAPSHOT=${DISABLE_NODE_SNAPSHOT:-false}
MODE=${MODE:-both}
NODE_DB=${NODE_DB:-'/db'}
SOCKET_PATH=${SOCKET_PATH:-'/ipc/node.socket'}

function cleanup {
  kill -INT $(pidof cardano-node)
}

if [[ "$@" != *"--host"* ]]
then
    HOST="--host 0.0.0.0"
fi
if [[ "$@" != *"--node-config"* ]]
then
    NODE_CONFIG="--node-config ./cardano-world/docs/environments/${NETWORK}/config.json"
fi
if [[ "$@" != *"--node-socket"* ]]
then
    NODE_SOCKET="--node-socket ${SOCKET_PATH}"
fi

if [[ "${MODE}" == "ogmios" || "${MODE}" == "both" ]]; then
    ogmios $HOST $NODE_CONFIG $NODE_SOCKET $@ &
    ogmios_status=$?

    if [ $ogmios_status -ne 0 ]; then
        echo "Failed to start ogmios: $ogmios_status"
        exit $ogmios_status
    fi
    sed -i 's https://api.handle.me http://localhost:3141 ' /app/swagger.yml
fi

if [[ "${MODE}" == "ogmios" || "${MODE}" == "both" || "${MODE}" == "api-only" ]]; then
    sleep 5
    NODE_ENV=${NODE_ENV:-production} NETWORK=${NETWORK} OGMIOS_HOST=${OGMIOS_HOST} DISABLE_HANDLES_SNAPSHOT=${DISABLE_HANDLES_SNAPSHOT:-false} npm run start:forever
fi

if [[ "${MODE}" == "cardano-node" || "${MODE}" == "both" ]]; then
    DB_FILE=${NODE_DB}/protocolMagicId
    if [ ! "${DISABLE_NODE_SNAPSHOT}" == "true" ]; then
        if [ "${NETWORK}" == "mainnet" ] && [ ! -f "$DB_FILE" ]; then
            mkdir -p ${NODE_DB}
            echo "No cardano-node db detected. Downloading latest snapshot. This could take 1 ore more hours depending on your download speed."
            curl -o - https://downloads.csnapshots.io/snapshots/mainnet/$(curl -k -s https://downloads.csnapshots.io/snapshots/mainnet/mainnet-db-snapshot.json| jq -r .[].file_name ) | lz4 -c -d - | tar -x --strip-components=1 -C ${NODE_DB}
            echo "Download complete."
        fi
    fi
    
    trap cleanup INT TERM KILL QUIT ABRT
    echo "Starting cardano-node."

    exec ./cardano-node run \
        --config ./cardano-world/docs/environments/${NETWORK}/config.json \
        --topology ./cardano-world/docs/environments/${NETWORK}/topology.json \
        --database-path ${NODE_DB} \
        --port 3000 \
        --host-addr 0.0.0.0 \
        --socket-path ${SOCKET_PATH} &

    if [[ "${ENABLE_SOCKET_REDIRECT}" == "true" ]]; then
        curl ${ECS_CONTAINER_METADATA_URI_V4} | jq -r .Networks[0].IPv4Addresses[0] > /mnt/efs/cardano/${NETWORK}/cardano-node.ip
        until [ -S ${SOCKET_PATH} ]
        do
            sleep 1
        done
        echo "Found! ${SOCKET_PATH}"
        socat TCP-LISTEN:4001,reuseaddr,fork UNIX-CONNECT:${SOCKET_PATH}
    fi
fi
tail -f ./forever/**.log
wait