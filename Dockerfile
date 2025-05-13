FROM ubuntu:22.04
ENV NETWORK=mainnet
WORKDIR /app
SHELL ["/bin/bash", "-c"]
ADD ./dist/ ./shell/entrypoint.sh ./shell/setup_env.sh deployment_info.json ./shell/install.sh ./
ENV CONFIG_FILES_BASE_URL=${CONFIG_FILES_BASE_URL}
RUN chmod +x install.sh && ./install.sh && chown -R root:root /app
EXPOSE 3141
STOPSIGNAL SIGINT
ENTRYPOINT [ "tini", "-g", "--", "./entrypoint.sh" ]