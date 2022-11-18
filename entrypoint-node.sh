#!/bin/bash

/root/cardano-node-ogmios.sh $@ &
NODE_ENV=${NODE_ENV:-production} NETWORK=${NETWORK:-mainnet} npm start &
wait