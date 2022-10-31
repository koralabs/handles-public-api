#!/bin/bash

/root/cardano-node-ogmios.sh &
NODE_ENV=production NETWORK=mainnet npm start &
wait