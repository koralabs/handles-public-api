#!/bin/bash

/root/cardano-node-ogmios.sh &
NODE_ENV=production npm start &
wait