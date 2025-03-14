set -eu

CARDANO_NODE_VER=${CARDANO_NODE_VER:-10.1.4}
OGMIOS_VER=${OGMIOS_VER:-6.11.0}
CONFIG_FILES_BASE_URL=${CONFIG_FILES_BASE_URL:-'https://book.world.dev.cardano.org/environments'}
apt install -y && apt update -y && apt install -y git curl socat jq unzip tini lz4 zstd
curl -fsSL https://github.com/IntersectMBO/cardano-node/releases/download/${CARDANO_NODE_VER}/cardano-node-${CARDANO_NODE_VER}-linux.tar.gz | tar -xz
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
rm -f ./cardano-node-${CARDANO_NODE_VER}-linux.tar.gz
cp ./bin/* ./
chmod +x ./cardano-node && chmod +x ./entrypoint.sh && mkdir -p /ipc && mkdir -p handles && touch handles/handles.json
BASE_URL=${CONFIG_FILES_BASE_URL}
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
curl -sL https://github.com/CardanoSolutions/ogmios/releases/download/v${OGMIOS_VER}/ogmios-v${OGMIOS_VER}-x86_64-linux.zip -o ogmios.zip
unzip ogmios.zip -d ./ogmios-install && rm ogmios.zip
cp ./ogmios-install/bin/ogmios /bin/ogmios && chmod +x /bin/ogmios && rm -rf ./ogmios-install
source ~/.nvm/nvm.sh
export TMPDIR=/tmp
nvm install 21
nvm use 21
echo "NodeJS Version is $(node -v)"