import { BlockPraos, Script, Tip } from '@cardano-ogmios/schema';
import { AssetNameLabel, HandleType, IHandlesRepository, Logger, Rarity, StoredHandle } from '@koralabs/kora-labs-common';
import { MemoryHandlesRepository } from '../../repositories/memory/handles.repository';
import * as ipfs from '../../utils/ipfs';
import OgmiosService from './ogmios.service';

const ogmios = new OgmiosService(MemoryHandlesRepository as unknown as IHandlesRepository);

describe('processBlock Tests', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    const tip: Tip = {
        slot: 0,
        id: 'some_hash',
        height: 0
    };

    const policyId = 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q';
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

    const txBlock = ({ address = 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q', policy = policyId, handleHexName = hexName, handleName = name, isMint = true, datum = undefined, script = undefined, isBurn = false, slot = 0 }: { address?: string | undefined; policy?: string | undefined; handleHexName?: string | undefined; handleName?: string | undefined; isMint?: boolean | undefined; datum?: string; script?: Script; isBurn?: boolean; slot?: number }): BlockPraos => ({
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
                                    [handleHexName]: BigInt(1)
                                }
                            }
                        }
                    ],
                    mint: isMint
                        ? {
                            [policyId]: {
                                [handleHexName]: BigInt(1)
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

    const expectedItem: StoredHandle = {
        characters: 'letters,numbers',
        hex: hexName,
        holder: 'some_stake1',
        length: 8,
        name,
        image: 'some_hash_test1234',
        utxo: 'utxo1#0',
        lovelace: 0,
        numeric_modifiers: '',
        og_number: 1,
        standard_image: 'some_hash_test1234',
        rarity: Rarity.basic,
        resolved_addresses: { ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q' },
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
        holder_type: 'wallet',
        version: 0,
        handle_type: HandleType.HANDLE,
        default: false,
        payment_key_hash: ''
    };

    it('Should save a new handle to the datastore and set metrics', async () => {
        const saveSpy = jest.spyOn(MemoryHandlesRepository.prototype, 'saveMintedHandle');
        const setMetricsSpy = jest.spyOn(MemoryHandlesRepository.prototype, 'setMetrics');
        jest.spyOn(MemoryHandlesRepository.prototype, 'getTimeMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });

        await ogmios['processBlock']({ policyId, txBlock: txBlock({}), tip });

        expect(saveSpy).toHaveBeenCalledWith({
            adaAddress: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q',
            hex: '7465737431323334',
            image: 'ifps://some_hash_test1234',
            name: 'test1234',
            og_number: 0,
            slotNumber: 0,
            utxo: 'some_id#0',
            version: 0,
            handle_type: HandleType.HANDLE,
            lovelace: 1,
            sub_characters: undefined,
            sub_length: undefined,
            sub_numeric_modifiers: undefined,
            sub_rarity: undefined
        });

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
        const saveSpy = jest.spyOn(MemoryHandlesRepository.prototype, 'saveMintedHandle');

        jest.spyOn(MemoryHandlesRepository.prototype, 'getTimeMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });

        await ogmios['processBlock']({ policyId, txBlock: txBlock({ datum }), tip });

        expect(saveSpy).toHaveBeenCalledWith({
            adaAddress: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q',
            hex: '7465737431323334',
            image: 'ifps://some_hash_test1234',
            name: 'test1234',
            og_number: 0,
            slotNumber: 0,
            utxo: 'some_id#0',
            datum,
            version: 0,
            handle_type: HandleType.HANDLE,
            lovelace: 1,
            sub_characters: undefined,
            sub_length: undefined,
            sub_numeric_modifiers: undefined,
            sub_rarity: undefined
        });
    });

    it('Should save script', async () => {
        const script: Script = { language: 'plutus:v2', cbor: 'a2some_cbor' };
        const saveSpy = jest.spyOn(MemoryHandlesRepository.prototype, 'saveMintedHandle');

        jest.spyOn(MemoryHandlesRepository.prototype, 'getTimeMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });

        await ogmios['processBlock']({ policyId, txBlock: txBlock({ script }), tip });

        expect(saveSpy).toHaveBeenCalledWith({
            adaAddress: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q',
            hex: '7465737431323334',
            image: 'ifps://some_hash_test1234',
            name: 'test1234',
            og_number: 0,
            slotNumber: 0,
            utxo: 'some_id#0',
            script: {
                type: 'plutus_v2',
                cbor: 'a2some_cbor'
            },
            version: 0,
            handle_type: HandleType.HANDLE,
            lovelace: 1,
            sub_characters: undefined,
            sub_length: undefined,
            sub_numeric_modifiers: undefined,
            sub_rarity: undefined,
            datum: undefined
        });
    });

    it('Should update a handle when it is not a mint', async () => {
        const newAddress = 'addr456';
        const saveHandleUpdateSpy = jest.spyOn(MemoryHandlesRepository.prototype, 'saveHandleUpdate');
        jest.spyOn(MemoryHandlesRepository.prototype, 'setMetrics');
        jest.spyOn(MemoryHandlesRepository.prototype, 'getTimeMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });
        jest.spyOn(MemoryHandlesRepository.prototype, 'get').mockReturnValue(expectedItem);

        await ogmios['processBlock']({ policyId, txBlock: txBlock({ address: newAddress, isMint: false }), tip });

        expect(saveHandleUpdateSpy).toHaveBeenCalledWith({
            adaAddress: newAddress,
            hex: hexName,
            name,
            slotNumber: 0,
            utxo: 'some_id#0',
            handle_type: HandleType.HANDLE,
            datum: undefined,
            lovelace: 1,
            script: undefined,
            image: 'ifps://some_hash_test1234',
            og_number: 0,
            version: 0
        });
    });

    it('Should not save anything if policyId does not match', async () => {
        const saveSpy = jest.spyOn(MemoryHandlesRepository.prototype, 'saveMintedHandle');
        const saveAddressSpy = jest.spyOn(MemoryHandlesRepository.prototype, 'saveHandleUpdate');

        await ogmios['processBlock']({ policyId, txBlock: txBlock({ policy: 'no-ada-handle' }), tip });

        expect(saveSpy).toHaveBeenCalledTimes(0);
        expect(saveAddressSpy).toHaveBeenCalledTimes(0);
    });

    it('Should process 222 asset class token mint', async () => {
        const handleName = `burritos`;
        const handleHexName = `${AssetNameLabel.LBL_222}${Buffer.from(handleName).toString('hex')}`;
        const saveSpy = jest.spyOn(MemoryHandlesRepository.prototype, 'saveMintedHandle');
        jest.spyOn(MemoryHandlesRepository.prototype, 'getTimeMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });

        await ogmios['processBlock']({
            policyId,
            txBlock: txBlock({ handleHexName }) as BlockPraos,
            tip
        });

        expect(saveSpy).toHaveBeenCalledWith({
            adaAddress: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q',
            datum: undefined,
            hex: `${AssetNameLabel.LBL_222}6275727269746f73`,
            image: '',
            name: handleName,
            og_number: 0,
            slotNumber: 0,
            utxo: 'some_id#0',
            version: 0,
            handle_type: HandleType.HANDLE,
            lovelace: 1,
            sub_characters: undefined,
            sub_length: undefined,
            sub_numeric_modifiers: undefined,
            sub_rarity: undefined
        });
    });

    it('Should process 222 update', async () => {
        const handleName = `burritos`;
        const handleHexName = `${AssetNameLabel.LBL_222}${Buffer.from(handleName).toString('hex')}`;
        const saveHandleUpdateSpy = jest.spyOn(MemoryHandlesRepository.prototype, 'saveHandleUpdate');
        jest.spyOn(MemoryHandlesRepository.prototype, 'getTimeMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });

        await ogmios['processBlock']({
            policyId,
            txBlock: txBlock({ handleHexName, isMint: false }) as BlockPraos,
            tip
        });

        expect(saveHandleUpdateSpy).toHaveBeenCalledWith({
            adaAddress: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q',
            datum: undefined,
            hex: `${AssetNameLabel.LBL_222}6275727269746f73`,
            name: 'burritos',
            slotNumber: 0,
            utxo: 'some_id#0',
            handle_type: HandleType.HANDLE,
            lovelace: 1,
            script: undefined,
            image: '',
            og_number: 0,
            version: 0
        });
    });

    it('Should process 100 asset class tokens', async () => {
        const handleName = `burritos`;
        const handleHexName = `${AssetNameLabel.LBL_100}${Buffer.from(handleName).toString('hex')}`;

        const savePersonalizationChangeSpy = jest.spyOn(MemoryHandlesRepository.prototype, 'savePersonalizationChange');
        jest.spyOn(MemoryHandlesRepository.prototype, 'getTimeMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });
        jest.spyOn(ipfs, 'decodeCborFromIPFSFile').mockResolvedValue({ test: 'data' });

        const cbor =
            'd8799faa426f6700496f675f6e756d62657200446e616d654c746573745f73635f3030303145696d6167655835697066733a2f2f516d563965334e6e58484b71386e6d7a42337a4c725065784e677252346b7a456865415969563648756562367141466c656e6774680c467261726974794562617369634776657273696f6e01496d65646961547970654a696d6167652f6a7065674a63686172616374657273576c6574746572732c6e756d626572732c7370656369616c516e756d657269635f6d6f646966696572734001b24e7374616e646172645f696d6167655835697066733a2f2f516d563965334e6e58484b71386e6d7a42337a4c725065784e677252346b7a4568654159695636487565623671414862675f696d61676540497066705f696d6167654046706f7274616c404864657369676e65725835697066733a2f2f516d636b79584661486e51696375587067527846564b353251784d524e546d364e686577465055564e5a7a3148504676656e646f72404764656661756c7400536c6173745f7570646174655f6164647265737342abcd47736f6369616c735835697066733a2f2f516d566d3538696f5555754a7367534c474c357a6d635a62714d654d6355583251385056787742436e53544244764a696d6167655f6861736842abcd537374616e646172645f696d6167655f6861736842abcd4b7376675f76657273696f6e45312e302e304c76616c6964617465645f6279404c6167726565645f7465726d7340546d6967726174655f7369675f726571756972656400527265736f6c7665645f616464726573736573a34361646142abcd436274634f7133736b64736b6a6b656a326b6e644365746849333234656b646a6b3345747269616c00446e73667700ff';

        await ogmios['processBlock']({
            policyId,
            txBlock: txBlock({
                handleHexName,
                isMint: false,
                datum: cbor
            }),
            tip
        });

        expect(savePersonalizationChangeSpy).toHaveBeenCalledWith({
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
                address: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q'
            },
            personalizationDatum: {
                agreed_terms: '',
                bg_image: '',
                default: false,
                designer: 'ipfs://QmckyXFaHnQicuXpgRxFVK52QxMRNTm6NhewFPUVNZz1HP',
                image_hash: '0xabcd',
                last_update_address: '0xabcd',
                migrate_sig_required: false,
                nsfw: false,
                pfp_image: '',
                portal: '',
                socials: 'ipfs://QmVm58ioUUuJsgSLGL5zmcZbqMeMcUX2Q8PVxwBCnSTBDv',
                standard_image: 'ipfs://QmV9e3NnXHKq8nmzB3zLrPexNgrR4kzEheAYiV6Hueb6qA',
                standard_image_hash: '0xabcd',
                svg_version: '1.0.0',
                resolved_addresses: {
                    ada: '0xabcd',
                    btc: 'q3skdskjkej2knd',
                    eth: '324ekdjk3'
                },
                trial: false,
                validated_by: '0x',
                vendor: ''
            },
            slotNumber: 0
        });
    });

    it('Should process 001 SubHandle settings token', async () => {
        const handleName = `burritos`;
        const handleHexName = `${AssetNameLabel.LBL_001}${Buffer.from(handleName).toString('hex')}`;

        const saveSubHandleSettingsChangeSpy = jest.spyOn(MemoryHandlesRepository.prototype, 'saveSubHandleSettingsChange');
        jest.spyOn(MemoryHandlesRepository.prototype, 'getTimeMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });
        jest.spyOn(ipfs, 'decodeCborFromIPFSFile').mockResolvedValue({ test: 'data' });

        const cbor = '9f9f01019f9f011a0bebc200ff9f021a05f5e100ff9f031a02faf080ff9f041a00989680ffffa14862675f696d6167654000ff9f000080a14862675f696d6167654000ff0000581a687474703a2f2f6c6f63616c686f73743a333030372f23746f755f5840616464725f746573743171707963336a6b65346730743675656d7a657466746e6c306a65306135746879396b346a6d707679637361733838796b6c7977367430582c64336a74307a6739776e756d677866746b3966743877766a787a633672656c74676c6c6b7373356e7a617434ff00ff';

        await ogmios['processBlock']({
            policyId,
            txBlock: txBlock({
                handleHexName,
                isMint: false,
                datum: cbor
            }),
            tip
        });

        expect(saveSubHandleSettingsChangeSpy).toHaveBeenCalledWith({
            name: 'burritos',
            utxoDetails: { address: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q', datum: '9f9f01019f9f011a0bebc200ff9f021a05f5e100ff9f031a02faf080ff9f041a00989680ffffa14862675f696d6167654000ff9f000080a14862675f696d6167654000ff0000581a687474703a2f2f6c6f63616c686f73743a333030372f23746f755f5840616464725f746573743171707963336a6b65346730743675656d7a657466746e6c306a65306135746879396b346a6d707679637361733838796b6c7977367430582c64336a74307a6739776e756d677866746b3966743877766a787a633672656c74676c6c6b7373356e7a617434ff00ff', index: 0, lovelace: 1, tx_id: 'some_id' },
            settingsDatum: cbor,
            slotNumber: 0
        });
    });

    it('should process as NFT Sub handle', async () => {
        const handleName = `sub@hndl`;
        const handleHexName = `${AssetNameLabel.LBL_222}${Buffer.from(handleName).toString('hex')}`;

        const saveMintedHandleSpy = jest.spyOn(MemoryHandlesRepository.prototype, 'saveMintedHandle');
        jest.spyOn(MemoryHandlesRepository.prototype, 'getTimeMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });

        await ogmios['processBlock']({
            policyId,
            txBlock: txBlock({
                handleHexName,
                isMint: true
            }) as BlockPraos,
            tip
        });

        expect(saveMintedHandleSpy).toHaveBeenCalledWith({
            adaAddress: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q',
            datum: undefined,
            hex: handleHexName,
            image: '',
            name: handleName,
            og_number: 0,
            script: undefined,
            slotNumber: 0,
            handle_type: HandleType.NFT_SUBHANDLE,
            utxo: 'some_id#0',
            version: 0,
            lovelace: 1,
            sub_characters: undefined,
            sub_length: undefined,
            sub_numeric_modifiers: undefined,
            sub_rarity: undefined
        });
    });

    it('Should process virtual sub handle', async () => {
        const handleName = `virtual@hndl`;
        const handleHexName = `${AssetNameLabel.LBL_000}${Buffer.from(handleName).toString('hex')}`;

        const savePersonalizationChangeSpy = jest.spyOn(MemoryHandlesRepository.prototype, 'savePersonalizationChange');
        jest.spyOn(MemoryHandlesRepository.prototype, 'getTimeMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });
        jest.spyOn(ipfs, 'decodeCborFromIPFSFile').mockResolvedValue({ test: 'data' });

        const cbor =
            'd8799fae426f6700496f675f6e756d62657200446e616d654c746573745f73635f3030303145696d6167655835697066733a2f2f516d563965334e6e58484b71386e6d7a42337a4c725065784e677252346b7a456865415969563648756562367141466c656e6774680c467261726974794562617369634776657273696f6e01496d65646961547970654a696d6167652f6a7065674a63686172616374657273576c6574746572732c6e756d626572732c7370656369616c516e756d657269635f6d6f64696669657273404a7375625f6c656e677468044a7375625f7261726974794562617369634e7375625f6368617261637465727340557375625f6e756d657269635f6d6f646966696572734001b14e7374616e646172645f696d6167655835697066733a2f2f516d563965334e6e58484b71386e6d7a42337a4c725065784e677252346b7a4568654159695636487565623671414862675f696d61676540497066705f696d6167654046706f7274616c404864657369676e65725835697066733a2f2f516d636b79584661486e51696375587067527846564b353251784d524e546d364e686577465055564e5a7a3148504676656e646f72404764656661756c7400536c6173745f7570646174655f6164647265737342abcd47736f6369616c735835697066733a2f2f516d566d3538696f5555754a7367534c474c357a6d635a62714d654d6355583251385056787742436e53544244764a696d6167655f6861736842abcd537374616e646172645f696d6167655f6861736842abcd4b7376675f76657273696f6e45312e302e304c76616c6964617465645f6279404c6167726565645f7465726d7340546d6967726174655f7369675f72657175697265640045747269616c00446e73667700ff';

        await ogmios['processBlock']({
            policyId,
            txBlock: txBlock({
                handleHexName,
                isMint: false,
                datum: cbor
            }),
            tip
        });

        expect(savePersonalizationChangeSpy).toHaveBeenCalledWith({
            hex: handleHexName,
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
                version: 1,
                sub_characters: '',
                sub_length: 4,
                sub_numeric_modifiers: '',
                sub_rarity: 'basic'
            },
            name: handleName,
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
                address: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q'
            },
            personalizationDatum: {
                agreed_terms: '',
                bg_image: '',
                default: false,
                designer: 'ipfs://QmckyXFaHnQicuXpgRxFVK52QxMRNTm6NhewFPUVNZz1HP',
                image_hash: '0xabcd',
                last_update_address: '0xabcd',
                migrate_sig_required: false,
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
        const handleHexName = `${AssetNameLabel.LBL_100}${Buffer.from(handleName).toString('hex')}`;

        const savePersonalizationChangeSpy = jest.spyOn(MemoryHandlesRepository.prototype, 'savePersonalizationChange');
        jest.spyOn(MemoryHandlesRepository.prototype, 'getTimeMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });
        jest.spyOn(ipfs, 'decodeCborFromIPFSFile').mockResolvedValue({ test: 'data' });
        const loggerSpy = jest.spyOn(Logger, 'log').mockImplementation();

        await ogmios['processBlock']({
            policyId,
            txBlock: txBlock({
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
        const savePersonalizationChangeSpy = jest.spyOn(MemoryHandlesRepository.prototype, 'savePersonalizationChange');
        const loggerSpy = jest.spyOn(Logger, 'log');
        jest.spyOn(MemoryHandlesRepository.prototype, 'getTimeMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });

        await ogmios['processBlock']({
            policyId,
            txBlock: txBlock({ handleHexName, isMint: false }),
            tip
        });

        expect(savePersonalizationChangeSpy).toHaveBeenCalledTimes(0);
        expect(loggerSpy).toHaveBeenCalledWith({
            category: 'ERROR',
            event: 'processBlock.processAssetReferenceToken.noDatum',
            message: 'no datum for reference token 000643b06275727269746f73'
        });
    });

    it('Should burn tokens', async () => {
        const slot = 1234;
        const handleName = `burritos`;
        const handleHexName = `${AssetNameLabel.LBL_100}${Buffer.from(handleName).toString('hex')}`;
        const burnHandleSpy = jest.spyOn(MemoryHandlesRepository.prototype, 'burnHandle').mockImplementation();
        jest.spyOn(MemoryHandlesRepository.prototype, 'getTimeMetrics').mockReturnValue({ elapsedOgmiosExec: 0, elapsedBuildingExec: 0 });

        await ogmios['processBlock']({
            policyId,
            txBlock: txBlock({ handleHexName, isBurn: true, slot }),
            tip
        });

        expect(burnHandleSpy).toHaveBeenCalledWith(handleName, slot);
    });

    describe('isValidDatum tests', () => {
        it('should return null for invalid datum', () => {
            const datum = {
                constructor_12: [{}, 1, {}]
            };
            const result = ogmios['buildValidDatum']('taco', 'taco', datum);
            expect(result).toEqual({ metadata: null, personalizationDatum: null });
        });

        it('should return empty datum', () => {
            const datum = {
                constructor_0: [{}, 1, {}]
            };
            const result = ogmios['buildValidDatum']('taco', 'taco', datum);
            expect(result).toEqual({ metadata: {}, personalizationDatum: {} });
        });

        it('should return invalid datum', () => {
            const datum = {
                constructor_0: [{ a: 'a' }, 1, { b: 'b' }]
            };
            const result = ogmios['buildValidDatum']('taco', 'taco', datum);
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

            const result = ogmios['buildValidDatum']('taco', 'taco', datum);
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
            const result = ogmios['buildValidDatum']('taco', 'taco', datum);
            expect(result).toBeTruthy();
        });

        it('should build valid datum for NFT Sub handle', () => {
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
            };
            const result = ogmios['buildValidDatum']('taco', 'taco', datum);
            expect(result).toBeTruthy();
        });
    });
});
