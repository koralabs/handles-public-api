#!/bin/bash
mkdir -p handles/{preview,preprod,mainnet}/snapshot
mkdir -p handles/snapshot
mkdir -p block_processors
touch handles/preview/snapshot/handles.json
touch handles/preprod/snapshot/handles.json
touch handles/mainnet/snapshot/handles.json
touch handles/snapshot/handles.json
cp docs/swagger.yml swagger.yml 2>/dev/null || :