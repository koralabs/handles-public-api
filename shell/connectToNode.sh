NETWORK=${NETWORK:-mainnet}

echo "${LAMBDA_DOWNLOAD_URL}/${NETWORK}-node.ip"
curl -s ${LAMBDA_DOWNLOAD_URL}/${NETWORK}-node.ip > ./tmp/${NETWORK}-node.ip
SOCAT_PID=$(lsof -t node.socket 2>/dev/null || echo '')
if [ ! -z ${SOCAT_PID} ]; then
    echo "Previous node.socket found for ${NETWORK}. Killing and deleting."
    kill -9 ${SOCAT_PID}
fi
rm -f node.socket
NODE_SOCKET_IP=${NODE_SOCKET_IP:-$(cat "tmp/${NETWORK}-node.ip")}
CARDANO_NODE_IP=${CARDANO_NODE_IP:-$NODE_SOCKET_IP}
socat UNIX-LISTEN:node.socket,fork TCP-CONNECT:${CARDANO_NODE_IP:-}:4001 &
[ $? -eq 0 ] && echo "Connected to ${NETWORK} node socket at ${CARDANO_NODE_IP}" || echo "socat failed to start"