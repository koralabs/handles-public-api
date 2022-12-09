# A downloadable and containerized decentralized API for Handles

<p align="center">
  <img src="./docs/handles-api.jpeg" />
</p>

Our Decentralized API uses Ogmios to scan a cardano-node for Handles related transactions. The information is stored in a custom, in-memory index for quick reads. We take a snapshot of the index once a day. This snapshot is loaded each time the container starts to decrease load times.

&nbsp;


# Getting Started

### Run the following:
```sh
docker pull koralabs/handles-api
docker run -p 3141:3141 -v ./handles-api/db:/db koralabs/handles-api
```
- The `-v ./handles-api/db:/db` in the command above can be omitted, but we recommeded it so the `cardano-node` db progress is saved to the host when the container goes down.
- You can also map a volume to the node socket with `-v <path_to_socket_folder>:/ipc`

&nbsp;

### If you already have a cardano-node running, you can use the ogmios-only version: 
```sh
docker pull koralabs/handles-api-ogmios-only
docker run -p 3141:3141 -v <path_to_node.socket_folder>:/ipc koralabs/handles-api-ogmios-only:latest
```

- Replace `<path_to_socket_folder>` with the path to your ipc folder on the host that has the node.socket file

&nbsp;

## Open a browser to [http://localhost:3141/swagger](http://localhost:3141/swagger)
You can also see the current API status at [http://localhost:3141/health](http://localhost:3141/health)

&nbsp;

----

### NOTES

It can take a few hours to download the cardano-node snapshot and begin an Ogmios scan.

Due to JavaScript garbage collection during the Ogmios scan, it is recommnded to run this container on a host with 12GB or more of RAM available.

For a more graceful shutdown of cardano-node (which helps subsequent load times), try running on the host (or in the container):
```sh
kill -SIGINT $(pidof cardano-node) 
```