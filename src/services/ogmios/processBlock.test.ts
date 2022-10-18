import { IHandle, Rarity } from '../../interfaces/handle.interface';
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

    const txBlock = ({address = 'addr123', policy = policyId, handleHexName = hexName, handleName = name}) => ({
        shelley: {
            body: [
                {
                    id: 'some_id',
                    body: {
                        outputs: [
                            {
                                address,
                                value: {
                                    coins: 1,
                                    assets: {
                                        [`${`${policy}.${handleHexName}`}`]: 1
                                    }
                                }
                            }
                        ],
                        mint: {
                            coins: 1,
                            assets: {
                                [`${`${policy}.${handleHexName}`}`]: 1
                            }
                        }
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

    const expectedItem = {
        characters: 'letters,numbers',
        hex: hexName,
        length: 8,
        name,
        nft_image: 'ifps://some_hash_test1234',
        numeric_modifiers: '',
        og: 0,
        original_nft_image: 'ifps://some_hash_test1234',
        personalization: {},
        rarity: Rarity.basic,
        resolved_addresses: { ada: 'addr123' }
    };

    it('Should save a new handle to the datastore and set metrics', async () => {
        const saveSpy = jest.spyOn(HandleStore, 'save');
        const setMetricsSpy = jest.spyOn(HandleStore, 'setMetrics');
        jest.spyOn(HandleStore, 'getTimeMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 })

        processBlock({ policyId, txBlock: txBlock({}), tip });

        expect(saveSpy).toHaveBeenCalledWith(hexName, expectedItem);
        expect(setMetricsSpy).toHaveBeenNthCalledWith(1, { currentBlockHash: 'some_hash', currentSlot: 0, lastSlot: 0 });
        expect(setMetricsSpy).toHaveBeenNthCalledWith(2, { elapsedBuildingExec: expect.any(Number) });
    });

    it('Should not save a new handle because it already exists in store', () => {
        const newAddress = 'addr456';
        const saveSpy = jest.spyOn(HandleStore, 'save');

        jest.spyOn(HandleStore, 'get').mockReturnValue(expectedItem);

        processBlock({ policyId, txBlock: txBlock({address: newAddress}), tip });

        expect(saveSpy).toHaveBeenCalledWith(hexName, { ...expectedItem, resolved_addresses: { ada: newAddress } });
    });

    it('Should not save anything is policyId does not match', () => {
        const saveSpy = jest.spyOn(HandleStore, 'save');

        processBlock({ policyId, txBlock: txBlock({ policy: 'no-ada-handle' }), tip });

        expect(saveSpy).toHaveBeenCalledTimes(0);
    })
});
