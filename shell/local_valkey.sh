#!/bin/bash
set -eu
set -a && source .env && set +a
if ! pgrep -x "valkey-server" > /dev/null
then
    if [ "$(printf '%s\n' 24.04 "$(lsb_release -rs)" | sort -V | head -n1)" = "24.04" ]
    then
        echo "Starting Valkey - connecting to 6379"
        sudo apt install valkey
        sudo systemctl enable valkey-server
    else
        echo "You need to update your version of Ubuntu to at least 24.04 to install and run Valkey"
    fi
fi
