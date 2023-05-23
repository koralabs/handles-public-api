import { AssetNameLabel, Rarity } from '@koralabs/handles-public-api-interfaces';
import { Logger } from '@koralabs/kora-labs-common';
import { BlockTip, TxBlock, TxMetadata } from '../../interfaces/ogmios.interfaces';
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
        holder: 'some_stake1',
        length: 8,
        name,
        image: 'some_hash_test1234',
        utxo: 'utxo1#0',
        numeric_modifiers: '',
        og_number: 1,
        standard_image: 'some_hash_test1234',
        rarity: Rarity.basic,
        resolved_addresses: { ada: 'addr123' },
        default_in_wallet: 'some_hdl',
        pfp_image: 'some_hash_test1234',
        bg_image: 'some_hash_test1234',
        created_slot_number: Date.now(),
        updated_slot_number: Date.now(),
        has_datum: false,
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
            og_number: 0,
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
            og_number: 0,
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
        const handleHexName = `${AssetNameLabel.LABEL_222}${Buffer.from(handleName).toString('hex')}`;
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
            hex: `${AssetNameLabel.LABEL_222}6275727269746f73`,
            image: '',
            name: handleName,
            og_number: 0,
            slotNumber: 0,
            utxo: 'some_id#0'
        });
    });

    it('Should process 222 update', async () => {
        const handleName = `burritos`;
        const handleHexName = `${AssetNameLabel.LABEL_222}${Buffer.from(handleName).toString('hex')}`;
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
            hex: `${AssetNameLabel.LABEL_222}6275727269746f73`,
            name: 'burritos',
            slotNumber: 0,
            utxo: 'some_id#0'
        });
    });

    it('Should process 100 asset class tokens', async () => {
        const handleName = `burritos`;
        const handleHexName = `${AssetNameLabel.LABEL_100}${Buffer.from(handleName).toString('hex')}`;

        const savePersonalizationChangeSpy = jest.spyOn(HandleStore, 'savePersonalizationChange');
        jest.spyOn(HandleStore, 'getTimeMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });
        jest.spyOn(ipfs, 'decodeCborFromIPFSFile').mockResolvedValue({ test: 'data' });

        await processBlock({
            policyId,
            txBlock: txBlock({
                handleHexName,
                isMint: false,
                datum: 'd87983ab626f67f4696f675f6e756d62657200646e616d656c746573745f73635f3030303165696d6167657835697066733a2f2f516d563965334e6e58484b71386e6d7a42337a4c725065784e677252346b7a4568654159695636487565623671416e7374616e646172645f696d6167657835697066733a2f2f516d563965334e6e58484b71386e6d7a42337a4c725065784e677252346b7a456865415969563648756562367141666c656e6774680c667261726974796562617369636776657273696f6e01696d65646961547970656a696d6167652f6a7065676a63686172616374657273776c6574746572732c6e756d626572732c7370656369616c716e756d657269635f6d6f646966696572736001d87981aa6862675f696d61676560697066705f696d6167656066706f7274616c606864657369676e65727835697066733a2f2f516d636b79584661486e51696375587067527846564b353251784d524e546d364e686577465055564e5a7a3148506676656e646f72606764656661756c74f466686f6c6465727f7840616464725f74657374317171356e78737770666d6b6b3277307674746b61306171366134783064786567796c703034346a6167367a397a71707476783370686d782c3975647663656e77343537723637343261306533677768706c76376878676764723936636a73767476667836ff6976616c696461746564f567736f6369616c737835697066733a2f2f516d566d3538696f5555754a7367534c474c357a6d635a62714d654d6355583251385056787742436e53544244766b7376675f76657273696f6e01'
            }) as TxBlock,
            tip
        });

        expect(savePersonalizationChangeSpy).toHaveBeenCalledWith({
            addresses: {},
            customImage: 'ipfs://QmV9e3NnXHKq8nmzB3zLrPexNgrR4kzEheAYiV6Hueb6qA',
            hex: '000643b06275727269746f73',
            metadata: {
                characters: 'letters,numbers,special',
                image: 'ipfs://QmV9e3NnXHKq8nmzB3zLrPexNgrR4kzEheAYiV6Hueb6qA',
                standard_image: 'ipfs://QmV9e3NnXHKq8nmzB3zLrPexNgrR4kzEheAYiV6Hueb6qA',
                length: 12,
                mediaType: 'image/jpeg',
                name: 'test_sc_0001',
                numeric_modifiers: '',
                og: false,
                og_number: 0,
                rarity: 'basic',
                version: 1
            },
            name: 'burritos',
            personalization: {
                designer: { test: 'data' },
                reference_token: {
                    datum: 'd87983ab626f67f4696f675f6e756d62657200646e616d656c746573745f73635f3030303165696d6167657835697066733a2f2f516d563965334e6e58484b71386e6d7a42337a4c725065784e677252346b7a4568654159695636487565623671416e7374616e646172645f696d6167657835697066733a2f2f516d563965334e6e58484b71386e6d7a42337a4c725065784e677252346b7a456865415969563648756562367141666c656e6774680c667261726974796562617369636776657273696f6e01696d65646961547970656a696d6167652f6a7065676a63686172616374657273776c6574746572732c6e756d626572732c7370656369616c716e756d657269635f6d6f646966696572736001d87981aa6862675f696d61676560697066705f696d6167656066706f7274616c606864657369676e65727835697066733a2f2f516d636b79584661486e51696375587067527846564b353251784d524e546d364e686577465055564e5a7a3148506676656e646f72606764656661756c74f466686f6c6465727f7840616464725f74657374317171356e78737770666d6b6b3277307674746b61306171366134783064786567796c703034346a6167367a397a71707476783370686d782c3975647663656e77343537723637343261306533677768706c76376878676764723936636a73767476667836ff6976616c696461746564f567736f6369616c737835697066733a2f2f516d566d3538696f5555754a7367534c474c357a6d635a62714d654d6355583251385056787742436e53544244766b7376675f76657273696f6e01',
                    index: 0,
                    lovelace: 1,
                    tx_id: 'some_id'
                },
                socials: { test: 'data' },
                validated_by: undefined
            },
            pfpImage: '',
            bgImage: '',
            setDefault: false,
            slotNumber: 0
        });
    });

    it('Should validate datum', async () => {
        const handleName = `burritos`;
        const handleHexName = `${AssetNameLabel.LABEL_100}${Buffer.from(handleName).toString('hex')}`;

        const savePersonalizationChangeSpy = jest.spyOn(HandleStore, 'savePersonalizationChange');
        jest.spyOn(HandleStore, 'getTimeMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });
        jest.spyOn(ipfs, 'decodeCborFromIPFSFile').mockResolvedValue({ test: 'data' });
        const loggerSpy = jest.spyOn(Logger, 'log').mockImplementation();

        await processBlock({
            policyId,
            txBlock: txBlock({
                handleHexName,
                isMint: false,
                datum: 'D87981A1446E616D654A24742D646174756D2D31'
            }) as TxBlock,
            tip
        });

        expect(savePersonalizationChangeSpy).toHaveBeenCalledTimes(0);
        expect(loggerSpy).toHaveBeenCalledWith(`invalid datum for reference token ${handleHexName}`);
    });

    it('Should log error for 100 asset token when there is no datum', async () => {
        const handleName = `burritos`;
        const handleHexName = `${AssetNameLabel.LABEL_100}${Buffer.from(handleName).toString('hex')}`;
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
        const handleHexName = `${AssetNameLabel.LABEL_100}${Buffer.from(handleName).toString('hex')}`;
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
