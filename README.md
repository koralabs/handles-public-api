# handles-public-api
A downloadable and containerized decentralized API for Handles

<p align="center">
  <img src="./docs/handles-api.jpeg" />
</p>

<hr/>

# Getting Started
Run the following:
```sh
docker pull koralabs/handles-api
docker run -p 3141:3141 koralabs/handles-api
```

If you already have a cardano-node running, you can use the ogmios-only version: 
```sh
docker pull koralabs/handles-api-ogmios-only
docker run -p 3141:3141 -v <path_to_node.socket_folder>:/ipc koralabs/handles-api-ogmios-only:latest
```
(replace `<path_to_node.socket_folder>` with the path to your ipc node.socket on the host)

Open a browser to [http://localhost:3141/swagger](http://localhost:3141/swagger)
