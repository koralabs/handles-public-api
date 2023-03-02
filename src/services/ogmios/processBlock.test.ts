import { Rarity } from '@koralabs/handles-public-api-interfaces';
import { Logger } from '@koralabs/kora-labs-common';
import { BlockTip, MetadatumAssetLabel, TxBlock, TxMetadata } from '../../interfaces/ogmios.interfaces';
import { HandleStore } from '../../repositories/memory/HandleStore';
import { processBlock } from './processBlock';
import * as ipfs from '../../utils/ipfs';
import { Handle } from '../../repositories/memory/interfaces/handleStore.interfaces';

jest.mock('../../repositories/memory/HandleStore');

describe('processBlock Tests', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    const tip: BlockTip = {
        slot: 0,
        hash: 'some_hash',
        blockNo: 0
    };

    const policyId = '123';
    const hexName = '7465737431323334';
    const name = 'test1234';

    const metadata = (policy: string, handleName: string): TxMetadata => ({
        body: {
            blob: {
                721: {
                    map: [
                        {
                            k: {
                                string: policy
                            },
                            v: {
                                map: [
                                    {
                                        k: {
                                            string: handleName
                                        },
                                        v: {
                                            map: [
                                                {
                                                    k: {
                                                        string: 'image'
                                                    },
                                                    v: {
                                                        string: `ifps://some_hash_${handleName}`
                                                    }
                                                },
                                                {
                                                    k: {
                                                        string: 'core'
                                                    },
                                                    v: {
                                                        map: [
                                                            {
                                                                k: {
                                                                    string: 'og'
                                                                },
                                                                v: {
                                                                    int: BigInt(1)
                                                                }
                                                            }
                                                        ]
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                ]
                            }
                        }
                    ]
                }
            }
        }
    });

    const txBlock = ({
        address = 'addr123',
        policy = policyId,
        handleHexName = hexName,
        handleName = name,
        isMint = true,
        datum = undefined,
        isBurn = false,
        slot = 0
    }: {
        address?: string | undefined;
        policy?: string | undefined;
        handleHexName?: string | undefined;
        handleName?: string | undefined;
        isMint?: boolean | undefined;
        datum?: string;
        isBurn?: boolean;
        slot?: number;
    }) => ({
        babbage: {
            body: [
                !isBurn
                    ? {
                          id: 'some_id',
                          body: {
                              outputs: [
                                  {
                                      datum,
                                      address,
                                      value: {
                                          coins: 1,
                                          assets: {
                                              [`${`${policy}.${handleHexName}`}`]: 1
                                          }
                                      }
                                  }
                              ],
                              mint: isMint
                                  ? {
                                        coins: 1,
                                        assets: {
                                            [`${`${policy}.${handleHexName}`}`]: 1
                                        }
                                    }
                                  : {}
                          },
                          metadata: metadata(policy, handleName)
                      }
                    : {
                          id: 'some_id_2',
                          body: {
                              outputs: [
                                  {
                                      datum,
                                      address,
                                      value: {
                                          coins: 1,
                                          assets: {}
                                      }
                                  }
                              ],
                              mint: {
                                  coins: 0,
                                  assets: {
                                      [`${`${policy}.${handleHexName}`}`]: BigInt(-1)
                                  }
                              }
                          },
                          metadata: null
                      }
            ],
            headerHash: 'some_hash',
            header: {
                slot,
                blockHash: 'some_block_hash'
            }
        }
    });

    const expectedItem: Handle = {
        characters: 'letters,numbers',
        hex: hexName,
        holder_address: 'some_stake1',
        length: 8,
        name,
        nft_image: 'some_hash_test1234',
        utxo: 'utxo1#0',
        numeric_modifiers: '',
        og: 1,
        original_nft_image: 'some_hash_test1234',
        rarity: Rarity.basic,
        resolved_addresses: { ada: 'addr123' },
        default_in_wallet: 'some_hdl',
        profile_pic: 'some_hash_test1234',
        background: 'some_hash_test1234',
        created_slot_number: Date.now(),
        updated_slot_number: Date.now(),
        hasDatum: false,
        amount: 1
    };

    it('Should save a new handle to the datastore and set metrics', async () => {
        const saveSpy = jest.spyOn(HandleStore, 'saveMintedHandle');
        const setMetricsSpy = jest.spyOn(HandleStore, 'setMetrics');
        jest.spyOn(HandleStore, 'getTimeMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });

        await processBlock({ policyId, txBlock: txBlock({}) as TxBlock, tip });

        expect(saveSpy).toHaveBeenCalledWith({
            adaAddress: 'addr123',
            hex: '7465737431323334',
            image: 'ifps://some_hash_test1234',
            name: 'test1234',
            og: 1,
            slotNumber: 0,
            utxo: 'some_id#0'
        });

        expect(setMetricsSpy).toHaveBeenNthCalledWith(1, {
            currentBlockHash: 'some_hash',
            currentSlot: 0,
            lastSlot: 0
        });

        expect(setMetricsSpy).toHaveBeenNthCalledWith(2, { elapsedBuildingExec: expect.any(Number) });
    });

    it('Should save datum', async () => {
        const datum = 'a2some_datum';
        const saveSpy = jest.spyOn(HandleStore, 'saveMintedHandle');

        jest.spyOn(HandleStore, 'getTimeMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });

        await processBlock({ policyId, txBlock: txBlock({ datum }) as TxBlock, tip });

        expect(saveSpy).toHaveBeenCalledWith({
            adaAddress: 'addr123',
            hex: '7465737431323334',
            image: 'ifps://some_hash_test1234',
            name: 'test1234',
            og: 1,
            slotNumber: 0,
            utxo: 'some_id#0',
            datum
        });
    });

    it('Should update a handle when it is not a mint', async () => {
        const newAddress = 'addr456';
        const saveHandleUpdateSpy = jest.spyOn(HandleStore, 'saveHandleUpdate');
        jest.spyOn(HandleStore, 'setMetrics');
        jest.spyOn(HandleStore, 'getTimeMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });
        jest.spyOn(HandleStore, 'get').mockReturnValue(expectedItem);

        await processBlock({ policyId, txBlock: txBlock({ address: newAddress, isMint: false }) as TxBlock, tip });

        expect(saveHandleUpdateSpy).toHaveBeenCalledWith({
            adaAddress: newAddress,
            hex: hexName,
            name,
            slotNumber: 0,
            utxo: 'some_id#0'
        });
    });

    it('Should not save anything if policyId does not match', async () => {
        const saveSpy = jest.spyOn(HandleStore, 'saveMintedHandle');
        const saveAddressSpy = jest.spyOn(HandleStore, 'saveHandleUpdate');

        await processBlock({ policyId, txBlock: txBlock({ policy: 'no-ada-handle' }) as TxBlock, tip });

        expect(saveSpy).toHaveBeenCalledTimes(0);
        expect(saveAddressSpy).toHaveBeenCalledTimes(0);
    });

    it('Should process 222 asset class token mint', async () => {
        const handleName = `burritos`;
        const handleHexName = `${MetadatumAssetLabel.SUB_STANDARD_NFT}${Buffer.from(handleName).toString('hex')}`;
        const saveSpy = jest.spyOn(HandleStore, 'saveMintedHandle');
        jest.spyOn(HandleStore, 'getTimeMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });

        await processBlock({
            policyId,
            txBlock: txBlock({ handleHexName }) as TxBlock,
            tip
        });

        expect(saveSpy).toHaveBeenCalledWith({
            adaAddress: 'addr123',
            datum: undefined,
            hex: `${MetadatumAssetLabel.SUB_STANDARD_NFT}6275727269746f73`,
            image: '',
            name: handleName,
            og: 0,
            slotNumber: 0,
            utxo: 'some_id#0'
        });
    });

    it('Should process 222 update', async () => {
        const handleName = `burritos`;
        const handleHexName = `${MetadatumAssetLabel.SUB_STANDARD_NFT}${Buffer.from(handleName).toString('hex')}`;
        const saveHandleUpdateSpy = jest.spyOn(HandleStore, 'saveHandleUpdate');
        jest.spyOn(HandleStore, 'getTimeMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });

        await processBlock({
            policyId,
            txBlock: txBlock({ handleHexName, isMint: false }) as TxBlock,
            tip
        });

        expect(saveHandleUpdateSpy).toHaveBeenCalledWith({
            adaAddress: 'addr123',
            datum: undefined,
            hex: `${MetadatumAssetLabel.SUB_STANDARD_NFT}6275727269746f73`,
            name: 'burritos',
            slotNumber: 0,
            utxo: 'some_id#0'
        });
    });

    it('Should process 100 asset class tokens', async () => {
        const handleName = `burritos`;
        const handleHexName = `${MetadatumAssetLabel.REFERENCE_NFT}${Buffer.from(handleName).toString('hex')}`;

        const savePersonalizationChangeSpy = jest.spyOn(HandleStore, 'savePersonalizationChange');
        jest.spyOn(HandleStore, 'getTimeMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });
        jest.spyOn(ipfs, 'decodeCborFromIPFSFile').mockResolvedValue({ test: 'data' });

        await processBlock({
            policyId,
            txBlock: txBlock({
                handleHexName,
                isMint: false,
                datum: 'd8799fbf446e616d654a24742d646174756d2d3145696d6167655835697066733a2f2f516d62514561755a5243503233765369487058314d33636a6d694134715075437068594663763436617a4c4b6d41496d656469615479706549696d6167652f706e67426f674566616c736546726172697479456261736963466c656e67746841394e6368617261637465725f74797065576c6574746572732c6e756d626572732c7370656369616c506e756d657269635f6d6f646966696572404776657273696f6e4131ff01bf4c637573746f6d5f696d616765404862675f696d61676540497066705f696d616765404873657474696e67735835697066733a2f2f516d5846324d33676857794431357a5474457145574452466e5163754456635a6a426154564c643366544d33356747736f6369616c735835697066733a2f2f516d524a444a4134663846646d6b635772413552594348726d3736714c7a6a6271377239726d384777364c7662724676656e646f72404764656661756c74447472756546686f6c64657240ffff'
            }) as TxBlock,
            tip
        });

        expect(savePersonalizationChangeSpy).toHaveBeenCalledWith({
            addresses: {},
            customImage: '',
            hex: handleHexName,
            name: handleName,
            personalization: {
                social_links: {
                    test: 'data'
                }
            },
            setDefault: 'true',
            slotNumber: 0
        });
    });

    // TODO: add test to validate datum

    it('Should log error for 100 asset token when there is no datum', async () => {
        const handleName = `burritos`;
        const handleHexName = `${MetadatumAssetLabel.REFERENCE_NFT}${Buffer.from(handleName).toString('hex')}`;
        const savePersonalizationChangeSpy = jest.spyOn(HandleStore, 'savePersonalizationChange');
        const loggerSpy = jest.spyOn(Logger, 'log');
        jest.spyOn(HandleStore, 'getTimeMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });

        await processBlock({
            policyId,
            txBlock: txBlock({ handleHexName, isMint: false }) as TxBlock,
            tip
        });

        expect(savePersonalizationChangeSpy).toHaveBeenCalledTimes(0);
        expect(loggerSpy).toHaveBeenCalledWith({
            category: 'ERROR',
            event: 'processBlock.processAssetReferenceToken.noDatum',
            message: 'no datum for reference token 123.000643b06275727269746f73'
        });
    });

    it('Should burn tokens', async () => {
        const slot = 1234;
        const handleName = `burritos`;
        const handleHexName = `${MetadatumAssetLabel.REFERENCE_NFT}${Buffer.from(handleName).toString('hex')}`;
        const burnHandleSpy = jest.spyOn(HandleStore, 'burnHandle').mockImplementation();
        jest.spyOn(HandleStore, 'getTimeMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });

        await processBlock({
            policyId,
            txBlock: txBlock({ handleHexName, isBurn: true, slot }) as TxBlock,
            tip
        });

        expect(burnHandleSpy).toHaveBeenCalledWith(handleName, slot);
    });
});
