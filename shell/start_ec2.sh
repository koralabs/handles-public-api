#! /bin/bash
set -eu

if [ -z "$NETWORKS" ]; then
    echo "NETWORKS must be set (i.e. 'preview,preprod' or just 'mainnet')"
    exit 1
fi

if [ -z "$RELEASE" ]; then
    echo "Setting RELEASE to latest"
    RELEASE=latest
fi


# INSTALL DOCKER IF NOT INSTALLED
if ! [ -x "$(command -v docker)" ]; then
    echo "docker not detected - installing..."

    # Add Docker's official GPG key:
    sudo apt-get update -y
    sudo apt-get install -y ca-certificates curl
    sudo install -m 0755 -d /etc/apt/keyrings
    sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    sudo chmod a+r /etc/apt/keyrings/docker.asc

    # Add the repository to Apt sources:
    echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
    sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    docker --version
fi

# INSTALL AWS Cloudwatch Agent IF NOT INSTALLED
CW_INSTALL_FILE=./amazon-cloudwatch-agent.deb
if [ ! -f "$CW_INSTALL_FILE" ]; then
    mkdir -p /home/ubuntu/.forever
    echo "Cloudwatch Agent not detected - installing..."
    sudo wget -q https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb -O amazon-cloudwatch-agent.deb;
    sudo dpkg -i -E ./amazon-cloudwatch-agent.deb;
    sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -m ec2 -a stop;
    
    for net in ${NETWORKS//,/ }
    do
        LOG_FILES="${LOG_FILES:-}{\"file_path\":\"/home/ubuntu/.forever/**.log\",\"log_group_name\":\"/koralabs/cardano-node/${net}\",\"log_stream_name\":\"{instance_id}\"},"
    done
    echo '{ "agent": { "metrics_collection_interval": 60, "run_as_user": "root" }, "logs": { "logs_collected": { "files": { "collect_list": [${LOG_FILES}]}}}}' > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
    sudo sed -i "s/{{NETWORK}}/${NETWORK}/gi" /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json;
    sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
        -a fetch-config -m ec2 -s \
        -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json;
fi

for net in ${NETWORKS//,/ }
do
    docker run -p 3001:3001 \
        --name "cardano-node-${net}" \
        -e ENABLE_SOCKET_REDIRECT=true \
        -e MODE=cardano-node \
        -e NETWORK=${net} \
        -v /home/ubuntu/.forever:/app/.forever \
        -v /mnt/efs/cardano/${net}/db:/db \
        -v /mnt/efs/cardano/${net}/ipc:/ipc \
        --health-cmd="pidof cardano-node || exit 1" \
        --health-interval=30 \
        --health-retries=3 \
        --health-start-period=60 \
        --restart=always \
        koralabs/handles-api --include-transaction-cbor
done

# docker stop cardano-node-${net}
# docker pull koralabs/handles-api