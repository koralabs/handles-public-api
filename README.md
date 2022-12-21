# Decentralized Public API for Handles

<p align="center">
  <img src="./docs/handles-api.jpeg" />
</p>

Our Decentralized API uses Ogmios to scan a cardano-node for Handles related transactions. The information is stored in a custom, in-memory index for quick reads. We take a snapshot of the index once a day. This snapshot is loaded each time the container starts to decrease load times.

&nbsp;


# Getting Started

### Prerequisites
- Install Docker - https://docs.docker.com/get-docker/


### Run the following:
```sh
docker pull koralabs/handles-api
docker run -p 3141:3141 -v db:/db koralabs/handles-api
```
- The `-v db:/db` and the `-v handles:/handles` in the command above can be omitted, but we recommeded it so the `cardano-node` db and handle scan progress is saved to the host when the container goes down.
- You can also map a volume to the node socket with `-v <path_to_socket_folder>:/ipc`. This lets you use the cardano-node with other apps outside the container.

&nbsp;

### If you already have a cardano-node running, you can use the ogmios-only version: 
```sh
docker pull koralabs/handles-api
docker run -p 3141:3141 -v <path_to_node.socket_folder>:/ipc -v handles:/handles -e MODE=ogmios koralabs/handles-api:latest
```

- Replace `<path_to_socket_folder>` with the path to your ipc folder on the host that has the node.socket file

&nbsp;

# Testing the API 
- Open a browser to [http://localhost:3141/swagger](http://localhost:3141/swagger)
- You can also see the current API status at [http://localhost:3141/health](http://localhost:3141/health)
- 🚩WARNING: The health endpoint will return a <span style="color:red">202</span> when it is running but the scan hasn't reached the tip of the chain yet. It is not recommended to use the results until a <span style="color:green">200</span> status is returned.

&nbsp;

## TESTNET ENVIRONMENTS
To use Preview or PreProd environments just add `-e NETWORK=preview` or `-e NETWORK=preprod` to either of the `docker run` commands.


## NOTES

It can take a few hours to download the cardano-node snapshot and begin an Ogmios scan.

A minimum of 16GB of RAM is required when running the container - 20GB recommended. If running in Ogmios-only mode, 4GB minimum is required, 8GB recommended.

The containers are setup for graceful cardano-node shutdown, but if you have to shut it down manually, for a more graceful shutdown (which helps subsequent load times), try running on the host (or in the container):
```sh
kill -SIGINT $(pidof cardano-node) 
```