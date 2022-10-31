#!/bin/sh

/bin/ogmios --node-socket /ipc/node.socket --node-config /config/cardano-node/config.json --host 0.0.0.0 &
NODE_ENV=production NETWORK=mainnet npm start &
wait