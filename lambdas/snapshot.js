const fs = require("fs");
const AWS = require("aws-sdk");
const lockfile = require("proper-lockfile");
const zlib = require("zlib");
const https = require("https");
const FUNCTION_URL = "jm7bswgkv7ivy4vrr5vjwanvne0osacj.lambda-url.us-east-1.on.aws";

const ecs = new AWS.ECS({region: 'us-west-2'})
const ec2 = new AWS.EC2({region: 'us-west-2'})
const s3  = new AWS.S3({region: 'us-west-2'})

exports.handler = async (event) => {
  const networks = ["mainnet", "preview", "preprod"];
  for (let i = 0; i < networks.length; i++) {
    try {
      const network = networks[i];
      const path = `/mnt/efs/storage/${network}/snapshot/handles.json`;
      const isLocked = await lockfile.check(path);
      if (isLocked) {
        console.log("File is locked");

        return {
          statusCode: 400,
          body: `File locked at path: ${path}`,
        };
      }
      const file = fs.readFileSync(path, { encoding: "utf8" });
      const fileJson = JSON.parse(file);
      const { schemaVersion = 1 } = fileJson;
      const fileName = `${network}/snapshot/${schemaVersion}/handles.gz`;
      const fileNameWithoutDatum = `${network}/snapshot/${schemaVersion}/handles-no-datum.gz`;
      const fileJSONWithoutDatum = {
        ...fileJson,
        handles: removeDatumFromHandles(fileJson.handles),
        history: removeDatumFromHistory(fileJson.history),
      };

      const filesData = [
        {
          Key: fileName,
          Body: zlib.deflateSync(JSON.stringify(fileJson)),
        },
        {
          Key: fileNameWithoutDatum,
          Body: zlib.deflateSync(JSON.stringify(fileJSONWithoutDatum)),
        },
      ];
      
      const s3Result = await Promise.all(
        filesData.map(({ Key, Body }) => {
          const params = {
            Bucket: "api.handle.me",
            Key,
            Body,
          };
          return s3.putObject(params).promise();
        })
      );

      console.log(`s3Result ${JSON.stringify(s3Result)}`);
    } catch (error) {
      console.log(`There was an error: ${error.message}`);
    }
  }

  try {
    for (let i = 0; i< networks.length; i++) {
      let network = networks[i];
      await getContainerIP(`cardano-node${network == 'mainnet' ? '' : '-'+network}`).then(async (ip) =>  {
        console.log("Container IP address is: ", ip);
        await writeBinaryPostData(ip, `${network}-node.ip`);
      }).catch(err => {
        console.log(err);
      });
    }
  } catch (error) {
    console.log("There was an error:", error);
  }

  return {
    statusCode: 200,
    body: "",
  };
};

const removeDatumFromHistory = (historyData) => {
  {
    const history = new Map(historyData);
    const updatedHistory = new Map();

    for ([slot, historyItems] of history) {
      const updatedHistoryItems = Object.entries(historyItems).reduce(
        (acc, [k, v]) => {
          acc[k] = {
            new: {
              ...v.new,
              datum: undefined,
            },
            old: {
              ...v.old,
              datum: undefined,
            },
          };
          return acc;
        },
        {}
      );
      updatedHistory.set(slot, updatedHistoryItems);
    }

    return Array.from(updatedHistory);
  }
};

const removeDatumFromHandles = (handlesData) => {
  return Object.keys(handlesData).reduce((acc, hexKey) => {
    acc[hexKey] = {
      ...handlesData[hexKey],
      datum: undefined,
    };

    return acc;
  }, {});
};

exports.removeDatumFromHistory = removeDatumFromHistory;
exports.removeDatumFromHandles = removeDatumFromHandles;

const writeBinaryPostData = (data, filename) => {
  return new Promise((resolve, reject) => {
    try {
      console.log("uploading to", filename);

      var crlf = "\r\n",
        boundaryKey = Math.random().toString(16),
        boundary = `--${boundaryKey}`,
        headers = [`Content-Disposition: form-data; name="file"; filename="${filename}"${crlf}`],
        multipartBody;

      multipartBody = Buffer.concat([
        new Buffer.from(boundary + crlf + headers.join("") + crlf),
        Buffer.from(data),
        new Buffer.from(`${boundary}--`),
      ]);

      var options = {
        hostname: FUNCTION_URL,
        path: `/save-file/${filename}`,
        method: "POST",
        headers: {
          "Content-Type": "multipart/form-data; boundary=" + boundary,
          "Content-Length": multipartBody.length,
          "User-Agent": "HandleApiDataExporter",
        },
      };
      
      var req = https.request(options, (res) => {
        console.log("statusCode:", res.statusCode);
        res.on("end", (d) => { resolve(d); });
        res.on("data", (d) => { });
        res.on("error", (e) => { reject(e); });
      });

      req.on("error", (e) => { reject(e); });
      req.write(multipartBody);
      req.end();
      
    } catch (error) {
      reject(error);
    }
  });
};

function getContainerIP(servicename) {
  // note: assumes that only 1 task with 1 container is in the provided service, and that a container only has 1 network interface

  console.log(servicename)
  return new Promise(function (resolve, reject) {
    ecs.listTasks({
      cluster: 'api-handle-me',
      launchType: "FARGATE",
      serviceName: servicename
    }, function (err, res) {
      if (err) {
        reject("Unable to get task list: " + err);
        return;
      }

      if (!res.taskArns.length) {
        reject(`No tasks found in ${servicename}`)
        return;
      }

      getTaskDetails(res.taskArns);
    });

    function getTaskDetails(taskArns) {
      ecs.describeTasks({
        cluster: 'api-handle-me',
        tasks: taskArns
      }, function (err, res) {
        if (err) {
          reject("Unable to get task details");
          return;
        }

        // no results
        if (!res.tasks.length || !res.tasks[0].attachments.length) {
          reject("No tasks available");
          return;
        }

        // get network ID from result
        let eni = "";
        for (let i in res.tasks[0].attachments[0].details) {
          if (!res.tasks[0].attachments[0].details.hasOwnProperty(i)) continue;
          if (res.tasks[0].attachments[0].details[i].name !== "networkInterfaceId") continue;

          // get the eni
          eni = res.tasks[0].attachments[0].details[i].value;
          break;
        }

        // no eni
        if (eni === "") {
          reject("Unable to retrieve container ENI");
          return;
        }

        // get network details
        getNetworkDetails(eni);
      });
    }

    // get network details
    function getNetworkDetails(eni) {

      // get the ENI details
      ec2.describeNetworkInterfaces({
        NetworkInterfaceIds: [eni]
      }, function (err, res) {
        if (err) {
          reject("Unable to retrieve ENI details");
          return;
        }

        // confirm available data
        if (!res.NetworkInterfaces.length || typeof res.NetworkInterfaces[0].Association === "undefined" || typeof res.NetworkInterfaces[0].Association.PublicIp === "undefined") {
          reject("Unable to retrieve IP from ENI details");
          return;
        }

        // resolve the public IP address
        resolve(res.NetworkInterfaces[0].Association.PublicIp);
      });
    }
  });
}