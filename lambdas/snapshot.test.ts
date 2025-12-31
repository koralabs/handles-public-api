const lambda = require("./snapshot");

const handleSnapshot = {
  slot: 20264741,
  hash: "82e5c62dd48bc17a2c9e198914769641ce9ea686e1f7f1bcc7b4a4d45cfad560",
  schemaVersion: 7,
  handles: {
    6767: {
      hex: "6767",
      name: "gg",
      holder_address:
        "addr_test1qpvaswzhusqpgufgwghvjkenwgrfuztksefaz4w2p69w79lan4acsu62leue4yrwmt6spxr8qzpkmw2vw59mlgr2jags0ucl69",
      length: 2,
      utxo: "419462470db9a59e4dd2c6be29f20c684d7a2851b916623f4df23f1cfe0ec1d7#1",
      rarity: "ultra_rare",
      characters: "letters",
      numeric_modifiers: "",
      resolved_addresses: {
        ada: "addr_test1qpvaswzhusqpgufgwghvjkenwgrfuztksefaz4w2p69w79lan4acsu62leue4yrwmt6spxr8qzpkmw2vw59mlgr2jags0ucl69",
      },
      og: 0,
      original_nft_image:
        "ipfs://QmRQx4bVWGejrNFQz8nab2V8CtAMpbnx1UZDFzaPYRVytk",
      nft_image: "ipfs://QmRQx4bVWGejrNFQz8nab2V8CtAMpbnx1UZDFzaPYRVytk",
      background: "",
      default_in_wallet: "gg",
      profile_pic: "",
      created_slot_number: 12445716,
      updated_slot_number: 15010347,
      hasDatum: true,
      datum: "a2some_datum",
    },
  },
  history: [],
};

jest.mock("proper-lockfile");
jest.mock("fs", () => {
  return {
    readFileSync: jest.fn(() => JSON.stringify(handleSnapshot)),
  };
});

const mockedS3Instance = {
  putObject: jest.fn(() => {
    return {
      promise: jest.fn(() => {
        return Promise.resolve("success");
      }),
    };
  }),
};

jest.mock("aws-sdk", () => {
  return {
    S3: jest.fn(() => mockedS3Instance),
  };
});

describe("lambda tests", () => {
  it("should process and create zip file", async () => {
    const putObjectSpy = jest.spyOn(mockedS3Instance, "putObject");
    const result = await lambda.handler();
    expect(result).toEqual({ body: "", statusCode: 200 });
    expect(putObjectSpy).toHaveBeenNthCalledWith(1, {
      Body: expect.any(Object),
      Bucket: "api.handle.me",
      Key: "mainnet/snapshot/7/handles.gz",
    });
    expect(putObjectSpy).toHaveBeenNthCalledWith(2, {
      Body: expect.any(Object),
      Bucket: "api.handle.me",
      Key: "mainnet/snapshot/7/handles-no-datum.gz",
    });
    expect(putObjectSpy).toHaveBeenNthCalledWith(3, {
      Body: expect.any(Object),
      Bucket: "api.handle.me",
      Key: "preview/snapshot/7/handles.gz",
    });
    expect(putObjectSpy).toHaveBeenNthCalledWith(4, {
      Body: expect.any(Object),
      Bucket: "api.handle.me",
      Key: "preview/snapshot/7/handles-no-datum.gz",
    });
    expect(putObjectSpy).toHaveBeenNthCalledWith(5, {
      Body: expect.any(Object),
      Bucket: "api.handle.me",
      Key: "preprod/snapshot/7/handles.gz",
    });
    expect(putObjectSpy).toHaveBeenNthCalledWith(6, {
      Body: expect.any(Object),
      Bucket: "api.handle.me",
      Key: "preprod/snapshot/7/handles-no-datum.gz",
    });
  });

  it("should remove datum from history", () => {
    const historyData = [
      [
        20264741,
        {
          "63617264616e6f6465762e616461": {
            old: {
              utxo: "7be2aef0070ad4e10dcbb4969fe39fd42e32d4422d6fc112e1f38b2b9591f50e#0",
              datum: undefined,
              hasDatum: false,
              updated_slot_number: 18977772,
            },
            new: {
              utxo: "614a102d81d1c86ba3c391e3de3165b73536ae51d418a6d4ec9de12a69d4b67a#1",
              datum: "a2some_datum",
              hasDatum: true,
              updated_slot_number: 20264741,
            },
          },
        },
      ],
    ];

    const updatedHistory = lambda.removeDatumFromHistory(historyData);
    expect(updatedHistory).toEqual([
      [
        20264741,
        {
          "63617264616e6f6465762e616461": {
            old: {
              utxo: "7be2aef0070ad4e10dcbb4969fe39fd42e32d4422d6fc112e1f38b2b9591f50e#0",
              datum: undefined,
              hasDatum: false,
              updated_slot_number: 18977772,
            },
            new: {
              utxo: "614a102d81d1c86ba3c391e3de3165b73536ae51d418a6d4ec9de12a69d4b67a#1",
              datum: undefined, // this should be undefined
              hasDatum: true,
              updated_slot_number: 20264741,
            },
          },
        },
      ],
    ]);
  });

  it("should remove datum from handles", () => {
    const updatedHandles = lambda.removeDatumFromHandles(
      handleSnapshot.handles
    );

    expect(updatedHandles["6767"].datum).toEqual(undefined);
  });
});
