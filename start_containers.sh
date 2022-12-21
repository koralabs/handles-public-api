#!/bin/bash

NETWORK=${NETWORK:-mainnet}
mkdir -p ${HOME}/cardano/${NETWORK}/db && mkdir -p ${HOME}/cardano/${NETWORK}/ipc && mkdir -p ${HOME}/cardano/${NETWORK}/handles
if [ "$(pidof ogmios)" == "" ]; then
    echo "Ogmios not running. Starting Ogmios"
    docker pull cardanosolutions/ogmios:latest-${NETWORK}
    docker run --name handlesogmios -p 1337:1337 -v ${HOME}/cardano/${NETWORK}/ipc:/ipc cardanosolutions/ogmios:latest-${NETWORK} --node-socket /ipc/node.socket --host 0.0.0.0 --node-config /config/cardano-node/config.json &
else
    echo "Ogmios is already running. Skipping launch of Ogmios container."
fi

if [ "$(pidof cardano-node)" == "" ]; then
    echo "cardano-node not running. Starting cardano-node"
    docker pull koralabs/handles-api
    docker run --name handlesnode -v ${HOME}/cardano/${NETWORK}/db:/db -v ${HOME}/cardano/${NETWORK}/ipc:/ipc -e MODE=cardano-node -e NETWORK=${NETWORK} koralabs/handles-api &
else
    echo "cardano-node is already running. Skipping launch of cardano-node container."
fi