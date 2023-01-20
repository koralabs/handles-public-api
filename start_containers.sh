#!/bin/bash

NODE_SOCKET_IP_preview='35.87.23.190'
NODE_SOCKET_IP_preprod='35.87.161.239'
NODE_SOCKET_IP_mainnet='35.93.36.48'
MODE=${MODE:-socat}
NETWORK=${NETWORK:-mainnet}
SOCKET_PATH=${SOCKET_PATH:-${HOME}/cardano/${NETWORK}/ipc}
mkdir -p ${HOME}/cardano/${NETWORK}/db && mkdir -p ${SOCKET_PATH} && mkdir -p ${HOME}/cardano/${NETWORK}/handles

if [ "$(pidof ogmios)" == "" ]; then
    echo "Ogmios not running. Starting Ogmios"
    docker rm handlesogmios
    docker pull cardanosolutions/ogmios:latest-${NETWORK}
    docker run --name handlesogmios -p 1337:1337 -v ${HOME}/cardano/${NETWORK}/ipc:/ipc cardanosolutions/ogmios:latest-${NETWORK} --node-socket /ipc/node.socket --host 0.0.0.0 --node-config /config/cardano-node/config.json &
else
    echo "Ogmios is already running. Skipping launch of Ogmios container."
fi

if [ "${MODE}" == "node" ]; then
    if [ "$(pidof cardano-node)" == "" ]; then
        echo "cardano-node not running. Starting cardano-node"
        docker pull koralabs/handles-api
        docker run --name handlesnode -v ${HOME}/cardano/${NETWORK}/db:/db -v ${SOCKET_PATH}:/ipc -e MODE=cardano-node -e NETWORK=${NETWORK} koralabs/handles-api &
    else
        echo "cardano-noe is already running. Skipping launch of cardano-node container."
    fi
fi

if [ "${MODE}" == "socat" ]; then
    SOCAT_PID=$(lsof -t ${SOCKET_PATH}/node.socket 2>/dev/null || echo '')
    if [ ! -z ${SOCAT_PID} ]; then
        echo "Previous node.socket found for ${NETWORK}. Killing and deleting."
        kill -9 ${SOCAT_PID}
    fi
    rm -f ${SOCKET_PATH}/node.socket
    NODE_SOCKET_IP=$(eval echo "\${NODE_SOCKET_IP_$NETWORK}")
    SOCAT_COMMAND="socat UNIX-LISTEN:${SOCKET_PATH}/node.socket,fork TCP-CONNECT:${NODE_SOCKET_IP:-}:4001 &"
    echo "Executing ${SOCAT_COMMAND}"
    eval $SOCAT_COMMAND
fi