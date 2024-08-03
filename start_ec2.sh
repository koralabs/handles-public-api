CW_INSTALL_FILE=./amazon-cloudwatch-agent.deb
if [ ! -f "$CW_INSTALL_FILE" ]; then
    sudo wget -q https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb -O amazon-cloudwatch-agent.deb;
    sudo dpkg -i -E ./amazon-cloudwatch-agent.deb;
    sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -m ec2 -a stop;
    sudo cp ./amazon-cloudwatch-agent.json /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json;
    sudo sed -i "s/{{CARDANO_NETWORK}}/${CARDANO_NETWORK}/gi" /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json;
    sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
        -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json;
fi

docker run -p 3001:3001 \
    -e ENABLE_SOCKET_REDIRECT=true \
    -e MODE=cardano-node \
    -e NETWORK=preview \
    -e NODE_DB=/mnt/efs/cardano/preview/db \
    -e SOCKET_PATH=/mnt/efs/cardano/preview/ipc/node.socket \
    --health-cmd="pidof cardano-node || exit 1" \
    --health-interval=30 \
    --health-retries=3 \
    --health-start-period=60 \
    --restart=always \
    koralabs/handles-api --include-transaction-cbor