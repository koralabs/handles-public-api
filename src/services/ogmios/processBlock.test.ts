import { AssetNameLabel, HandleType, Rarity } from '@koralabs/handles-public-api-interfaces';
import { Logger } from '@koralabs/kora-labs-common';
import { BlockTip, TxBlock, TxMetadata } from '../../interfaces/ogmios.interfaces';
import { HandleStore } from '../../repositories/memory/HandleStore';
import { buildValidDatum, processBlock } from './processBlock';
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

    const txBlock = ({ address = 'addr123', policy = policyId, handleHexName = hexName, handleName = name, isMint = true, datum = undefined, isBurn = false, slot = 0 }: { address?: string | undefined; policy?: string | undefined; handleHexName?: string | undefined; handleName?: string | undefined; isMint?: boolean | undefined; datum?: string; isBurn?: boolean; slot?: number }) => ({
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
        amount: 1,
        image_hash: '',
        standard_image_hash: '',
        svg_version: '',
        holder_type: '',
        version: 0,
        type: HandleType.HANDLE,
        default: false
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
            utxo: 'some_id#0',
            version: 0,
            type: HandleType.HANDLE
        });

        expect(setMetricsSpy).toHaveBeenNthCalledWith(1, {
            tipBlockHash: 'some_hash',
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
            datum,
            version: 0,
            type: HandleType.HANDLE
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
            utxo: 'some_id#0',
            type: HandleType.HANDLE
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
            utxo: 'some_id#0',
            version: 0,
            type: HandleType.HANDLE
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
            utxo: 'some_id#0',
            type: HandleType.HANDLE
        });
    });

    it('Should process 100 asset class tokens', async () => {
        const handleName = `burritos`;
        const handleHexName = `${AssetNameLabel.LABEL_100}${Buffer.from(handleName).toString('hex')}`;

        const savePersonalizationChangeSpy = jest.spyOn(HandleStore, 'savePersonalizationChange');
        jest.spyOn(HandleStore, 'getTimeMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });
        jest.spyOn(ipfs, 'decodeCborFromIPFSFile').mockResolvedValue({ test: 'data' });

        const cbor =
            'd8799faa426f6700496f675f6e756d62657200446e616d654c746573745f73635f3030303145696d6167655835697066733a2f2f516d563965334e6e58484b71386e6d7a42337a4c725065784e677252346b7a456865415969563648756562367141466c656e6774680c467261726974794562617369634776657273696f6e01496d65646961547970654a696d6167652f6a7065674a63686172616374657273576c6574746572732c6e756d626572732c7370656369616c516e756d657269635f6d6f646966696572734001b14e7374616e646172645f696d6167655835697066733a2f2f516d563965334e6e58484b71386e6d7a42337a4c725065784e677252346b7a4568654159695636487565623671414862675f696d61676540497066705f696d6167654046706f7274616c404864657369676e65725835697066733a2f2f516d636b79584661486e51696375587067527846564b353251784d524e546d364e686577465055564e5a7a3148504676656e646f72404764656661756c7400536c6173745f7570646174655f6164647265737342abcd47736f6369616c735835697066733a2f2f516d566d3538696f5555754a7367534c474c357a6d635a62714d654d6355583251385056787742436e53544244764a696d6167655f6861736842abcd537374616e646172645f696d6167655f6861736842abcd4b7376675f76657273696f6e45312e302e304c76616c6964617465645f6279404c6167726565645f7465726d7340546d6967726174655f7369675f72657175697265640045747269616c00446e73667700ff';

        await processBlock({
            policyId,
            txBlock: txBlock({
                handleHexName,
                isMint: false,
                datum: cbor
            }) as TxBlock,
            tip
        });

        expect(savePersonalizationChangeSpy).toHaveBeenCalledWith({
            addresses: {},
            hex: '000643b06275727269746f73',
            metadata: {
                characters: 'letters,numbers,special',
                image: 'ipfs://QmV9e3NnXHKq8nmzB3zLrPexNgrR4kzEheAYiV6Hueb6qA',
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
                socials: { test: 'data' },
                validated_by: '0x',
                trial: false,
                nsfw: false
            },
            reference_token: {
                datum: cbor,
                index: 0,
                lovelace: 1,
                tx_id: 'some_id',
                address: 'addr123'
            },
            personalizationDatum: {
                agreed_terms: '0x',
                bg_image: '',
                default: false,
                designer: 'ipfs://QmckyXFaHnQicuXpgRxFVK52QxMRNTm6NhewFPUVNZz1HP',
                image_hash: '0xabcd',
                last_update_address: '0xabcd',
                migrate_sig_required: 0,
                nsfw: false,
                pfp_image: '',
                portal: '',
                socials: 'ipfs://QmVm58ioUUuJsgSLGL5zmcZbqMeMcUX2Q8PVxwBCnSTBDv',
                standard_image: 'ipfs://QmV9e3NnXHKq8nmzB3zLrPexNgrR4kzEheAYiV6Hueb6qA',
                standard_image_hash: '0xabcd',
                svg_version: '1.0.0',
                trial: false,
                validated_by: '0x',
                vendor: ''
            },
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
                datum: 'd87a9fa1446e616d65447461636fff'
            }) as TxBlock,
            tip
        });

        expect(savePersonalizationChangeSpy).toHaveBeenCalledTimes(1);
        expect(loggerSpy).toHaveBeenCalledWith({
            category: 'ERROR',
            event: 'buildValidDatum.invalidMetadata',
            message: 'burritos invalid metadata: {"constructor_1":[{"name":"0x7461636f"}]}'
        });
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

    describe('isValidDatum tests', () => {
        it('should return null for invalid datum', () => {
            const datum = {
                constructor_12: [{}, 1, {}]
            };
            const result = buildValidDatum('taco', 'taco', datum);
            expect(result).toEqual({ metadata: null, personalizationDatum: null });
        });

        it('should return empty datum', () => {
            const datum = {
                constructor_0: [{}, 1, {}]
            };
            const result = buildValidDatum('taco', 'taco', datum);
            expect(result).toEqual({ metadata: {}, personalizationDatum: {} });
        });

        it('should return invalid datum', () => {
            const datum = {
                constructor_0: [{ a: 'a' }, 1, { b: 'b' }]
            };
            const result = buildValidDatum('taco', 'taco', datum);
            expect(result).toEqual({ metadata: { a: 'a' }, personalizationDatum: { b: 'b' } });
        });

        it('should return pz datum even with one missing required field', () => {
            const datum = {
                constructor_0: [
                    {
                        name: '',
                        image: '',
                        mediaType: '',
                        og: 0,
                        og_number: 0,
                        rarity: '',
                        length: 0,
                        characters: '',
                        numeric_modifiers: '',
                        version: 0
                    },
                    1,
                    {
                        // standard_image: '',
                        portal: '',
                        designer: '',
                        socials: '',
                        vendor: '',
                        default: false,
                        last_update_address: '',
                        validated_by: ''
                    }
                ]
            };

            const result = buildValidDatum('taco', 'taco', datum);
            expect(result).toEqual({
                metadata: {
                    characters: '',
                    image: '',
                    length: 0,
                    mediaType: '',
                    name: '',
                    numeric_modifiers: '',
                    og: 0,
                    og_number: 0,
                    rarity: '',
                    version: 0
                },
                personalizationDatum: {
                    portal: '',
                    designer: '',
                    socials: '',
                    vendor: '',
                    default: false,
                    last_update_address: '',
                    validated_by: ''
                }
            });
        });

        it('should return true for valid datum', () => {
            const datum = {
                constructor_0: [
                    {
                        name: '',
                        image: '',
                        mediaType: '',
                        og: 0,
                        og_number: 0,
                        rarity: '',
                        length: 0,
                        characters: '',
                        numeric_modifiers: '',
                        version: 0
                    },
                    1,
                    {
                        standard_image: '',
                        portal: '',
                        designer: '',
                        socials: '',
                        vendor: '',
                        default: false,
                        last_update_address: '',
                        validated_by: '',
                        bg_image: '',
                        image_hash: '',
                        standard_image_hash: '',
                        svg_version: '',
                        agreed_terms: '',
                        migrate_sig_required: 0,
                        trial: 0,
                        nsfw: 0
                    }
                ]
            };
            const result = buildValidDatum('taco', 'taco', datum);
            expect(result).toBeTruthy();
        });
    });
});
