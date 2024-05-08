FROM ubuntu:22.04
ENV NETWORK=mainnet
WORKDIR /app
SHELL ["/bin/bash", "-c"]
ADD ./dist/ entrypoint.sh setup_env.sh deployment_info.json ./
RUN \
    CARDANO_NODE_VER=8.9.1 && \
    apt install -y && apt update -y && apt install -y git curl socat jq unzip tini lz4 zstd && \
    curl -fsSL https://github.com/IntersectMBO/cardano-node/releases/download/${CARDANO_NODE_VER}/cardano-node-${CARDANO_NODE_VER}-linux.tar.gz | tar -xz && \
    rm -f ./cardano-node-${CARDANO_NODE_VER}-linux.tar.gz && \
    cp ./bin/* ./ && \
    chmod +x ./cardano-node && chmod +x ./entrypoint.sh && mkdir -p /ipc && mkdir -p handles && touch handles/handles.json && \
    git clone https://github.com/IntersectMBO/cardano-world.git && \
    curl -sL https://github.com/CardanoSolutions/ogmios/releases/download/v5.6.0/ogmios-v5.6.0-x86_64-linux.zip -o ogmios.zip && \
    unzip ogmios.zip -d ./ogmios-install && rm ogmios.zip && \
    cp ./ogmios-install/bin/ogmios /bin/ogmios && chmod +x /bin/ogmios && rm -rf ./ogmios-install && \
    curl -fsSL https://deb.nodesource.com/setup_16.x | bash - && apt install -y nodejs && \
    chown -R root:root /app
EXPOSE 3141
STOPSIGNAL SIGINT
ENTRYPOINT [ "tini", "-g", "--", "./entrypoint.sh" ]