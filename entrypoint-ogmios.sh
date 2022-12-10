#!/bin/sh
DEFAULT_NODE_OPTIONS=--max-old-space-size=12288

if [[ "$@" != *"--host"* ]]
then
    HOST="--host 0.0.0.0"
fi
if [[ "$@" != *"--node-config"* ]]
then
    NODE_CONFIG="--node-config /config/cardano-node/config.json"
fi
if [[ "$@" != *"--node-socket"* ]]
then
    NODE_SOCKET="--node-socket /ipc/node.socket"
fi

/bin/ogmios $HOST $NODE_CONFIG $NODE_SOCKET $@ &
NODE_ENV=${NODE_ENV:-production} NETWORK=${NETWORK:-mainnet} NODE_OPTIONS="${NODE_OPTIONS:-$DEFAULT_NODE_OPTIONS}" npm start:forever &
wait