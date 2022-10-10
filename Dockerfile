FROM cardano-node-ogmios-nodejs:latest as handles-public-api

WORKDIR /app
ADD . .

SHELL ["/bin/bash", "-c"]

RUN chmod +x entrypoint.sh

ENTRYPOINT [ "/app/entrypoint.sh" ]