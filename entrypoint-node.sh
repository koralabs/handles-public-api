#!/bin/bash

DEFAULT_NODE_OPTIONS=--max-old-space-size=12288

if [[ "$@" != *"--node-config"* ]]
then
    NODE_CONFIG="--node-config ./cardano-world/docs/environments/${NETWORK:-mainnet}/config.json"
fi
if [[ "$@" != *"--node-socket"* ]]
then
    NODE_SOCKET="--node-socket /ipc/node.socket"
fi

ogmios --host 0.0.0.0 $NODE_CONFIG $NODE_SOCKET $@ &
ogmios_status=$?

if [ $ogmios_status -ne 0 ]; then
  echo "Failed to start ogmios: $ogmios_status"
  exit $ogmios_status
fi

cardano-node run +RTS -N -RTS \
    --config ./cardano-world/docs/environments/${NETWORK:-mainnet}/config.json \
    --topology ./cardano-world/docs/environments/${NETWORK:-mainnet}/topology.json \
    --database-path /db \
    --port 3000 \
    --host-addr 0.0.0.0 \
    --socket-path /ipc/node.socket &

NODE_ENV=${NODE_ENV:-production} NETWORK=${NETWORK:-mainnet} NODE_OPTIONS="${NODE_OPTIONS:-$DEFAULT_NODE_OPTIONS}" npm start &
wait