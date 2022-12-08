#!/bin/bash
DEFAULT_NODE_OPTIONS=--max-old-space-size=12288
/root/cardano-node-ogmios.sh $@ &
NODE_ENV=${NODE_ENV:-production} NETWORK=${NETWORK:-mainnet} NODE_OPTIONS="${NODE_OPTIONS:-$DEFAULT_NODE_OPTIONS}" npm start &
wait