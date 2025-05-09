import { BlockPraos, Script, Tip } from '@cardano-ogmios/schema';
import { AssetNameLabel, HandleType, Logger, encodeJsonToDatum } from '@koralabs/kora-labs-common';
import { HandlesRepository } from '../../repositories/handlesRepository';
import { MemoryHandlesProvider } from '../../repositories/memory';
import { HandleStore } from '../../repositories/memory/handleStore';
import * as ipfs from '../../utils/ipfs';
import { block_144711632, block_144718140, block_144718597 } from './fixtures/blocks';
import OgmiosService from './ogmios.service';
const repo = new HandlesRepository(new MemoryHandlesProvider());
const ogmios = new OgmiosService(repo);
jest.mock('../../config/index', () => ({
    isDatumEndpointEnabled: jest.fn(() => true),
    getIpfsGateway: jest.fn(() => 'https://ipfs.io/ipfs/'),
}));

describe('processBlock Tests', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });
    beforeEach(() => {
        HandleStore.handles.clear();
        HandleStore.holderIndex.clear();
    })

    const tip: Tip = {
        slot: 0,
        id: 'some_hash',
        height: 0
    };

    const defaultAddress = 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q';
    const policyId = 'f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a';
    const hexName = '7465737431323334';
    const name = 'test1234';

    const metadata = (policy: string, handleName: string) => ({
        hash: 'some_hash',
        labels: {
            721: {
                json: {
                    [policy]: {
                        [handleName]: {
                            image: `ifps://some_hash_${handleName}`,
                            core: {
                                og: BigInt(1)
                            }
                        }
                    }
                }
            }
        }
    });

    const txBlock = ({ address = defaultAddress, policy = policyId, handleHexName = hexName, handleName = name, isMint = true, datum = undefined, script = undefined, isBurn = false, slot = 0, additionalAssets = {} }: { address?: string | undefined; policy?: string | undefined; handleHexName?: string | undefined; handleName?: string | undefined; isMint?: boolean | undefined; datum?: string; script?: Script; isBurn?: boolean; slot?: number, additionalAssets?: { [key: string]: bigint } } ): BlockPraos => ({
        ancestor: 'test',
        era: 'babbage',
        type: 'praos',
        size: { bytes: 0 },
        protocol: { version: { major: 0, minor: 0, patch: 0 } },
        height: 10,
        id: 'some_block_hash',
        slot,
        issuer: {
            leaderValue: {},
            operationalCertificate: {
                count: 1,
                kes: {
                    period: 1,
                    verificationKey: ''
                }
            },
            verificationKey: '',
            vrfVerificationKey: ''
        },
        transactions: [
            !isBurn
                ? {
                    id: 'some_id',
                    spends: 'inputs',
                    inputs: [
                        {
                            index: 0,
                            transaction: {
                                id: 'some_id'
                            }
                        }
                    ],
                    outputs: [
                        {
                            datum,
                            script,
                            address,
                            value: {
                                ada: {
                                    lovelace: BigInt(1)
                                },
                                [policy]: {
                                    [handleHexName]: BigInt(1),
                                    ...additionalAssets
                                }
                            }
                        }
                    ],
                    mint: isMint
                        ? {
                            [policyId]: {
                                [handleHexName]: BigInt(1),
                                ...additionalAssets
                            }
                        }
                        : undefined,
                    metadata: metadata(policy, handleName),
                    signatories: [
                        {
                            key: '',
                            signature: ''
                        }
                    ]
                }
                : {
                    id: 'some_id_2',
                    spends: 'inputs',
                    inputs: [
                        {
                            index: 0,
                            transaction: {
                                id: 'some_id'
                            }
                        }
                    ],
                    outputs: [
                        {
                            datum,
                            address,
                            value: {
                                ada: {
                                    lovelace: BigInt(1)
                                }
                            }
                        }
                    ],
                    mint: {
                        [policy]: {
                            [handleHexName]: BigInt(-1)
                        }
                    },
                    metadata: undefined,
                    signatories: [
                        {
                            key: '',
                            signature: ''
                        }
                    ]
                }
        ]
    });

    describe('It should handle strangely ordered blocks', () => {
        it('Should save Handle updates even if out of order', async () => {
            const saveSpy = jest.spyOn(HandlesRepository.prototype, 'save');
            const setMetricsSpy = jest.spyOn(MemoryHandlesProvider.prototype, 'setMetrics');
            jest.spyOn(HandlesRepository.prototype, 'getMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });
            // @ts-ignore #2
            await ogmios['processBlock']({ txBlock: block_144718140, tip });
            // @ts-ignore #1
            await ogmios['processBlock']({ txBlock: block_144711632, tip });
            // @ts-ignore #3
            await ogmios['processBlock']({ txBlock: block_144718597, tip });
            expect(HandleStore.handles.get('b-263-54')?.utxo).toBe('cba9fb3981f7a50e69ad6bc36739b2b303dee59b2b1db963e4ceb321ec8d8951#0');
            expect(HandleStore.handles.get('b-263-54')?.resolved_addresses.ada).toBe('addr1qxedumyydxkq4gc7ud0wnwashphwxr7l7w3hmp2dnymvlj7yl8ckta8puax7ezypm7fg5ytydjz33erdxqtm556y9kfqa9s0sg');
        });
    })

    it('Should save a new handle to the datastore and set metrics', async () => {
        const saveSpy = jest.spyOn(HandlesRepository.prototype, 'save');
        const setMetricsSpy = jest.spyOn(MemoryHandlesProvider.prototype, 'setMetrics');
        jest.spyOn(HandlesRepository.prototype, 'getMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });

        await ogmios['processBlock']({ txBlock: txBlock({ policy: policyId, additionalAssets: { '74657374343536': BigInt(1) } }), tip })

        expect(saveSpy).toHaveBeenCalledTimes(2);

        expect(saveSpy).toHaveBeenNthCalledWith(1, { 
            policy: policyId,
            hex: '7465737431323334',
            image: 'ifps://some_hash_test1234',
            name: 'test1234',
            og_number: 0,
            utxo: 'some_id#0',
            version: 0,
            handle_type: HandleType.HANDLE,
            lovelace: 1,
            sub_characters: undefined,
            sub_length: undefined,
            sub_numeric_modifiers: undefined,
            sub_rarity: undefined,
            amount: 1,
            characters: 'letters,numbers',
            created_slot_number: 0,
            datum: undefined,
            has_datum: false,
            numeric_modifiers: '',
            payment_key_hash: '9a2bb4492f1a7b2a1c10c8cc37fe3fe2b4e613704ba5331cb94b6388',
            rarity: 'basic',
            resolved_addresses: {
                ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q'
            },
            script: undefined,
            standard_image: 'ifps://some_hash_test1234',
            updated_slot_number: 0,
            default_in_wallet: '',
            holder: 'stake_test1urc63cmezfacz9vrqu867axmqrvgp4zsyllxzud3k6danjsn0dn70',
            holder_type: 'wallet',
            image_hash: '',
            length: 8,
            standard_image_hash: '',
            svg_version: '0'
        }, undefined);

        expect(saveSpy).toHaveBeenNthCalledWith(2, {
            hex: '74657374343536',
            image: '',
            name: 'test456',
            og_number: 0,
            utxo: 'some_id#0',
            policy: policyId,
            version: 0,
            handle_type: HandleType.HANDLE,
            lovelace: 1,
            sub_characters: undefined,
            sub_length: undefined,
            sub_numeric_modifiers: undefined,
            sub_rarity: undefined,
            amount: 1,
            characters: 'letters,numbers',
            created_slot_number: 0,
            datum: undefined,
            has_datum: false,
            numeric_modifiers: '',
            payment_key_hash: '9a2bb4492f1a7b2a1c10c8cc37fe3fe2b4e613704ba5331cb94b6388',
            rarity: 'common',
            resolved_addresses: {
                ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q'
            },
            script: undefined,
            standard_image: '',
            updated_slot_number: 0,
            default_in_wallet: '',
            holder: 'stake_test1urc63cmezfacz9vrqu867axmqrvgp4zsyllxzud3k6danjsn0dn70',
            holder_type: 'wallet',
            image_hash: '',
            length: 7,
            standard_image_hash: '',
            svg_version: '0'
        }, undefined);

        expect(setMetricsSpy).toHaveBeenNthCalledWith(1, {
            tipBlockHash: 'some_hash',
            currentBlockHash: 'some_block_hash',
            currentSlot: 0,
            lastSlot: 0
        });

        expect(setMetricsSpy).toHaveBeenNthCalledWith(2, { elapsedBuildingExec: expect.any(Number) });

    });

    it('Should save datum', async () => {
        const datum = 'a2some_datum';
        const saveSpy = jest.spyOn(HandlesRepository.prototype, 'save');

        jest.spyOn(HandlesRepository.prototype, 'getMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });

        await ogmios['processBlock']({ txBlock: txBlock({ policy: policyId, datum }), tip })
        expect(saveSpy).toHaveBeenCalledWith({
            resolved_addresses: {
                ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q'
            },
            policy: policyId,
            hex: '7465737431323334',
            image: 'ifps://some_hash_test1234',
            name: 'test1234',
            og_number: 0,
            utxo: 'some_id#0',
            datum,
            version: 0,
            handle_type: HandleType.HANDLE,
            lovelace: 1,
            sub_characters: undefined,
            sub_length: undefined,
            sub_numeric_modifiers: undefined,
            sub_rarity: undefined,
            amount: 1,
            characters: 'letters,numbers',
            created_slot_number: 0,
            has_datum: true,
            numeric_modifiers: '',
            payment_key_hash: '9a2bb4492f1a7b2a1c10c8cc37fe3fe2b4e613704ba5331cb94b6388',
            rarity: 'basic',
            script: undefined,
            standard_image: 'ifps://some_hash_test1234',
            updated_slot_number: 0,
            default_in_wallet: '',
            holder: 'stake_test1urc63cmezfacz9vrqu867axmqrvgp4zsyllxzud3k6danjsn0dn70',
            holder_type: 'wallet',
            standard_image_hash: '',
            svg_version: '0',
            image_hash: '',
            length: 8
        }, undefined);
    });

    it('Should save script', async () => {
        const script: Script = { language: 'plutus:v2', cbor: 'a2some_cbor' };
        const saveSpy = jest.spyOn(HandlesRepository.prototype, 'save');

        jest.spyOn(HandlesRepository.prototype, 'getMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });

        await ogmios['processBlock']({ txBlock: txBlock({ policy: policyId, script }), tip });
        const savedHandle = {
            amount: 1,
            characters: 'letters,numbers',
            created_slot_number: 0,
            datum: undefined,
            default_in_wallet: '',
            handle_type: 'handle',
            has_datum: false,
            hex: '7465737431323334',
            holder: 'stake_test1urc63cmezfacz9vrqu867axmqrvgp4zsyllxzud3k6danjsn0dn70',
            holder_type: 'wallet',
            image: 'ifps://some_hash_test1234',
            image_hash: '',
            length: 8,
            lovelace: 1,
            name: 'test1234',
            numeric_modifiers: '',
            og_number: 0,
            payment_key_hash:
              '9a2bb4492f1a7b2a1c10c8cc37fe3fe2b4e613704ba5331cb94b6388',
            policy: 'f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a',
            rarity: 'basic',
            resolved_addresses: {
                ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q'
            },
            script: { cbor: 'a2some_cbor', type: 'plutus_v2' },
            standard_image: 'ifps://some_hash_test1234',
            standard_image_hash: '',
            sub_characters: undefined,
            sub_length: undefined,
            sub_numeric_modifiers: undefined,
            sub_rarity: undefined,
            svg_version: '0',
            updated_slot_number: 0,
            utxo: 'some_id#0',
            version: 0
        }
        expect(saveSpy).toHaveBeenCalledWith(savedHandle, undefined);
    });

    it('Should update a handle when it is not a mint', async () => {
        const newAddress = 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc98p';
        const saveHandleUpdateSpy = jest.spyOn(HandlesRepository.prototype, 'save');
        jest.spyOn(HandlesRepository.prototype, 'setMetrics');
        jest.spyOn(HandlesRepository.prototype, 'getMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });

        await ogmios['processBlock']({ txBlock: txBlock({ policy: policyId, address: newAddress, isMint: true }), tip });
        await ogmios['processBlock']({ txBlock: txBlock({ policy: policyId, address: newAddress, isMint: false }), tip });
        const savedHandle = {
            amount: 1,
            characters: 'letters,numbers',
            created_slot_number: 0,
            default_in_wallet: 'test1234',
            handle_type: 'handle',
            has_datum: false,
            hex: '7465737431323334',
            holder:
              'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc98p',
            holder_type: 'other',
            image: 'ifps://some_hash_test1234',
            image_hash: '',
            length: 8,
            lovelace: 1,
            name: 'test1234',
            numeric_modifiers: '',
            og_number: 0,
            payment_key_hash: null,
            policy: 'f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a',
            rarity: 'basic',
            resolved_addresses: {
                ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc98p'
            },
            standard_image: 'ifps://some_hash_test1234',
            standard_image_hash: '',
            svg_version: '0',
            updated_slot_number: 0,
            utxo: 'some_id#0',
            version: 0
        }
        expect(saveHandleUpdateSpy).toHaveBeenNthCalledWith(2, savedHandle, savedHandle);
    });

    it('Should not save anything if policyId does not match', async () => {
        const saveSpy = jest.spyOn(HandlesRepository.prototype, 'save');
        const saveAddressSpy = jest.spyOn(HandlesRepository.prototype, 'save');

        await ogmios['processBlock']({ txBlock: txBlock({ policy: 'no-ada-handle' }), tip });

        expect(saveSpy).toHaveBeenCalledTimes(0);
        expect(saveAddressSpy).toHaveBeenCalledTimes(0);
    });

    it('Should process 222 asset class token mint', async () => {
        const handleName = `burritos`;
        const handleHexName = `${AssetNameLabel.LBL_222}${Buffer.from(handleName).toString('hex')}`;
        const saveSpy = jest.spyOn(HandlesRepository.prototype, 'save');
        jest.spyOn(HandlesRepository.prototype, 'getMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });

        await ogmios['processBlock']({
            txBlock: txBlock({ policy: policyId, handleHexName }) as BlockPraos,
            tip
        });

        expect(saveSpy).toHaveBeenCalledWith({
            amount: 1,
            characters: 'letters',
            created_slot_number: 0,
            default_in_wallet: '',
            handle_type: 'handle',
            has_datum: false,
            hex: '000de1406275727269746f73',
            holder: 'stake_test1urc63cmezfacz9vrqu867axmqrvgp4zsyllxzud3k6danjsn0dn70',
            holder_type: 'wallet',
            image: '',
            image_hash: '',
            length: 8,
            lovelace: 1,
            name: 'burritos',
            numeric_modifiers: '',
            og_number: 0,
            payment_key_hash:
              '9a2bb4492f1a7b2a1c10c8cc37fe3fe2b4e613704ba5331cb94b6388',
            policy: 'f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a',
            rarity: 'basic',
            resolved_addresses: {
                ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q'
            },
            standard_image: '',
            standard_image_hash: '',
            svg_version: '0',
            updated_slot_number: 0,
            utxo: 'some_id#0',
            version: 0
        }, undefined);
    });

    it('Should process 222 update', async () => {
        const handleName = `burritos`;
        const handleHexName = `${AssetNameLabel.LBL_222}${Buffer.from(handleName).toString('hex')}`;
        const saveHandleUpdateSpy = jest.spyOn(HandlesRepository.prototype, 'save');
        jest.spyOn(HandlesRepository.prototype, 'getMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });

        await ogmios['processBlock']({
            txBlock: txBlock({ policy: policyId, handleHexName, isMint: true }) as BlockPraos,
            tip
        });

        await ogmios['processBlock']({
            txBlock: txBlock({ policy: policyId, handleHexName, isMint: false }) as BlockPraos,
            tip
        });

        expect(saveHandleUpdateSpy).toHaveBeenCalledWith({
            policy: policyId,
            datum: undefined,
            hex: `${AssetNameLabel.LBL_222}6275727269746f73`,
            name: 'burritos',
            utxo: 'some_id#0',
            handle_type: HandleType.HANDLE,
            lovelace: 1,
            script: undefined,
            image: '',
            og_number: 0,
            version: 0,
            standard_image: '',
            standard_image_hash: '',
            sub_characters: undefined,
            sub_length: undefined,
            sub_numeric_modifiers: undefined,
            sub_rarity: undefined,
            svg_version: '0',
            updated_slot_number: 0,
            rarity: 'basic',
            resolved_addresses: {
                ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q'
            },
            payment_key_hash: '9a2bb4492f1a7b2a1c10c8cc37fe3fe2b4e613704ba5331cb94b6388',
            numeric_modifiers: '',
            image_hash: '',
            length: 8,
            holder: 'stake_test1urc63cmezfacz9vrqu867axmqrvgp4zsyllxzud3k6danjsn0dn70',
            holder_type: 'wallet',
            has_datum: false,
            default_in_wallet: 'burritos',
            drep: undefined,
            amount: 1,
            characters: 'letters',
            created_slot_number: 0
        }, {
            policy: policyId,
            datum: undefined,
            hex: `${AssetNameLabel.LBL_222}6275727269746f73`,
            name: 'burritos',
            utxo: 'some_id#0',
            handle_type: HandleType.HANDLE,
            lovelace: 1,
            script: undefined,
            image: '',
            og_number: 0,
            version: 0,
            standard_image: '',
            standard_image_hash: '',
            sub_characters: undefined,
            sub_length: undefined,
            sub_numeric_modifiers: undefined,
            sub_rarity: undefined,
            svg_version: '0',
            updated_slot_number: 0,
            rarity: 'basic',
            resolved_addresses: {
                ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q'
            },
            payment_key_hash: '9a2bb4492f1a7b2a1c10c8cc37fe3fe2b4e613704ba5331cb94b6388',
            numeric_modifiers: '',
            image_hash: '',
            length: 8,
            holder: 'stake_test1urc63cmezfacz9vrqu867axmqrvgp4zsyllxzud3k6danjsn0dn70',
            holder_type: 'wallet',
            has_datum: false,
            default_in_wallet: 'burritos',
            drep: undefined,
            amount: 1,
            characters: 'letters',
            created_slot_number: 0
        });
    });

    it('Should process 100 asset class tokens', async () => {
        const handleName = `burritos`;
        const handleHexName = `${AssetNameLabel.LBL_100}${Buffer.from(handleName).toString('hex')}`;

        const savePersonalizationChangeSpy = jest.spyOn(HandlesRepository.prototype, 'save');
        jest.spyOn(HandlesRepository.prototype, 'getMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });
        jest.spyOn(ipfs, 'decodeCborFromIPFSFile').mockResolvedValue({ test: 'data' });

        const cbor = 'd8799faa426f6700496f675f6e756d62657200446e616d654c746573745f73635f3030303145696d6167655835697066733a2f2f516d563965334e6e58484b71386e6d7a42337a4c725065784e677252346b7a456865415969563648756562367141466c656e6774680c467261726974794562617369634776657273696f6e01496d65646961547970654a696d6167652f6a7065674a63686172616374657273576c6574746572732c6e756d626572732c7370656369616c516e756d657269635f6d6f646966696572734001b24e7374616e646172645f696d6167655835697066733a2f2f516d563965334e6e58484b71386e6d7a42337a4c725065784e677252346b7a4568654159695636487565623671414862675f696d61676540497066705f696d6167654046706f7274616c404864657369676e65725835697066733a2f2f516d636b79584661486e51696375587067527846564b353251784d524e546d364e686577465055564e5a7a3148504676656e646f72404764656661756c7400536c6173745f7570646174655f6164647265737342abcd47736f6369616c735835697066733a2f2f516d566d3538696f5555754a7367534c474c357a6d635a62714d654d6355583251385056787742436e53544244764a696d6167655f6861736842abcd537374616e646172645f696d6167655f6861736842abcd4b7376675f76657273696f6e45312e302e304c76616c6964617465645f6279404c6167726565645f7465726d7340546d6967726174655f7369675f726571756972656400527265736f6c7665645f616464726573736573a34361646142abcd436274634f7133736b64736b6a6b656a326b6e644365746849333234656b646a6b3345747269616c00446e73667700ff';
        // Once to mint the Handle
        await ogmios['processBlock']({
            txBlock: txBlock({
                policy: policyId,
                handleHexName: `${AssetNameLabel.LBL_222}${Buffer.from(handleName).toString('hex')}`,
                isMint: true
            }),
            tip
        });
        // then the 100 update
        await ogmios['processBlock']({
            txBlock: txBlock({
                policy: policyId,
                handleHexName,
                isMint: false,
                datum: cbor
            }),
            tip
        });
        const savedHandle =  {
            amount: 1,
            characters: 'letters',
            created_slot_number: 0,
            default_in_wallet: 'burritos',
            handle_type: 'handle',
            has_datum: false,
            hex: '000de1406275727269746f73',
            holder: 'stake_test1urc63cmezfacz9vrqu867axmqrvgp4zsyllxzud3k6danjsn0dn70',
            holder_type: 'wallet',
            image: '',
            image_hash: '',
            length: 8,
            lovelace: 1,
            name: 'burritos',
            numeric_modifiers: '',
            og_number: 0,
            payment_key_hash: '9a2bb4492f1a7b2a1c10c8cc37fe3fe2b4e613704ba5331cb94b6388',
            policy: 'f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a',
            rarity: 'basic',
            resolved_addresses: {
                ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q'
            },
            standard_image: '',
            standard_image_hash: '',
            svg_version: '0',
            updated_slot_number: 0,
            utxo: 'some_id#0',
            version: 0
        }
        expect(savePersonalizationChangeSpy).toHaveBeenNthCalledWith(2, {
            ...savedHandle,
            reference_token: {
                address: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q', 
                datum: 'd8799faa426f6700496f675f6e756d62657200446e616d654c746573745f73635f3030303145696d6167655835697066733a2f2f516d563965334e6e58484b71386e6d7a42337a4c725065784e677252346b7a456865415969563648756562367141466c656e6774680c467261726974794562617369634776657273696f6e01496d65646961547970654a696d6167652f6a7065674a63686172616374657273576c6574746572732c6e756d626572732c7370656369616c516e756d657269635f6d6f646966696572734001b24e7374616e646172645f696d6167655835697066733a2f2f516d563965334e6e58484b71386e6d7a42337a4c725065784e677252346b7a4568654159695636487565623671414862675f696d61676540497066705f696d6167654046706f7274616c404864657369676e65725835697066733a2f2f516d636b79584661486e51696375587067527846564b353251784d524e546d364e686577465055564e5a7a3148504676656e646f72404764656661756c7400536c6173745f7570646174655f6164647265737342abcd47736f6369616c735835697066733a2f2f516d566d3538696f5555754a7367534c474c357a6d635a62714d654d6355583251385056787742436e53544244764a696d6167655f6861736842abcd537374616e646172645f696d6167655f6861736842abcd4b7376675f76657273696f6e45312e302e304c76616c6964617465645f6279404c6167726565645f7465726d7340546d6967726174655f7369675f726571756972656400527265736f6c7665645f616464726573736573a34361646142abcd436274634f7133736b64736b6a6b656a326b6e644365746849333234656b646a6b3345747269616c00446e73667700ff', 
                index: 0, 
                lovelace: 1, 
                tx_id: 'some_id'
            },
            personalization: {
                designer: {
                    test: 'data'
                },
                nsfw: false,
                socials: {
                    test: 'data'
                },
                trial: false,
                validated_by: '0x'
            },
            resolved_addresses: {
                ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q',
                btc: 'q3skdskjkej2knd',
                eth: '324ekdjk3'
            },
            image_hash: '0xabcd',
            last_update_address: '0xabcd',
            pfp_image: '',
            pz_enabled: false,
            standard_image_hash: '0xabcd',
            svg_version: '1.0.0',
            bg_image: '',
            standard_image: ''
        }, savedHandle);
    });

    it('Should process 001 SubHandle settings token', async () => {
        const handleName = `burritos`;
        const handleHexName = `${AssetNameLabel.LBL_001}${Buffer.from(handleName).toString('hex')}`;

        const saveSubHandleSettingsChangeSpy = jest.spyOn(HandlesRepository.prototype, 'save');
        jest.spyOn(HandlesRepository.prototype, 'getMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });
        jest.spyOn(ipfs, 'decodeCborFromIPFSFile').mockResolvedValue({ test: 'data' });

        const cbor = '9f9f01019f9f011a0bebc200ff9f021a05f5e100ff9f031a02faf080ff9f041a00989680ffffa14862675f696d6167654000ff9f000080a14862675f696d6167654000ff0000581a687474703a2f2f6c6f63616c686f73743a333030372f23746f755f5840616464725f746573743171707963336a6b65346730743675656d7a657466746e6c306a65306135746879396b346a6d707679637361733838796b6c7977367430582c64336a74307a6739776e756d677866746b3966743877766a787a633672656c74676c6c6b7373356e7a617434ff00ff';

        // Once to get the handle in the store
        await ogmios['processBlock']({
            txBlock: txBlock({
                policy: policyId,
                handleHexName: `${AssetNameLabel.LBL_222}${Buffer.from(handleName).toString('hex')}`,
                isMint: true
            }),
            tip
        });

        // And now the sub handle settings
        await ogmios['processBlock']({
            txBlock: txBlock({
                policy: policyId,
                handleHexName,
                isMint: false,
                datum: cbor
            }),
            tip
        });
        const savedHandle = {
            amount: 1,
            characters: 'letters',
            created_slot_number: 0,
            default_in_wallet: 'burritos',
            handle_type: 'handle',
            has_datum: false,
            hex: '000de1406275727269746f73',
            holder: 'stake_test1urc63cmezfacz9vrqu867axmqrvgp4zsyllxzud3k6danjsn0dn70',
            holder_type: 'wallet',
            image: '',
            image_hash: '',
            length: 8,
            lovelace: 1,
            name: 'burritos',
            numeric_modifiers: '',
            og_number: 0,
            payment_key_hash: '9a2bb4492f1a7b2a1c10c8cc37fe3fe2b4e613704ba5331cb94b6388',
            policy: 'f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a',
            rarity: 'basic',
            resolved_addresses: {
                ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q'
            },
            standard_image: '',
            standard_image_hash: '',
            svg_version: '0',
            updated_slot_number: 0,
            utxo: 'some_id#0',
            version: 0
        }
        expect(saveSubHandleSettingsChangeSpy).toHaveBeenNthCalledWith(2, {
            ...savedHandle,
            subhandle_settings: {
                "agreed_terms": "addr_test1qpyc3jke4g0t6uemzetftnl0je0a5thy9k4jmpvycsas88yklyw6t0d3jt0zg9wnumgxftk9ft8wvjxzc6reltgllkss5nzat4",
                "buy_down_paid": 0,
                "buy_down_percent": "0x687474703a2f2f6c6f63616c686f73743a333030372f23746f75",
                "buy_down_price": 0,
                "migrate_sig_required": false,
                "nft": {
                  "default_styles": {
                    "bg_image": "",
                  },
                  "public_minting_enabled": true,
                  "pz_enabled": true,
                  "save_original_address": false,
                  "tier_pricing": [
                    [
                      1,
                      200000000,
                    ],
                    [
                      2,
                      100000000,
                    ],
                    [
                      3,
                      50000000,
                    ],
                    [
                      4,
                      10000000,
                    ],
                  ],
                },
                "payment_address": undefined,
                "virtual": {
                "default_styles": {
                  "bg_image": "",
                },
                "public_minting_enabled": false,
                "pz_enabled": false,
                "save_original_address": false,
                "tier_pricing":  [],
                },
                utxo: {
                    address: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q',
                    datum: '9f9f01019f9f011a0bebc200ff9f021a05f5e100ff9f031a02faf080ff9f041a00989680ffffa14862675f696d6167654000ff9f000080a14862675f696d6167654000ff0000581a687474703a2f2f6c6f63616c686f73743a333030372f23746f755f5840616464725f746573743171707963336a6b65346730743675656d7a657466746e6c306a65306135746879396b346a6d707679637361733838796b6c7977367430582c64336a74307a6739776e756d677866746b3966743877766a787a633672656c74676c6c6b7373356e7a617434ff00ff',
                    index: 0,
                    lovelace: 1,
                    tx_id: 'some_id'
                }
            }
        }, 
        savedHandle);
    });

    it('should process as NFT Sub handle', async () => {
        const handleName = 'sub@hndl';
        const handleHexName = `${AssetNameLabel.LBL_222}${Buffer.from(handleName).toString('hex')}`;

        const saveMintedHandleSpy = jest.spyOn(HandlesRepository.prototype, 'save');
        jest.spyOn(HandlesRepository.prototype, 'getMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });

        await ogmios['processBlock']({
            txBlock: txBlock({
                policy: policyId,
                handleHexName,
                isMint: true
            }) as BlockPraos,
            tip
        })
        
        expect(saveMintedHandleSpy).toHaveBeenCalledWith({
            resolved_addresses: {
                ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q'
            },
            policy: policyId,
            datum: undefined,
            hex: handleHexName,
            image: '',
            name: handleName,
            og_number: 0,
            script: undefined,
            handle_type: HandleType.NFT_SUBHANDLE,
            utxo: 'some_id#0',
            version: 0,
            lovelace: 1,
            amount: 1,
            characters: 'letters',
            created_slot_number: 0,
            has_datum: false,
            numeric_modifiers: '',
            payment_key_hash: '9a2bb4492f1a7b2a1c10c8cc37fe3fe2b4e613704ba5331cb94b6388',
            rarity: 'basic',
            standard_image: '',
            updated_slot_number: 0,
            standard_image_hash: '',
            sub_characters: 'letters',
            sub_length: 3,
            sub_numeric_modifiers: '',
            sub_rarity: 'rare',
            svg_version: '0',
            default_in_wallet: '',
            holder: 'stake_test1urc63cmezfacz9vrqu867axmqrvgp4zsyllxzud3k6danjsn0dn70',
            holder_type: 'wallet',
            image_hash: '',
            length: 8
        }, undefined);
    });

    it('Should process virtual sub handle', async () => {
        const handleName = `virtual@hndl`;
        const handleHexName = `${AssetNameLabel.LBL_000}${Buffer.from(handleName).toString('hex')}`;

        const savePersonalizationChangeSpy = jest.spyOn(HandlesRepository.prototype, 'save');
        jest.spyOn(HandlesRepository.prototype, 'getMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });
        jest.spyOn(ipfs, 'decodeCborFromIPFSFile').mockResolvedValue({ test: 'data' });

        const cbor = 'D8799FAE426F6700496F675F6E756D62657200446E616D654C746573745F73635F3030303145696D6167655835697066733A2F2F516D563965334E6E58484B71386E6D7A42337A4C725065784E677252346B7A456865415969563648756562367141466C656E6774680C467261726974794562617369634776657273696F6E01496D65646961547970654A696D6167652F6A7065674A63686172616374657273576C6574746572732C6E756D626572732C7370656369616C516E756D657269635F6D6F64696669657273404A7375625F6C656E677468044A7375625F7261726974794562617369634E7375625F6368617261637465727340557375625F6E756D657269635F6D6F646966696572734001B34E7374616E646172645F696D6167655835697066733A2F2F516D563965334E6E58484B71386E6D7A42337A4C725065784E677252346B7A4568654159695636487565623671414862675F696D61676540497066705F696D6167654046706F7274616C404864657369676E65725835697066733A2F2F516D636B79584661486E51696375587067527846564B353251784D524E546D364E686577465055564E5A7A3148504676656E646F72404764656661756C7400536C6173745F7570646174655F6164647265737342ABCD527265736F6C7665645F616464726573736573A143616461583A3631386532323564623935383935653738303439363538396238396463366162613030313139666261393738333466323265393538313065363247736F6369616C735835697066733A2F2F516D566D3538696F5555754A7367534C474C357A6D635A62714D654D6355583251385056787742436E53544244764A696D6167655F6861736842ABCD537374616E646172645F696D6167655F6861736842ABCD4B7376675F76657273696F6E45312E302E304C76616C6964617465645F6279404C6167726565645F7465726D7340546D6967726174655F7369675F72657175697265640045747269616C00446E73667700477669727475616CA24C657870697265735F74696D65014B7075626C69635F6D696E7400FF';

        await ogmios['processBlock']({
            txBlock: txBlock({
                policy: policyId,
                handleHexName,
                isMint: false,
                datum: cbor
            }),
            tip
        });

        expect(savePersonalizationChangeSpy).toHaveBeenCalledWith({
            amount: 1,
            bg_image: '',
            pfp_image: '',
            characters: 'letters',
            created_slot_number: 0,
            default_in_wallet: '',
            handle_type: 'virtual_subhandle',
            has_datum: false,
            holder: 'addr_test1xccnsefjxg6kgc3ex5urjdt9xuurqdpexc6nswtz8qukgcekv93xzvpsxycnjenzvyunwwpnx3nryvn98y6nsvfsv5mry0c0xr6',
            holder_type: 'script',
            image: '',
            image_hash: '0xabcd',
            last_update_address: '0xabcd',
            lovelace: 0,
            name: 'virtual@hndl',
            payment_key_hash: '31386532323564623935383935653738303439363538396238396463',
            hex: '000000007669727475616c40686e646c',
            length: 12,
            numeric_modifiers: '',
            og_number: 0,
            policy: 'f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a',
            pz_enabled: false,
            rarity: 'basic',
            reference_token: {
                address: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q',
                datum: cbor,
                index: 0,
                lovelace: 1,
                tx_id: 'some_id'
            },
            resolved_addresses:  {
                ada: 'addr_test1xccnsefjxg6kgc3ex5urjdt9xuurqdpexc6nswtz8qukgcekv93xzvpsxycnjenzvyunwwpnx3nryvn98y6nsvfsv5mry0c0xr6'
            },
            standard_image: '',
            standard_image_hash: '0xabcd',
            sub_characters: 'letters',
            sub_length: 7,
            sub_numeric_modifiers: '',
            sub_rarity: 'common',
            svg_version: '1.0.0',
            updated_slot_number: 0,
            utxo: 'some_id#0',
            version: 0,
            personalization: {
                designer: {test: 'data'},
                socials: {test: 'data'},
                trial: false,
                nsfw: false,
                validated_by: '0x'
            },
            virtual: {
                expires_time: 1,
                public_mint: false
            }
        }, undefined);
    });

    it('Should validate datum', async () => {
        const handleName = `burritos`;
        const handleHexName = `${AssetNameLabel.LBL_100}${Buffer.from(handleName).toString('hex')}`;

        const savePersonalizationChangeSpy = jest.spyOn(HandlesRepository.prototype, 'save');
        jest.spyOn(HandlesRepository.prototype, 'getMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });
        jest.spyOn(ipfs, 'decodeCborFromIPFSFile').mockResolvedValue({ test: 'data' });
        const loggerSpy = jest.spyOn(Logger, 'log').mockImplementation();

        await ogmios['processBlock']({
            txBlock: txBlock({
                policy: policyId,
                handleHexName,
                isMint: false,
                datum: 'd87a9fa1446e616d65447461636fff'
            }),
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
        const handleHexName = `${AssetNameLabel.LBL_100}${Buffer.from(handleName).toString('hex')}`;
        const savePersonalizationChangeSpy = jest.spyOn(HandlesRepository.prototype, 'save');
        const loggerSpy = jest.spyOn(Logger, 'log');
        jest.spyOn(HandlesRepository.prototype, 'getMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });

        await ogmios['processBlock']({
            txBlock: txBlock({ policy: policyId, handleHexName, isMint: false }),
            tip
        });

        expect(savePersonalizationChangeSpy).toHaveBeenCalledTimes(0);
        expect(loggerSpy).toHaveBeenCalledWith({
            category: 'ERROR',
            event: 'processScannedHandleInfo.referenceToken.noDatum',
            message: 'No datum for reference token 000643b06275727269746f73'
        });
    });

    it('Should burn tokens', async () => {
        const slot = 1234;
        const handleName = `burritos`;
        const handleHexName = `${AssetNameLabel.LBL_100}${Buffer.from(handleName).toString('hex')}`;
        const burnHandleSpy = jest.spyOn(HandlesRepository.prototype, 'removeHandle').mockImplementation();
        jest.spyOn(HandlesRepository.prototype, 'getMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });

        await repo.save(await repo.Internal.buildHandle({name: handleName, hex: handleHexName, policy: policyId, resolved_addresses: {ada: defaultAddress}}))

        await ogmios['processBlock']({
            txBlock: txBlock({ policy: policyId, handleHexName, isBurn: true, slot }),
            tip
        });

        expect(burnHandleSpy).toHaveBeenCalledWith({
            amount: 1,
            characters: 'letters',
            created_slot_number: 0,
            datum: undefined,
            default_in_wallet: 'burritos',
            drep: undefined,
            handle_type: 'handle',
            has_datum: false,
            hex: '000643b06275727269746f73',
            holder: 'stake_test1urc63cmezfacz9vrqu867axmqrvgp4zsyllxzud3k6danjsn0dn70',
            holder_type: 'wallet',
            image: '',
            image_hash: '',
            length: 8,
            lovelace: 0,
            name: 'burritos',
            numeric_modifiers: '',
            og_number: 0,
            payment_key_hash: '9a2bb4492f1a7b2a1c10c8cc37fe3fe2b4e613704ba5331cb94b6388',
            policy: 'f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a',
            rarity: 'basic',
            resolved_addresses: {
                ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q'
            },
            standard_image: '',
            standard_image_hash: '',
            sub_characters: undefined,
            sub_length: undefined,
            sub_numeric_modifiers: undefined,
            sub_rarity: undefined,
            svg_version: '0',
            updated_slot_number: 0,
            utxo: '',
            version: 0
        }, slot);
    });

    describe('isValidDatum tests', () => {
        it('should return null for invalid datum', async () => {
            const datum = await encodeJsonToDatum({
                constructor_12: [{}, 1, {}]
            });
            const result = await repo['_buildPersonalizationData']('taco', 'taco', datum);
            expect(result).toEqual({ metadata: null, personalizationDatum: null });
        });

        it('should return empty datum', async () => {
            const datum = await encodeJsonToDatum({
                constructor_0: [{}, 1, {}]
            });
            const result = await repo['_buildPersonalizationData']('taco', 'taco', datum);
            expect(result).toEqual({ metadata: {}, personalizationDatum: {} });
        });

        it('should return invalid datum', async () => {
            const datum = await encodeJsonToDatum({
                constructor_0: [{ a: 'a' }, 1, { b: 'b' }]
            }, {defaultToText:true});
            const result = await repo['_buildPersonalizationData']('taco', 'taco', datum);
            expect(result).toEqual({ metadata: { a: 'a' }, personalizationDatum: { b: 'b' } });
        });

        it('should return pz datum even with one missing required field', async () => {
            const datum = await encodeJsonToDatum({
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
            });

            const result = await repo['_buildPersonalizationData']('taco', 'taco', datum);
            expect(result).toEqual({
                metadata: {
                    characters: '',
                    image: '',
                    length: 0,
                    mediaType: '',
                    name: '',
                    numeric_modifiers: '',
                    og: false,
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
                    last_update_address: '0x',
                    validated_by: '0x'
                }
            });
        });

        it('should return true for valid datum', async () => {
            const datum = await encodeJsonToDatum({
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
            });
            const result = await repo['_buildPersonalizationData']('taco', 'taco', datum);
            expect(result).toBeTruthy();
        });

        it('should build valid datum for NFT Sub handle', async () => {
            const datum = await encodeJsonToDatum({
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
                        version: 0,
                        holder_type: HandleType.NFT_SUBHANDLE,
                        sub_characters: '',
                        sub_length: 0,
                        sub_numeric_modifiers: '',
                        sub_rarity: ''
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
            });
            const result = await repo['_buildPersonalizationData']('taco', 'taco', datum);
            expect(result).toBeTruthy();
        });
    });
});
