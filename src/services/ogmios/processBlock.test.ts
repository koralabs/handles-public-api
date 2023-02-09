import { IHandle, Rarity } from '@koralabs/handles-public-api-interfaces';
import { BlockTip, TxBlock, TxMetadata } from '../../interfaces/ogmios.interfaces';
import { HandleStore } from '../../repositories/memory/HandleStore';
import { processBlock } from './processBlock';

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
        datum = undefined
    }: {
        address?: string | undefined;
        policy?: string | undefined;
        handleHexName?: string | undefined;
        handleName?: string | undefined;
        isMint?: boolean | undefined;
        datum?: string;
    }) => ({
        babbage: {
            body: [
                {
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
            ],
            headerHash: 'some_hash',
            header: {
                slot: 0,
                blockHash: 'some_block_hash'
            }
        }
    });

    const expectedItem: IHandle = {
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
        hasDatum: false
    };

    it('Should save a new handle to the datastore and set metrics', async () => {
        const saveSpy = jest.spyOn(HandleStore, 'saveMintedHandle');
        const setMetricsSpy = jest.spyOn(HandleStore, 'setMetrics');
        jest.spyOn(HandleStore, 'getTimeMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });

        await processBlock({ policyId, txBlock: txBlock({}) as TxBlock, tip });

        expect(saveSpy).toHaveBeenCalledWith({
            adaAddress: 'addr123',
            hexName: '7465737431323334',
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

    it('Should save datum if ENABLE_DATUM_ENDPOINT is enabled', async () => {
        const datum = 'a2some_datum';
        const saveSpy = jest.spyOn(HandleStore, 'saveMintedHandle');

        jest.spyOn(HandleStore, 'getTimeMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });

        await processBlock({ policyId, txBlock: txBlock({ datum }) as TxBlock, tip });

        expect(saveSpy).toHaveBeenCalledWith({
            adaAddress: 'addr123',
            hexName: '7465737431323334',
            image: 'ifps://some_hash_test1234',
            name: 'test1234',
            og: 1,
            slotNumber: 0,
            utxo: 'some_id#0',
            datum
        });
    });

    it('Should not save a new handle because it already exists in store', async () => {
        const newAddress = 'addr456';
        const saveSpy = jest.spyOn(HandleStore, 'saveHandleUpdate');
        jest.spyOn(HandleStore, 'setMetrics');
        jest.spyOn(HandleStore, 'getTimeMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });
        jest.spyOn(HandleStore, 'get').mockReturnValue(expectedItem);

        await processBlock({ policyId, txBlock: txBlock({ address: newAddress, isMint: false }) as TxBlock, tip });

        expect(saveSpy).toHaveBeenCalledWith({
            adaAddress: newAddress,
            hexName,
            slotNumber: 0,
            utxo: 'some_id#0'
        });
    });

    it('Should not save anything is policyId does not match', async () => {
        const saveSpy = jest.spyOn(HandleStore, 'saveMintedHandle');
        const saveAddressSpy = jest.spyOn(HandleStore, 'saveHandleUpdate');

        await processBlock({ policyId, txBlock: txBlock({ policy: 'no-ada-handle' }) as TxBlock, tip });

        expect(saveSpy).toHaveBeenCalledTimes(0);
        expect(saveAddressSpy).toHaveBeenCalledTimes(0);
    });
});
