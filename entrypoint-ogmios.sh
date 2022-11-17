#!/bin/sh

/bin/ogmios "$@" &
NODE_ENV=${NODE_ENV:-production} NETWORK=${NETWORK:-mainnet} npm start &
wait