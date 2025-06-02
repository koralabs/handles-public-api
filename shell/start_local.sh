#!/bin/bash
set -eu
set -a && source .env && set +a
mkdir -p tmp
OGMIOS_VER=${OGMIOS_VER:-6.11.2}
SOCKET_PATH=${SOCKET_PATH:-"${PWD}/node.socket"}
BASE_URL=${CONFIG_FILES_BASE_URL:-'https://public.koralabs.io/cardano'}
if [[ "$@" != *"--host"* ]]
then
    HOST="--host 0.0.0.0"
fi
if [[ "$@" != *"--node-config"* ]]
then
    NODE_CONFIG="--node-config ./tmp/${NETWORK}/config.json"
fi
if [[ "$@" != *"--node-socket"* ]]
then
    NODE_SOCKET="--node-socket ${SOCKET_PATH}"
fi

cp ../api.handle.me/workers/* ./workers/ 

if [ ! -x "$(command -v $HOME/.local/bin/ogmios)" ]; then
    echo 'OGMIOS NOT FOUND. INSTALLING OGMIOS...';
    curl -sL https://github.com/CardanoSolutions/ogmios/releases/download/v${OGMIOS_VER}/ogmios-v${OGMIOS_VER}-x86_64-linux.zip -o ogmios.zip
    unzip ogmios.zip -d ./ogmios-install && rm ogmios.zip
    cp ./ogmios-install/bin/ogmios $HOME/.local/bin/ogmios && chmod +x $HOME/.local/bin/ogmios && rm -rf ./ogmios-install
fi

echo 'Downloading cardano-node config files...'
declare -a NETWORKS=(preview preprod mainnet)
declare -a ERAS=(byron shelley alonzo conway)
for net in "${NETWORKS[@]}"; \
do \
    mkdir -p tmp/${net}
    curl -sL ${BASE_URL}/${net}/config.json -o tmp/${net}/config.json
    curl -sL ${BASE_URL}/${net}/topology.json -o tmp/${net}/topology.json
    for era in "${ERAS[@]}"; \
    do \
        curl -sL ${BASE_URL}/${net}/${era}-genesis.json -o tmp/${net}/${era}-genesis.json; \
    done; \
done

if ! pgrep -x "ogmios" > /dev/null
then
    ./shell/connectToNode.sh
    echo "Starting Ogmios - connecting to ${SOCKET_PATH}"
    $HOME/.local/bin/ogmios $HOST $NODE_CONFIG $NODE_SOCKET $@ --include-transaction-cbor --log-level Error &
fi
