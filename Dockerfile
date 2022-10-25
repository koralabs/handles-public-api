#                                                                              #
# ------------------------- WITH CARDANO-NODE  ------------------------------- #
#                                                                              #

FROM cardano-node-ogmios-nodejs:latest as handles-api
WORKDIR /app
ADD ./dist/ ./
ADD entrypoint-node.sh ./entrypoint.sh

SHELL ["/bin/bash", "-c"]

RUN chmod +x entrypoint.sh

EXPOSE 3141

STOPSIGNAL SIGINT
ENTRYPOINT [ "/app/entrypoint.sh" ]

#                                                                              #
# ---------------------------- OGMIOS ONLY  ---------------------------------- #
#                                                                              #

FROM ogmios-nodejs:latest as handles-api-ogmios-only
WORKDIR /app
ADD ./dist/ ./
ADD entrypoint-ogmios.sh ./entrypoint.sh

SHELL ["/bin/bash", "-c"]

RUN chmod +x entrypoint.sh

EXPOSE 3141
HEALTHCHECK --interval=10s --timeout=5s --retries=1 CMD /bin/ogmios health-check

STOPSIGNAL SIGINT
ENTRYPOINT [ "/app/entrypoint.sh" ]