#!/bin/bash

curl http://api.handle.me.s3-website-us-west-2.amazonaws.com/handle-storage.json -o handle-storage.json

/root/cardano-node-ogmios.sh &
NODE_ENV=production NETWORK=mainnet npm start &
wait