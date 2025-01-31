#!/bin/bash
# DEFAULT_NODE_OPTIONS=--max-old-space-size=12288
# export NODE_OPTIONS=--max-old-space-size=12288
export NETWORK=${NETWORK:-mainnet}
DISABLE_NODE_SNAPSHOT=${DISABLE_NODE_SNAPSHOT:-false}
NODE_DB=${NODE_DB:-'/db'}
SOCKET_PATH=${SOCKET_PATH:-'/ipc/node.socket'}

function cleanup {
  kill -INT $(pidof cardano-node)
}

################################################
## INSTALL THINGS
################################################
CARDANO_NODE_VER=${CARDANO_NODE_VER:-10.1.2}
OGMIOS_VER=${OGMIOS_VER:-6.9.0}
apt install -y && apt update -y && apt install -y git curl socat jq unzip tini lz4 zstd
curl -fsSL https://github.com/IntersectMBO/cardano-node/releases/download/${CARDANO_NODE_VER}/cardano-node-${CARDANO_NODE_VER}-linux.tar.gz | tar -xz
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
rm -f ./cardano-node-${CARDANO_NODE_VER}-linux.tar.gz
cp ./bin/* ./
chmod +x ./cardano-node && chmod +x ./entrypoint.sh && mkdir -p /ipc && mkdir -p handles && touch handles/handles.json
BASE_URL="https://book.world.dev.cardano.org/environments"
declare -a NETWORKS=(preview preprod mainnet)
declare -a ERAS=(byron shelley alonzo conway)
for net in "${NETWORKS[@]}"; \
do \
    mkdir -p ${net}
    curl -sL ${BASE_URL}/${net}/config.json -o ${net}/config.json
    curl -sL ${BASE_URL}/${net}/topology.json -o ${net}/topology.json
    for era in "${ERAS[@]}"; \
    do \
        curl -sL ${BASE_URL}/${net}/${era}-genesis.json -o ${net}/${era}-genesis.json; \
    done; \
done
################################################

release_host() {
    case $NETWORK in
        preprod | mainnet)
            echo -n "release-${NETWORK}";;
        preview)
            echo -n "testing-preview";;
    esac
}
export RELEASE_HOST=$(release_host)

DB_FILE=${NODE_DB}/protocolMagicId
if [ ! "${DISABLE_NODE_SNAPSHOT}" == "true" ]; then
    if [ ! -f "$DB_FILE" ]; then
        mkdir -p ${NODE_DB}
        echo "No cardano-node db detected. Grabbing latest snapshot with Mithril."
        MITHRIL_VERSION=2430.0
        curl -fsSL https://github.com/input-output-hk/mithril/releases/download/${MITHRIL_VERSION}/mithril-${MITHRIL_VERSION}-linux-x64.tar.gz | tar -xz
        export AGGREGATOR_ENDPOINT=https://aggregator.${RELEASE_HOST}.api.mithril.network/aggregator
        export GENESIS_VERIFICATION_KEY=$(curl https://raw.githubusercontent.com/input-output-hk/mithril/main/mithril-infra/configuration/${RELEASE_HOST}/genesis.vkey)
        export SNAPSHOT_DIGEST=latest
        chmod +x ./mithril-client
        curl -o - $(./mithril-client cardano-db snapshot show --json $SNAPSHOT_DIGEST | jq -r '.locations[0]') | tar --use-compress-program=unzstd -x -C ${NODE_DB}
        #./mithril-client snapshot download $SNAPSHOT_DIGEST
        echo "Mithril snapshot downloaded and validated."
    fi
fi

trap cleanup INT TERM KILL QUIT ABRT STOP
echo "Starting cardano-node."

exec ./cardano-node run \
    --config ./${NETWORK}/config.json \
    --topology ./${NETWORK}/topology.json \
    --database-path ${NODE_DB} \
    --port 3000 \
    --host-addr 0.0.0.0 \
    --socket-path ${SOCKET_PATH} &

IP_FILE=${NETWORK}/cardano-node.ip
curl https://checkip.amazonaws.com -o ${IP_FILE}
BUCKET=api.handle.me
resource="/${BUCKET}/${IP_FILE}"
contentType="text/plain"
dateValue=`date -R`
stringToSign="PUT\n\n${contentType}\n${dateValue}\n${resource}"
s3Key=Xs3keyX
s3Secret=Xs3secretX
signature=`echo -en ${stringToSign} | openssl sha1 -hmac ${s3Secret} -binary | base64`
curl -X PUT -T "${IP_FILE}" \
  -H "Host: ${BUCKET}.s3.amazonaws.com" \
  -H "Date: ${dateValue}" \
  -H "Content-Type: ${contentType}" \
  -H "Authorization: AWS ${s3Key}:${signature}" \
  https://${BUCKET}.s3.amazonaws.com/${IP_FILE}

until [ -S ${SOCKET_PATH} ]
do
    sleep 1
done
echo "Found! ${SOCKET_PATH}"
socat TCP-LISTEN:4001,reuseaddr,fork UNIX-CONNECT:${SOCKET_PATH}
wait