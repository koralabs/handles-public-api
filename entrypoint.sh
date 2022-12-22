#!/bin/bash
# DEFAULT_NODE_OPTIONS=--max-old-space-size=12288
# export NODE_OPTIONS=--max-old-space-size=12288
NETWORK=${NETWORK:-mainnet}
MODE=${MODE:-both}
NODE_DB=${NODE_DB:-'/db'}
SOCKET_PATH=${NODE_SOCKET:-'/ipc/node.socket'}

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
    NODE_SOCKET="--node-socket /ipc/node.socket"
fi

if [[ "${MODE}" == "ogmios" || "${MODE}" == "both" ]]; then
    ogmios $HOST $NODE_CONFIG $NODE_SOCKET $@ &
    ogmios_status=$?

    if [ $ogmios_status -ne 0 ]; then
        echo "Failed to start ogmios: $ogmios_status"
        exit $ogmios_status
    fi
    sed -i 's https://api.handle.me http://localhost:3141 ' /app/swagger.yml

    NODE_ENV=${NODE_ENV:-production} NETWORK=${NETWORK} npm run start:forever &
fi

if [[ "${MODE}" == "cardano-node" || "${MODE}" == "both" ]]; then
    DB_FILE=${NODE_DB}/protocolMagicId
    if [ "${NETWORK}" == "mainnet" ] && [ ! -f "$DB_FILE" ]; then
        echo "No cardano-node db detected. Downloading latest snapshot. This could take 1 ore more hours depending on your download speed."
        curl -o - https://downloads.csnapshots.io/snapshots/mainnet/$(curl -k -s https://downloads.csnapshots.io/snapshots/mainnet/mainnet-db-snapshot.json| jq -r .[].file_name ) | lz4 -c -d - | tar -x --strip-components=1 -C ${NODE_DB}
        echo "Download complete."
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
fi
wait