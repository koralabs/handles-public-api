FROM ubuntu:22.04
ENV NETWORK=mainnet
WORKDIR /app
SHELL ["/bin/bash", "-c"]
ADD ./dist/ entrypoint.sh setup_env.sh deployment_info.json ./
# ADD ./config.json ./topology.json ./preprod/
RUN \
    CARDANO_NODE_VER=9.1.0 && \
    OGMIOS_VER=6.5.0 && \
    apt install -y && apt update -y && apt install -y git curl socat jq unzip tini lz4 zstd && \
    curl -fsSL https://github.com/IntersectMBO/cardano-node/releases/download/${CARDANO_NODE_VER}/cardano-node-${CARDANO_NODE_VER}-linux.tar.gz | tar -xz && \
    rm -f ./cardano-node-${CARDANO_NODE_VER}-linux.tar.gz && \
    cp ./bin/* ./ && \
    chmod +x ./cardano-node && chmod +x ./entrypoint.sh && mkdir -p /ipc && mkdir -p handles && touch handles/handles.json && \
    BASE_URL="https://book.world.dev.cardano.org/environments" && \
    declare -a NETWORKS=(preview preprod mainnet) && \
    declare -a ERAS=(byron shelley alonzo conway) && \
    for net in "${NETWORKS[@]}"; \
    do \
        mkdir -p ${net} && \
        curl -sL ${BASE_URL}/${net}/config.json -o ${net}/config.json && \
        curl -sL ${BASE_URL}/${net}/topology.json -o ${net}/topology.json && \
        for era in "${ERAS[@]}"; \
        do \
            curl -sL ${BASE_URL}/${net}/${era}-genesis.json -o ${net}/${era}-genesis.json; \
        done; \
    done && \
    curl -sL https://github.com/CardanoSolutions/ogmios/releases/download/v${OGMIOS_VER}/ogmios-v${OGMIOS_VER}-x86_64-linux.zip -o ogmios.zip && \
    unzip ogmios.zip -d ./ogmios-install && rm ogmios.zip && \
    cp ./ogmios-install/bin/ogmios /bin/ogmios && chmod +x /bin/ogmios && rm -rf ./ogmios-install && \
    curl -fsSL https://deb.nodesource.com/setup_16.x | bash - && apt install -y nodejs && \
    chown -R root:root /app
EXPOSE 3141
STOPSIGNAL SIGINT
ENTRYPOINT [ "tini", "-g", "--", "./entrypoint.sh" ]