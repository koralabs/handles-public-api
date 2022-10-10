FROM cardano-node-ogmios-nodejs:latest as handles-public-api

WORKDIR /app
ADD ./dist/* .

SHELL ["/bin/bash", "-c"]

RUN chmod +x entrypoint.sh

ENTRYPOINT [ "/app/entrypoint.sh" ]