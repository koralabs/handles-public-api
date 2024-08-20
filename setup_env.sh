#!/bin/bash
mkdir -p handles/{preview,preprod,mainnet}/snapshot
mkdir -p handles/snapshot
touch handles/preview/snapshot/handles.json
touch handles/preprod/snapshot/handles.json
touch handles/mainnet/snapshot/handles.json
cp docs/swagger.yml src/swagger.yml