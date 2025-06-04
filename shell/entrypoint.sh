#!/bin/bash
set -eu

export NODE_OPTIONS='--max-old-space-size=12288'
export NETWORK=${NETWORK:-mainnet}
export OGMIOS_HOST=${OGMIOS_HOST:-'http://0.0.0.0:1337'}
export DISABLE_HANDLES_SNAPSHOT=${DISABLE_HANDLES_SNAPSHOT:-false}
DISABLE_NODE_SNAPSHOT=${DISABLE_NODE_SNAPSHOT:-false}
# api-only
# ogmios
# cardano-node
# both (cardano-node + ogmios)
# all [default] (cardano-node + ogmios + api)
MODE=${MODE:-all}
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
    NODE_CONFIG="--node-config ./${NETWORK}/config.json"
fi
if [[ "$@" != *"--node-socket"* ]]
then
    NODE_SOCKET="--node-socket ${SOCKET_PATH}"
fi

if [[ "${MODE}" == "ogmios" || "${MODE}" == "both" || "${MODE}" == "all" ]]; then
    # --include-transaction-cbor
    ogmios $HOST $NODE_CONFIG $NODE_SOCKET $@ &
    ogmios_status=$?

    if [ $ogmios_status -ne 0 ]; then
        echo "Failed to start ogmios: $ogmios_status"
        exit $ogmios_status
    fi
fi

if [[ "${MODE}" == "ogmios" || "${MODE}" == "all" || "${MODE}" == "api-only" ]]; then
    source ~/.nvm/nvm.sh
    export TMPDIR=/tmp
    nvm use 21
    sed -i 's https://api.handle.me http://localhost:3141 ' /app/swagger.yml
    sleep 5
    NODE_ENV=${NODE_ENV:-production} NETWORK=${NETWORK} OGMIOS_HOST=${OGMIOS_HOST} DISABLE_HANDLES_SNAPSHOT=${DISABLE_HANDLES_SNAPSHOT:-false} npm run start:forever
    tail -f ./forever/**.log
fi

release_host() {
    case $NETWORK in
        preprod | mainnet)
            echo -n "release-${NETWORK}";;
        preview)
            echo -n "testing-preview";;
    esac
}
export RELEASE_HOST=$(release_host)

if [[ "${MODE}" == "cardano-node" || "${MODE}" == "both" || "${MODE}" == "all" ]]; then
    if [ ! "${DISABLE_NODE_SNAPSHOT}" == "true" ]; then
        rm -rf ${NODE_DB}
        mkdir -p ${NODE_DB}
        echo "Grabbing latest snapshot with Mithril."
        MITHRIL_VERSION=2517.1
        curl -fsSL https://github.com/input-output-hk/mithril/releases/download/${MITHRIL_VERSION}/mithril-${MITHRIL_VERSION}-linux-x64.tar.gz | tar -xz
        export AGGREGATOR_ENDPOINT=https://aggregator.${RELEASE_HOST}.api.mithril.network/aggregator
        export GENESIS_VERIFICATION_KEY=$(curl https://raw.githubusercontent.com/input-output-hk/mithril/main/mithril-infra/configuration/${RELEASE_HOST}/genesis.vkey)
        export SNAPSHOT_DIGEST=latest
        chmod +x ./mithril-client
        curl -o - $(./mithril-client cardano-db snapshot show --json $SNAPSHOT_DIGEST | jq -r '.locations[0]') | tar --use-compress-program=unzstd -x -C ${NODE_DB}
        #./mithril-client snapshot download $SNAPSHOT_DIGEST
        echo "Mithril snapshot downloaded and validated."
    fi
    
    trap cleanup INT TERM KILL QUIT ABRT
    echo "Starting cardano-node."

    # Workaround for Mithril not outputting the protocolMagicId
    cat ./${NETWORK}/shelley-genesis.json | jq -r .networkMagic > ${NODE_DB}/protocolMagicId

    exec ./cardano-node run \
        --config ./${NETWORK}/config.json \
        --topology ./${NETWORK}/topology.json \
        --database-path ${NODE_DB} \
        --port 3000 \
        --host-addr 0.0.0.0 \
        --socket-path ${SOCKET_PATH} &

    if [[ "${ENABLE_SOCKET_REDIRECT}" == "true" ]]; then
        until [ -S ${SOCKET_PATH} ]
        do
            sleep 1
        done
        echo "Found! ${SOCKET_PATH}"
        # CHANGE THIS TO S3
        curl ${ECS_CONTAINER_METADATA_URI_V4} | jq -r .Networks[0].IPv4Addresses[0] > /mnt/efs/cardano/${NETWORK}/cardano-node.ip
        socat TCP-LISTEN:4001,reuseaddr,fork UNIX-CONNECT:${SOCKET_PATH}
    fi
fi
wait