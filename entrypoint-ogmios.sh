#!/bin/bash

curl http://api.handle.me.s3-website-us-west-2.amazonaws.com/handles.json -o storage/handles.json

/bin/ogmios --node-socket /ipc/node.socket --node-config /config/cardano-node/config.json --host 0.0.0.0 &
NODE_ENV=production NETWORK=mainnet npm start &
wait