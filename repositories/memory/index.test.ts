import * as klc from '@koralabs/kora-labs-common';
import { delay, HandleType, IHandleMetadata, IPersonalization, IReferenceToken, Logger } from '@koralabs/kora-labs-common';
import { unlinkSync, writeFileSync } from 'fs';
import { MemoryHandlesProvider } from '.';
import * as config from '../../config';
import { HandlesRepository } from '../handlesRepository';
import { HandleStore } from './handleStore';
import { handlesFixture } from './tests/fixtures/handles';
const provider = new MemoryHandlesProvider();
const repo = new HandlesRepository(provider);
const policy = 'f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a';

//const klc = {getAddressHolderDetails, bech32FromHex};
jest.mock('@koralabs/kora-labs-common', () => ({
    __esModule: true,
    // @ts-ignore
    ...jest.requireActual('@koralabs/kora-labs-common')
}));

jest.mock('fs', () => ({
    promises: {
        writeFile: jest.fn().mockImplementation(),
        readFile: jest.fn().mockImplementation(async (path, content) => {
            if (path.includes('taco.datum')) {
                return JSON.stringify({ utxo: '123#1', datum: 'abc123' });
            }

            return Promise.reject({ code: 'ENOENT', message: 'File not found' });
        }),
        unlink: jest.fn().mockImplementation(async () => Promise.reject({ code: 'ENOENT', message: 'File not found' }))
    },
    writeFileSync: jest.fn().mockImplementation(),
    unlinkSync: jest.fn().mockImplementation()
}));

jest.mock('cross-fetch');
jest.mock('proper-lockfile');

jest.spyOn(config, 'isDatumEndpointEnabled').mockReturnValue(true);

describe('HandleStore tests', () => {
    const filePath = 'storage/handles-test.json';
    const defaultReferenceToken: IReferenceToken = {
        tx_id: 'default_ref_tx',
        index: 0,
        lovelace: 0,
        datum: '',
        address: ''
    };
    beforeEach(async () => {
        repo.setMetrics({ currentSlot: 1, lastSlot: 2 });
        // populate storage
        for (const key in handlesFixture) {
            const handle = handlesFixture[key];
            await repo.save({
                ...handle,
                datum: `some_datum_${key}`,
                has_datum: true
            });
        }
    });

    afterEach(async () => {
        const handles = repo.getAllHandleNames(undefined).filter(Boolean);
        for (const handle of handles) {            
            await repo.removeHandle(repo.get(handle)!, 0);
        }

        HandleStore.slotHistoryIndex = new Map();
        HandleStore.holderIndex = new Map();

        jest.clearAllMocks();
    });

    beforeAll(async () => {
        // create test file
        writeFileSync(filePath, '{}');
    });

    afterAll(() => {
        unlinkSync(filePath);
    });

    describe.skip('getFile tests', () => {
        it('should not allow reading if file is locked', async () => {
            await provider.Internal.saveHandlesFile(123, 'some-hash', filePath);
            const file = await provider.Internal.getFile(filePath);
            expect(file).toEqual({
                slot: 123,
                hash: 'some-hash',
                schemaVersion: 1,
                handles: expect.any(Object)
            });
            provider.Internal.saveHandlesFile(123, 'some-hash', filePath, true);
            await delay(100);
            const locked = await provider.Internal.getFile(filePath);
            expect(locked).toEqual(null);
        });
    });

    describe('get', () => {
        it('should return a handle', () => {
            const handle = repo.get('barbacoa');
            expect(handle).toEqual({
                bg_image: '',
                characters: 'letters',
                created_slot_number: expect.any(Number),
                datum: 'some_datum_0',
                default_in_wallet: 'taco',
                has_datum: true,
                hex: Buffer.from('barbacoa').toString('hex'),
                holder: 'stake_test1urc63cmezfacz9vrqu867axmqrvgp4zsyllxzud3k6danjsn0dn70',
                length: 8,
                name: 'barbacoa',
                image: '',
                image_hash: '',
                last_update_address: '',
                svg_version: '1.0.0',
                standard_image_hash: '',
                numeric_modifiers: '',
                og_number: 0,
                standard_image: '',
                pfp_image: '',
                rarity: 'basic',
                resolved_addresses: { ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q' },
                updated_slot_number: expect.any(Number),
                utxo: 'utxo1#0',
                policy,
                lovelace: 0,
                amount: 1,
                holder_type: 'wallet',
                version: 0,
                handle_type: HandleType.HANDLE,
                payment_key_hash: '9a2bb4492f1a7b2a1c10c8cc37fe3fe2b4e613704ba5331cb94b6388'
            });
        });
    });

    describe('getByHex', () => {
        it('should return a handle', () => {
            const handle = repo.getHandleByHex(Buffer.from('barbacoa').toString('hex'));
            expect(handle?.name).toEqual('barbacoa');
        });
    });

    describe('save tests', () => {
        it('Should save a new handle', async () => {
            let handle = await repo.Internal.buildHandle({
                hex: Buffer.from('nachos').toString('hex'),
                name: 'nachos',
                og_number: 0,
                utxo: 'utxo123#0',
                policy,
                lovelace: 0,
                image: 'ipfs://123',
                datum: 'datum123',
                image_hash: '0x123',
                svg_version: '1.0.0',
                standard_image: 'ipfs://123',
                standard_image_hash: '0x123',
                handle_type: HandleType.HANDLE,
                resolved_addresses: {ada: 'addr_test1qqpdrn4j46emtfydwfc0j2gtw2ty0zgwtr3k0srmjg7nwy834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qept00g'},
                updated_slot_number: 100
            });

            await repo.save(handle);

            handle = repo.get('nachos')!;

            // expect to get the correct handle properties
            expect(handle).toEqual({
                characters: 'letters',
                created_slot_number: 100,
                default_in_wallet: 'taco',
                hex: Buffer.from('nachos').toString('hex'),
                holder: 'stake_test1urc63cmezfacz9vrqu867axmqrvgp4zsyllxzud3k6danjsn0dn70',
                length: 6,
                name: 'nachos',
                image: 'ipfs://123',
                image_hash: '0x123',
                numeric_modifiers: '',
                og_number: 0,
                standard_image: 'ipfs://123',
                standard_image_hash: '0x123',
                svg_version: '1.0.0',
                rarity: 'common',
                resolved_addresses: { ada: 'addr_test1qqpdrn4j46emtfydwfc0j2gtw2ty0zgwtr3k0srmjg7nwy834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qept00g' },
                updated_slot_number: 100,
                utxo: 'utxo123#0',
                policy,
                lovelace: 0,
                has_datum: true,
                datum: 'datum123',
                amount: 1,
                holder_type: 'wallet',
                version: 0,
                handle_type: HandleType.HANDLE,
                payment_key_hash: '02d1ceb2aeb3b5a48d7270f9290b729647890e58e367c07b923d3710'
            });

            // expect to get the correct slot history with all new handles
            expect(Array.from(HandleStore.slotHistoryIndex)).toEqual([
                [expect.any(Number), { barbacoa: { new: { name: 'barbacoa' }, old: null } }],
                [expect.any(Number), { burrito: { new: { name: 'burrito' }, old: null } }],
                [expect.any(Number), { taco: { new: { name: 'taco' }, old: null } }],
                [expect.any(Number), { nachos: { new: { name: 'nachos' }, old: null } }]
            ]);
        });

        it('Should find existing handle and add personalization', async () => {
            const personalizationData: IPersonalization = {
                designer: {
                    font_shadow_color: '0xtodo'
                },
                validated_by: 'todo',
                trial: false,
                nsfw: false
            };

            await repo.save(await repo.Internal.buildHandle({
                hex: Buffer.from('chimichanga').toString('hex'),
                name: 'chimichanga',
                updated_slot_number: 99,
                personalization: personalizationData,
                reference_token: defaultReferenceToken,
                policy,
                pfp_image: 'todo',
                bg_image: 'todo',
                image_hash: '0x123',
                standard_image_hash: '0x123',
                svg_version: '1.0.0',
                standard_image: '',
                last_update_address: '',
                id_hash: '0x0fed83b6268892be468965a7fa0705ff22014c4b78a6ba82b4d65fe395d6d5ee9f',
                resolved_addresses: { ada: '', btc: '2213kjsjkn', eth: 'sad2wsad' }
            }, {
                name: 'chimichanga',
                image: 'ipfs://123',
                mediaType: 'image/jpeg',
                og: 0,
                og_number: 0,
                rarity: 'todo',
                length: 10,
                characters: 'todo',
                numeric_modifiers: 'todo',
                version: 0,
                handle_type: HandleType.HANDLE
            }));

            let handle = repo.get('chimichanga');
            await repo.save(await repo.Internal.buildHandle({
                ...handle,
                utxo: 'utxo123#0',
                image_hash: '0xtodo',
                resolved_addresses: {ada:'addr_test1qqpdrn4j46emtfydwfc0j2gtw2ty0zgwtr3k0srmjg7nwy834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qept00g'},
                updated_slot_number: 100
            }), handle!);

            handle = repo.get('chimichanga');

            // expect the personalization data to be added to the handle
            expect(handle?.personalization).toEqual(personalizationData);

            expect(Array.from(HandleStore.slotHistoryIndex)).toEqual([
                [expect.any(Number), { barbacoa: { new: { name: 'barbacoa' }, old: null } }],
                [expect.any(Number), { burrito: { new: { name: 'burrito' }, old: null } }],
                [expect.any(Number), { taco: { new: { name: 'taco' }, old: null } }],
                [99, { chimichanga: { new: { name: 'chimichanga' }, old: null } }],
                [
                    100,
                    {
                        chimichanga: {
                            new: {
                                resolved_addresses: { ada: 'addr_test1qqpdrn4j46emtfydwfc0j2gtw2ty0zgwtr3k0srmjg7nwy834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qept00g' },
                                updated_slot_number: 100,
                                utxo: 'utxo123#0',
                                image_hash: '0xtodo',
                                holder: 'stake_test1urc63cmezfacz9vrqu867axmqrvgp4zsyllxzud3k6danjsn0dn70',
                                holder_type: 'wallet',
                                payment_key_hash: '02d1ceb2aeb3b5a48d7270f9290b729647890e58e367c07b923d3710',
                                drep: {
                                    cip_105: 'drep1qtguav4wkw66frtjwrujjzmjjercjrjcudnuq7uj85m3q3mau0l',
                                    cip_129: 'drep1ygpdrn4j46emtfydwfc0j2gtw2ty0zgwtr3k0srmjg7nwyqwqn702',
                                    cred: 'key',
                                    hex: '02d1ceb2aeb3b5a48d7270f9290b729647890e58e367c07b923d3710',
                                    type: 'drep'
                                }
                            },
                            old: {
                                resolved_addresses: { ada: '', btc: '2213kjsjkn', eth: 'sad2wsad' },
                                updated_slot_number: 99,
                                utxo: '',
                                image_hash: '0x123',
                                holder: '',
                                holder_type: 'other',
                                payment_key_hash: null
                            }
                        }
                    }
                ]
            ]);
        });

        // it('Should process drep handle update and match stake key', async () => {
        //     const name = 'pollo-verde';
        //     const walletAddress = 'addr_test1qpyc3jke4g0t6uemzetftnl0je0a5thy9k4jmpvycsas88yklyw6t0d3jt0zg9wnumgxftk9ft8wvjxzc6reltgllkss5nzat4';
        //     const holder = klc.getAddressHolderDetails('addr_test1qpyc3jke4g0t6uemzetftnl0je0a5thy9k4jmpvycsas88yklyw6t0d3jt0zg9wnumgxftk9ft8wvjxzc6reltgllkss5nzat4');
        //     const decodedAddress = klc.decodeAddress(holder.address);
        //     const drepAddress = 'addr_test1vrx8sta8ea4t8snzctu23j5s0r0rmgjclwdcr49xm6yq7ps72ms45';

        //     // Mint a Handle using one wallet
        //     await HandleStore.saveMintedHandle({
        //         hex: '000de140706F6C6C6F2D7665726465',
        //         name,
        //         adaAddress: walletAddress,
        //         og_number: 0,
        //         utxo: 'utxo123#0',
        //         policy: 'f0ff',
        //         lovelace: 0,
        //         image: 'ipfs://123',
        //         slotNumber: 100,
        //         image_hash: '0xtodo',
        //         svg_version: '1.0.0',
        //         handle_type: HandleType.HANDLE
        //     });

        //     // Send the Handle to the DRep address
        //     await HandleStore.saveHandleUpdate({
        //         name,
        //         adaAddress: drepAddress,
        //         lovelace: 1,
        //         policy: 'f0ff',
        //         slotNumber: 100,
        //         utxo: 'utxo123#0'
        //     })

        //     // set the datum hash for the DRep
        //     const personalizationDatum: IPzDatumConvertedUsingSchema = {
        //         default: false,
        //         pfp_image: 'todo',
        //         bg_image: 'todo',
        //         image_hash: '0x123',
        //         standard_image_hash: '0x123',
        //         svg_version: '1.0.0',
        //         standard_image: '',
        //         portal: '',
        //         designer: '',
        //         socials: '',
        //         vendor: '',
        //         last_update_address: '',
        //         validated_by: '',
        //         resolved_addresses: { ada: '0x123', btc: '2213kjsjkn', eth: 'sad2wsad' },
        //         trial: false,
        //         nsfw: false,
        //         agreed_terms: '',
        //         migrate_sig_required: false,
        //         pz_enabled: false,
        //         id_hash: '0xbac2332809930da3350bd4507b83c95622f533eae327fe6e00d99178c11bee89f1'
        //     };

        //     await HandleStore.savePersonalizationChange({
        //         hex: '000de140706F6C6C6F2D7665726465',
        //         name,
        //         slotNumber: 99,
        //         personalization: {
        //             validated_by: 'todo',
        //             trial: false,
        //             nsfw: false
        //         },
        //         reference_token: defaultReferenceToken,
        //         personalizationDatum,
        //         policy: 'f0ff',
        //         metadata: {
        //             name,
        //             image: 'ipfs://123',
        //             mediaType: 'image/jpeg',
        //             og_number: 0,
        //             rarity: 'todo',
        //             length: 10,
        //             characters: 'todo',
        //             numeric_modifiers: 'todo',
        //             version: 0,
        //             og: 0,
        //             handle_type: HandleType.HANDLE
        //         }
        //     });

        //     const handle = HandleStore.get(name);

        //     // expect the drep data to be set
        //     expect(handle?.drep).toEqual({
        //         type: 'drep',
        //         cred: 'key',
        //         hex: 'cc782fa7cf6ab3c262c2f8a8ca9078de3da258fb9b81d4a6de880f06',
        //         cip_105: 'drep1e3uzlf70d2euyckzlz5v4yrcmc76yk8mnwqaffk73q8svy5ed4m',
        //         cip_129: 'drep1ytx8sta8ea4t8snzctu23j5s0r0rmgjclwdcr49xm6yq7psdr0qyv'
        //     });

        //     // expect using the stake key to pull back the handle
        //     const repo = new MemoryHandlesRepository();
        //     const handles = repo.getHandlesByStakeKeyHashes([decodedAddress!]);
        //     expect(handles).toEqual([name]);
        // });

        it('Should process a demi handle which has the 100 token before the 222 token', async () => {
            const personalizationData: IPersonalization = {
                validated_by: '0x4da965a049dfd15ed1ee19fba6e2974a0b79fc416dd1796a1f97f5e1',
                trial: false,
                nsfw: false
            };

            await repo.save(await repo.Internal.buildHandle({
                hex: Buffer.from('chimichanga').toString('hex'),
                name: 'chimichanga',
                personalization: personalizationData,
                reference_token: {
                    tx_id: 'utxo123',
                    index: 0,
                    lovelace: 50,
                    datum: 'datum123',
                    address: ''
                },
                policy,
                image: 'ipfs://zb2rhoQxa62DEDBMcWcsPHTpCuoC8FykX584jCXzNBGZdCH7M',
                og_number: 0,
                rarity: klc.Rarity.basic,
                length: 12,
                characters: 'letters,numbers,special',
                numeric_modifiers: '',
                handle_type: HandleType.HANDLE,
                version: 1,
                updated_slot_number: 99,
                standard_image: 'ipfs://zb2rhoQxa62DEDBMcWcsPHTpCuoC8FykX584jCXzNBGZdCH7M',
                default: false,
                last_update_address: '0x004988cad9aa1ebd733b165695cfef965fda2ee42dab2d8584c43b039c96f91da5bdb192de2415d3e6d064aec54acee648c2c6879fad1ffda1',
                image_hash: '0xf92d124059974e63560343f173a01f8096ea5f65a25983fcb335af4d56cd1368',
                standard_image_hash: '0xf92d124059974e63560343f173a01f8096ea5f65a25983fcb335af4d56cd1368',
                svg_version: '3.0.14',
                pz_enabled: true,
                resolved_addresses: {ada: ''}
            }));

            let handle = repo.get('chimichanga');

            await repo.save(await repo.Internal.buildHandle({
                ...handle,
                hex: Buffer.from('chimichanga').toString('hex'),
                name: 'chimichanga',
                utxo: 'utxo123#1',
                lovelace: 100,
                handle_type: HandleType.HANDLE,
                og_number: 0,
                image: 'ipfs://zb2rhoQxa62DEDBMcWcsPHTpCuoC8FykX584jCXzNBGZdCH7M',
                version: 1,
                policy: '6c32db33a422e0bc2cb535bb850b5a6e9a9572222056d6ddc9cbc26e',
                resolved_addresses: {ada: 'addr_test1qqpdrn4j46emtfydwfc0j2gtw2ty0zgwtr3k0srmjg7nwy834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qept00g'},
                updated_slot_number: 100
            }));

            handle = repo.get('chimichanga');
            // expect the personalization data to be added to the handle
            expect(handle).toEqual({ 
                amount: 1, 
                characters: 'letters', 
                created_slot_number: 99, 
                default_in_wallet: 'taco',
                handle_type: 'handle', 
                has_datum: false, 
                hex: Buffer.from('chimichanga').toString('hex'), 
                holder: 'stake_test1urc63cmezfacz9vrqu867axmqrvgp4zsyllxzud3k6danjsn0dn70', 
                holder_type: 'wallet', 
                image: 'ipfs://zb2rhoQxa62DEDBMcWcsPHTpCuoC8FykX584jCXzNBGZdCH7M', 
                last_update_address: '0x004988cad9aa1ebd733b165695cfef965fda2ee42dab2d8584c43b039c96f91da5bdb192de2415d3e6d064aec54acee648c2c6879fad1ffda1', 
                length: 11, 
                lovelace: 100, 
                name: 'chimichanga', 
                numeric_modifiers: '', 
                og_number: 0, 
                payment_key_hash: '02d1ceb2aeb3b5a48d7270f9290b729647890e58e367c07b923d3710', 
                personalization: { nsfw: false, trial: false, validated_by: '0x4da965a049dfd15ed1ee19fba6e2974a0b79fc416dd1796a1f97f5e1' }, 
                policy: '6c32db33a422e0bc2cb535bb850b5a6e9a9572222056d6ddc9cbc26e', 
                pz_enabled: true, 
                rarity: 'basic', 
                resolved_addresses: { 
                    ada: 'addr_test1qqpdrn4j46emtfydwfc0j2gtw2ty0zgwtr3k0srmjg7nwy834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qept00g' 
                }, 
                reference_token: {
                    tx_id: 'utxo123',
                    index: 0,
                    lovelace: 50,
                    datum: 'datum123',
                    address: ''
                },
                standard_image: 'ipfs://zb2rhoQxa62DEDBMcWcsPHTpCuoC8FykX584jCXzNBGZdCH7M', 
                standard_image_hash: '0xf92d124059974e63560343f173a01f8096ea5f65a25983fcb335af4d56cd1368', 
                image_hash: '0xf92d124059974e63560343f173a01f8096ea5f65a25983fcb335af4d56cd1368', 
                svg_version: '3.0.14', 
                updated_slot_number: 100, 
                utxo: 'utxo123#1', 
                version: 1 
            });
        });

        it('Should save an NFT Sub Handle', async () => {
            const subHandleName = 'sub@hndl';
            await repo.save(await repo.Internal.buildHandle({
                hex: '000de14073756240686e646c',
                name: subHandleName,
                og_number: 0,
                utxo: 'utxo123#0',
                policy,
                lovelace: 0,
                image: 'ipfs://123',
                datum: 'datum123',
                image_hash: '0x123',
                svg_version: '1.0.0',
                handle_type: HandleType.NFT_SUBHANDLE,
                sub_rarity: 'rare',
                sub_length: 10,
                sub_characters: 'letters',
                sub_numeric_modifiers: 'numbers',
                resolved_addresses: {ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q'},
                updated_slot_number: 100
            }));

            const handle = repo.get(subHandleName);
            expect(handle?.name).toEqual(subHandleName);
            expect(handle?.handle_type).toEqual(HandleType.NFT_SUBHANDLE);

            // expect subHandle to get added to the subHandlesIndex
            const subHandles = repo.getSubHandlesByRootHandle('hndl').map(s => s.name);
            expect([...subHandles]).toEqual([subHandleName]);
        });

        it('Should save an Virtual Sub Handle', async () => {
            const handleName = 'virtual@hndl';
            const virtual = {
                expires_time: 200,
                public_mint: true
            };

            await repo.save(await repo.Internal.buildHandle({
                hex: '000000007669727475616c40686e646c',
                name: handleName,
                og_number: 0,
                utxo: 'utxo123#0',
                policy,
                lovelace: 0,
                image: 'ipfs://123',
                datum: 'datum123',
                image_hash: '0x123',
                svg_version: '1.0.0',
                handle_type: HandleType.VIRTUAL_SUBHANDLE,
                sub_rarity: 'rare',
                sub_length: 10,
                sub_characters: 'letters',
                sub_numeric_modifiers: 'numbers',
                virtual,
                original_address: '0x123',
                resolved_addresses: {ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q'},
                updated_slot_number: 100
            }));

            const handle = repo.get(handleName);
            expect(handle?.handle_type).toEqual(HandleType.VIRTUAL_SUBHANDLE);
            expect(handle?.virtual).toEqual(virtual);
            expect(handle?.original_address).toEqual('0x123');

            // expect subHandle to get added to the subHandlesIndex
            const subHandles = repo.getSubHandlesByRootHandle('hndl').map(s => s.name);
            expect([...subHandles]).toEqual([handleName]);
        });
    });

    describe('savePersonalizationChange tests', () => {
        it('Should update personalization data', async () => {
            let handle = repo.get('nacho-cheese');
            await repo.save(await repo.Internal.buildHandle({
                ...handle,
                hex: Buffer.from('nacho-cheese').toString('hex'),
                name: 'nacho-cheese',
                og_number: 0,
                utxo: 'utxo123#0',
                policy,
                lovelace: 0,
                image: 'ipfs://123',
                image_hash: '0x123',
                svg_version: '1.0.0',
                handle_type: HandleType.HANDLE,
                pz_enabled: false,
                resolved_addresses: {ada: 'addr_test1qqpdrn4j46emtfydwfc0j2gtw2ty0zgwtr3k0srmjg7nwy834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qept00g'},
                updated_slot_number: 100
            }), handle!);

            const personalizationUpdates: IPersonalization = {
                designer: {
                    font_shadow_color: '0xtodo',
                    text_ribbon_colors: ['0xtodo'],
                    pfp_border_color: '0xtodo',
                    bg_color: '0xtodo',
                    bg_border_color: '0xtodo',
                    qr_bg_color: '0xtodo',
                    socials: []
                },
                validated_by: 'todo',
                trial: false,
                nsfw: false
            };

            handle = repo.get('nacho-cheese');
            await repo.save(await repo.Internal.buildHandle({
                ...handle,
                hex: Buffer.from('nacho-cheese').toString('hex'),
                name: 'nacho-cheese',
                personalization: personalizationUpdates,
                reference_token: defaultReferenceToken,
                policy,
                image: 'ipfs://1234',
                og_number: 0,
                version: 0,
                handle_type: HandleType.HANDLE,
                pfp_image: 'todo',
                bg_image: 'todo',
                image_hash: '0x123',
                svg_version: '1.0.0',
                last_update_address: '0x444',
                resolved_addresses: { ada: 'addr_test1qqpdrn4j46emtfydwfc0j2gtw2ty0zgwtr3k0srmjg7nwy834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qept00g', btc: '2213kjsjkn', eth: 'sad2wsad' },
                pz_enabled: false,
                last_edited_time: 123,
                updated_slot_number: 200
            }), handle!);

            handle = repo.get('nacho-cheese');
            expect(handle?.default_in_wallet).toEqual('taco');
            expect(handle?.pfp_image).toEqual('todo');
            expect(handle?.bg_image).toEqual('todo');
            expect(handle?.resolved_addresses).toEqual({ ada: 'addr_test1qqpdrn4j46emtfydwfc0j2gtw2ty0zgwtr3k0srmjg7nwy834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qept00g', btc: '2213kjsjkn', eth: 'sad2wsad' });
            expect(handle?.personalization).toEqual({
                designer: {
                    bg_border_color: '0xtodo',
                    bg_color: '0xtodo',
                    font_shadow_color: '0xtodo',
                    pfp_border_color: '0xtodo',
                    qr_bg_color: '0xtodo',
                    socials: [],
                    text_ribbon_colors: ['0xtodo']
                },
                validated_by: 'todo',
                trial: false,
                nsfw: false
            });

            expect(Array.from(HandleStore.slotHistoryIndex)).toEqual([
                [expect.any(Number), { barbacoa: { new: { name: 'barbacoa' }, old: null } }],
                [expect.any(Number), { burrito: { new: { name: 'burrito' }, old: null } }],
                [expect.any(Number), { taco: { new: { name: 'taco' }, old: null } }],
                [100, { 'nacho-cheese': { new: { name: 'nacho-cheese' }, old: null } }],
                [
                    200,
                    {
                        'nacho-cheese': {
                            new: {
                                bg_image: 'todo',
                                personalization: {
                                    designer: {
                                        bg_border_color: '0xtodo',
                                        bg_color: '0xtodo',
                                        font_shadow_color: '0xtodo',
                                        pfp_border_color: '0xtodo',
                                        qr_bg_color: '0xtodo',
                                        socials: [],
                                        text_ribbon_colors: ['0xtodo']
                                    },
                                    validated_by: 'todo',
                                    trial: false,
                                    nsfw: false
                                },
                                reference_token: defaultReferenceToken,
                                last_update_address: '0x444',
                                pfp_image: 'todo',
                                resolved_addresses: {
                                    btc: '2213kjsjkn',
                                    eth: 'sad2wsad'
                                },
                                updated_slot_number: 200,
                                last_edited_time: 123,
                                image: 'ipfs://1234'
                            },
                            old: {
                                resolved_addresses: {
                                    ada: 'addr_test1qqpdrn4j46emtfydwfc0j2gtw2ty0zgwtr3k0srmjg7nwy834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qept00g'
                                },
                                updated_slot_number: 100,
                                image: 'ipfs://123'
                            }
                        }
                    }
                ]
            ]);
        });

        it('Should update personalization data before 222 data', async () => {
            const designerUpdates: IPersonalization = {
                designer: {
                    font_shadow_color: '0xtodo',
                    text_ribbon_colors: ['0xtodo'],
                    pfp_border_color: '0xtodo',
                    bg_color: '0xtodo',
                    bg_border_color: '0xtodo',
                    qr_bg_color: '0xtodo',
                    socials: []
                },
                validated_by: 'todo',
                trial: false,
                nsfw: false
            };

            await repo.save(await repo.Internal.buildHandle({
                hex: Buffer.from('sour-cream').toString('hex'),
                name: 'sour-cream',
                personalization: designerUpdates,
                reference_token: defaultReferenceToken,
                policy,
                image: 'ipfs://123',
                og_number: 0,
                length: 2,
                version: 0,
                handle_type: HandleType.HANDLE,
                updated_slot_number: 200,
                pfp_image: 'todo',
                bg_image: 'todo',
                image_hash: '0x123',
                standard_image_hash: '0x123',
                svg_version: '1.0.0',
                standard_image: 'ipfs://123',
                last_update_address: '',
                resolved_addresses: { ada: '0xaaaa', btc: '2213kjsjkn', eth: 'sad2wsad' }
            }));

            expect(HandleStore.handles.get('sour-cream')).toEqual({
                bg_image: 'todo',
                characters: 'letters,special',
                created_slot_number: 200,
                default_in_wallet: '',
                last_update_address: '',
                has_datum: false,
                hex: Buffer.from('sour-cream').toString('hex'),
                holder: '0xaaaa',
                length: 10,
                name: 'sour-cream',
                image: 'ipfs://123',
                image_hash: '0x123',
                numeric_modifiers: '',
                og_number: 0,
                standard_image: 'ipfs://123',
                svg_version: '1.0.0',
                standard_image_hash: '0x123',
                personalization: designerUpdates,
                reference_token: defaultReferenceToken,
                pfp_image: 'todo',
                rarity: 'basic',
                resolved_addresses: { ada: '0xaaaa', btc: '2213kjsjkn', eth: 'sad2wsad' },
                updated_slot_number: 200,
                utxo: '',
                lovelace: 0,
                amount: 1,
                holder_type: 'other',
                version: 0,
                handle_type: HandleType.HANDLE,
                payment_key_hash: null,
                drep: undefined,
                policy
            });
        });

        it('Should update personalization data and save the default handle', async () => {
            const handleName = 'tortilla-soup';
            const handleHex = Buffer.from(handleName).toString('hex');
            await repo.save(await repo.Internal.buildHandle({
                hex: handleHex,
                name: handleName,
                og_number: 0,
                utxo: 'utxo123#0',
                policy,
                lovelace: 0,
                image: '',
                image_hash: '0x123',
                svg_version: '1.0.0',
                handle_type: HandleType.HANDLE,
                resolved_addresses: {ada: 'addr_test1qqpdrn4j46emtfydwfc0j2gtw2ty0zgwtr3k0srmjg7nwy834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qept00g'},
                updated_slot_number: 100
            }));

            const personalizationUpdates: IPersonalization = {
                designer: {
                    font_shadow_color: '0x000',
                    text_ribbon_colors: ['0xCCC']
                },
                validated_by: 'todo',
                trial: false,
                nsfw: false
            };

            let handle = repo.get(handleName);
            await repo.save(await repo.Internal.buildHandle({
                ...handle,
                hex: handleHex,
                name: handleName,
                personalization: personalizationUpdates,
                reference_token: defaultReferenceToken,
                policy,
                image: 'ipfs://123',
                og_number: 0,
                length: 2,
                version: 0,
                handle_type: HandleType.HANDLE,
                pfp_image: 'todo',
                bg_image: 'todo',
                image_hash: '0x123',
                standard_image_hash: '0x123',
                svg_version: '1.0.0',
                standard_image: '',
                last_update_address: '',
                resolved_addresses: {ada: 'addr_test1qqpdrn4j46emtfydwfc0j2gtw2ty0zgwtr3k0srmjg7nwy834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qept00g'},
                updated_slot_number: 200,
                default: true
            }), handle!);

            handle = repo.get(handleName);

            // Expect the personalization data to be set
            // Expect the default_in_wallet to be set (this uses the getter in the repo.get)
            expect(handle?.default_in_wallet).toEqual(handleName);
            expect(handle?.personalization).toEqual(personalizationUpdates);

            // Expect the handles array to have the new handle with defaultHandle and manuallySet true
            const holderAddress = HandleStore.holderIndex.get('stake_test1urc63cmezfacz9vrqu867axmqrvgp4zsyllxzud3k6danjsn0dn70');
            expect(holderAddress).toEqual(
                expect.objectContaining({
                    defaultHandle: 'tortilla-soup',
                    knownOwnerName: '',
                    manuallySet: true,
                    type: 'wallet'
                })
            );

            expect([...(holderAddress?.handles ?? [])]).toEqual([
                {name:'barbacoa', og_number: expect.any(Number), created_slot_number: expect.any(Number)}, 
                {name:'burrito', og_number: expect.any(Number), created_slot_number: expect.any(Number)}, 
                {name:'taco', og_number: expect.any(Number), created_slot_number: expect.any(Number)}, 
                {name:'tortilla-soup', og_number: expect.any(Number), created_slot_number: expect.any(Number)}
            ]);
        });

        it('Should save default handle and history correctly when saving multiple times', async () => {
            const handleName = 'pork-belly';
            const handleHex = Buffer.from(handleName).toString('hex');
            let handle = repo.get(handleName);
            await repo.save(await repo.Internal.buildHandle({
                ...handle,
                hex: handleHex,
                name: handleName,
                og_number: 0,
                utxo: 'utxo123#0',
                policy,
                lovelace: 0,
                image: '',
                image_hash: '0x123',
                svg_version: '1.0.0',
                handle_type: HandleType.HANDLE,
                pz_enabled: false,
                resolved_addresses: {ada: 'addr_test1qqpdrn4j46emtfydwfc0j2gtw2ty0zgwtr3k0srmjg7nwy834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qept00g'},
                updated_slot_number: 100
            }), handle!);

            const personalizationUpdates: IPersonalization = {
                socials: [
                    {
                        display: '@twitter_sauce',
                        url: 'https://twitter.com/twitter_sauce'
                    }
                ],
                designer: {
                    font_shadow_color: '0x000',
                    text_ribbon_colors: ['0xCCC']
                },
                validated_by: 'todo',
                trial: false,
                nsfw: false
            };

            handle = repo.get(handleName);
            await repo.save(await repo.Internal.buildHandle({
                ...handle,
                hex: handleHex,
                name: handleName,
                personalization: personalizationUpdates,
                reference_token: defaultReferenceToken,
                policy,
                pfp_image: 'todo',
                bg_image: 'todo',
                image_hash: '0x123',
                standard_image_hash: '0x123',
                svg_version: '1.0.0',
                standard_image: '',
                last_update_address: '0x222',
                pz_enabled: false,
                image: 'ipfs://123',
                og_number: 0,
                version: 0,
                handle_type: HandleType.HANDLE,
                resolved_addresses: {ada: 'addr_test1qqpdrn4j46emtfydwfc0j2gtw2ty0zgwtr3k0srmjg7nwy834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qept00g'},
                updated_slot_number: 200,
                default: true
            }), handle!);

            handle = repo.get(handleName);
            expect(handle?.personalization).toEqual(personalizationUpdates);
            expect(handle?.default_in_wallet).toEqual(handleName);

            const newPersonalizationUpdates: IPersonalization = {
                designer: {
                    font_shadow_color: '0xEEE'
                },
                validated_by: 'todo',
                trial: false,
                nsfw: false
            };

            await repo.save(await repo.Internal.buildHandle({
                ...handle,
                hex: handleHex,
                name: handleName,
                personalization: newPersonalizationUpdates,
                reference_token: defaultReferenceToken,
                policy,
                image: 'ipfs://123',
                og_number: 0,
                version: 0,
                handle_type: HandleType.HANDLE,
                pfp_image: 'todo',
                bg_image: 'todo',
                image_hash: '0x123',
                standard_image_hash: '0x123',
                svg_version: '1.0.0',
                standard_image: '',
                last_update_address: '0x333',
                pz_enabled: false,
                resolved_addresses: {ada: 'addr_test1qqpdrn4j46emtfydwfc0j2gtw2ty0zgwtr3k0srmjg7nwy834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qept00g'},
                updated_slot_number: 300,
                default: true
            }), handle!);

            handle = repo.get(handleName);
            expect(handle?.personalization).toEqual(newPersonalizationUpdates);

            // Default in wallet should not change because it was not updated or removed.
            expect(handle?.default_in_wallet).toEqual(handleName);
            const personalizationUpdatesWithDefaultWalletChange: IPersonalization = {
                designer: {
                    font_shadow_color: '0x111'
                },
                validated_by: 'new',
                trial: false,
                nsfw: false
            };

            await repo.save(await repo.Internal.buildHandle({
                ...handle,
                hex: handleHex,
                name: handleName,
                personalization: personalizationUpdatesWithDefaultWalletChange,
                reference_token: defaultReferenceToken,
                policy,
                image: 'ipfs://123',
                og_number: 0,
                version: 0,
                handle_type: HandleType.HANDLE,
                pfp_image: 'todo',
                bg_image: 'todo',
                image_hash: '0x123',
                standard_image_hash: '0x123',
                svg_version: '1.0.0',
                standard_image: '',
                last_update_address: '0x444',
                pz_enabled: false,
                resolved_addresses: {ada: 'addr_test1qqpdrn4j46emtfydwfc0j2gtw2ty0zgwtr3k0srmjg7nwy834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qept00g'},
                updated_slot_number: 400
            }), handle!);

            handle = repo.get(handleName);
            expect(handle?.personalization).toEqual(personalizationUpdatesWithDefaultWalletChange);

            // Default should be changed because we removed it.
            expect(handle?.default_in_wallet).toEqual('taco');

            // expect the first to be old null, meaning it was minted
            expect(Array.from(HandleStore.slotHistoryIndex)[3]).toEqual([100, { 'pork-belly': { new: { name: 'pork-belly' }, old: null } }]);

            // expect the second to have the first pz updates.
            // personalization should be undefined because it was not set before
            expect(Array.from(HandleStore.slotHistoryIndex)[4]).toEqual([
                200,
                {
                    'pork-belly': {
                        new: {
                            bg_image: 'todo',
                            pfp_image: 'todo',
                            default: true,
                            image: 'ipfs://123',
                            personalization: {
                                designer: {
                                    font_shadow_color: '0x000',
                                    text_ribbon_colors: ['0xCCC']
                                },
                                socials: [{ display: '@twitter_sauce', url: 'https://twitter.com/twitter_sauce' }],
                                validated_by: 'todo',
                                trial: false,
                                nsfw: false
                            },
                            last_update_address: '0x222',
                            reference_token: defaultReferenceToken,
                            updated_slot_number: 200
                        },
                        old: {
                            image: '',
                            personalization: undefined,
                            reference_token: undefined,
                            updated_slot_number: 100
                        }
                    }
                }
            ]);

            // expect the third to have the second pz updates which didn't include social links
            expect(Array.from(HandleStore.slotHistoryIndex)[5]).toEqual([
                300,
                {
                    'pork-belly': {
                        new: {
                            personalization: {
                                designer: { font_shadow_color: '0xEEE', text_ribbon_colors: undefined },
                                socials: undefined
                            },
                            last_update_address: '0x333',
                            updated_slot_number: 300
                        },
                        old: {
                            personalization: {
                                designer: {
                                    font_shadow_color: '0x000',
                                    text_ribbon_colors: ['0xCCC']
                                },
                                socials: [{ display: '@twitter_sauce', url: 'https://twitter.com/twitter_sauce' }],
                                validated_by: 'todo',
                                trial: false,
                                nsfw: false
                            },
                            last_update_address: '0x222',
                            updated_slot_number: 200
                        }
                    }
                }
            ]);

            // expect the fourth to have the last pz updates default handle should have been removed
            expect(Array.from(HandleStore.slotHistoryIndex)[6]).toEqual([
                400,
                {
                    'pork-belly': {
                        new: {
                            personalization: { designer: { font_shadow_color: '0x111' }, validated_by: 'new' },
                            last_update_address: '0x444',
                            updated_slot_number: 400
                        },
                        old: {
                            default: true,
                            personalization: {
                                designer: {
                                    font_shadow_color: '0xEEE'
                                },
                                validated_by: 'todo',
                                nsfw: false,
                                trial: false
                            },
                            last_update_address: '0x333',
                            updated_slot_number: 300
                        }
                    }
                }
            ]);
        });

        it('should save default handle properly', async () => {
            const tacoPzUpdate: IPersonalization = {
                designer: {
                    font_shadow_color: '0xaaa'
                },
                validated_by: 'todo',
                trial: false,
                nsfw: false
            };

            let handle = repo.get('taco');

            await repo.save(await repo.Internal.buildHandle({
                ...handle,
                hex: Buffer.from('taco').toString('hex'),
                name: 'taco',
                personalization: tacoPzUpdate,
                reference_token: defaultReferenceToken,
                policy,
                image: 'ipfs://123',
                og_number: 0,
                version: 0,
                handle_type: HandleType.HANDLE,
                pfp_image: 'todo',
                bg_image: 'todo',
                image_hash: '0x123',
                standard_image_hash: '0x123',
                svg_version: '1.0.0',
                standard_image: '',
                last_update_address: '',
                resolved_addresses: {ada: 'addr_test1qqpdrn4j46emtfydwfc0j2gtw2ty0zgwtr3k0srmjg7nwy834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qept00g'},
                updated_slot_number: 100
            }), handle!);

            handle = repo.get('taco');
            expect(handle?.default_in_wallet).toEqual('taco');
            
            handle = repo.get('burrito');
            const burritoPzUpdate: IPersonalization = {
                designer: {
                    font_shadow_color: '0xaaa'
                },
                validated_by: 'todo',
                trial: false,
                nsfw: false
            };
            await repo.save(await repo.Internal.buildHandle({
                ...handle,
                hex: Buffer.from('burrito').toString('hex'),
                name: 'burrito',
                personalization: burritoPzUpdate,
                reference_token: defaultReferenceToken,
                policy,
                image: 'ipfs://123',
                og_number: 0,
                version: 0,
                handle_type: HandleType.HANDLE,
                pfp_image: 'todo',
                bg_image: 'todo',
                image_hash: '0x123',
                standard_image_hash: '0x123',
                svg_version: '1.0.0',
                standard_image: '',
                last_update_address: '',
                resolved_addresses: {ada: 'addr_test1qqpdrn4j46emtfydwfc0j2gtw2ty0zgwtr3k0srmjg7nwy834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qept00g'},
                updated_slot_number: 200
            }), handle!);

            handle = repo.get('burrito');
            expect(handle?.default_in_wallet).toEqual('taco');
            
            handle = repo.get('barbacoa');
            const barbacoaPzUpdate: IPersonalization = {
                designer: {
                    font_shadow_color: '0xaaa'
                },
                validated_by: 'todo',
                trial: false,
                nsfw: false
            };

            await repo.save(await repo.Internal.buildHandle({
                ...handle,
                hex: Buffer.from('barbacoa').toString('hex'),
                name: 'barbacoa',
                personalization: barbacoaPzUpdate,
                reference_token: defaultReferenceToken,
                policy,
                image: 'ipfs://123',
                og_number: 0,
                version: 0,
                handle_type: HandleType.HANDLE,
                pfp_image: 'todo',
                bg_image: 'todo',
                image_hash: '0x123',
                standard_image_hash: '0x123',
                svg_version: '1.0.0',
                standard_image: '',
                last_update_address: '',
                resolved_addresses: {ada: 'addr_test1qqpdrn4j46emtfydwfc0j2gtw2ty0zgwtr3k0srmjg7nwy834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qept00g'},
                updated_slot_number: 300,
                default: true
            }), handle!);

            handle = repo.get('barbacoa');
            expect(handle?.default_in_wallet).toEqual('barbacoa');
            
            handle = repo.get('taco');
            const tacoPzUpdate2: IPersonalization = {
                designer: {
                    font_shadow_color: '0xaaa'
                },
                validated_by: 'todo',
                trial: false,
                nsfw: false
            };

            await repo.save(await repo.Internal.buildHandle({
                ...handle,
                hex: Buffer.from('taco').toString('hex'),
                name: 'taco',
                personalization: tacoPzUpdate2,
                reference_token: defaultReferenceToken,
                policy,
                image: 'ipfs://123',
                og_number: 0,
                version: 0,
                handle_type: HandleType.HANDLE,
                pfp_image: 'todo',
                bg_image: 'todo',
                image_hash: '0x123',
                standard_image_hash: '0x123',
                svg_version: '1.0.0',
                standard_image: '',
                last_update_address: '',
                resolved_addresses: {ada: 'addr_test1qqpdrn4j46emtfydwfc0j2gtw2ty0zgwtr3k0srmjg7nwy834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qept00g'},
                updated_slot_number: 400
            }), handle!);

            const tacoHandle2 = repo.get('taco');
            expect(tacoHandle2?.default_in_wallet).toEqual('barbacoa');
        });

        it('should save details for nft handle', async () => {
            const handleName = 'nft@hndl';
            const handleHex = Buffer.from(handleName).toString('hex');
            await repo.save(await repo.Internal.buildHandle({
                hex: handleHex,
                name: handleName,
                og_number: 0,
                utxo: 'utxo123#0',
                policy,
                lovelace: 0,
                image: '',
                image_hash: '0x123',
                svg_version: '1.0.0',
                handle_type: HandleType.NFT_SUBHANDLE,
                sub_rarity: 'rare',
                sub_length: 10,
                sub_characters: 'letters',
                sub_numeric_modifiers: 'numbers',
                resolved_addresses: {ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q'},
                updated_slot_number: 100
            }));

            const personalizationUpdates: IPersonalization = {
                designer: {
                    font_shadow_color: '0x000000'
                },
                validated_by: 'todo',
                trial: false,
                nsfw: false
            };

            await repo.save(await repo.Internal.buildHandle({
                hex: handleHex,
                name: handleName,
                personalization: personalizationUpdates,
                reference_token: defaultReferenceToken,
                policy,
                image: 'ipfs://123',
                og_number: 0,
                version: 0,
                handle_type: HandleType.NFT_SUBHANDLE,
                pfp_image: 'todo',
                bg_image: 'todo',
                image_hash: '0x123',
                standard_image_hash: '0x123',
                svg_version: '1.0.0',
                standard_image: '',
                last_update_address: '',
                resolved_addresses: {ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q'},
                updated_slot_number: 300
            }));

            const nftSubHandle = repo.get(handleName);
            expect(nftSubHandle?.personalization).toEqual(personalizationUpdates);
            expect(nftSubHandle?.handle_type).toEqual(HandleType.NFT_SUBHANDLE);
        });

        it('should save details for virtual handle', async () => {
            const handleName = 'virtual@hndl';
            const handleHex = '000000007669727475616c40686e646c';

            const personalizationUpdates: IPersonalization = {
                designer: {
                    font_shadow_color: '0x000000'
                },
                validated_by: 'todo',
                trial: false,
                nsfw: false
            };

            const metadata: IHandleMetadata = {
                name: handleHex,
                image: 'ipfs://123',
                mediaType: 'image/jpeg',
                og: 0,
                og_number: 0,
                rarity: 'todo',
                length: 2,
                characters: 'todo',
                numeric_modifiers: 'todo',
                version: 0,
                handle_type: HandleType.VIRTUAL_SUBHANDLE,
                sub_rarity: 'rare',
                sub_length: 10,
                sub_characters: 'letters',
                sub_numeric_modifiers: 'numbers'
            };

            await repo.save(await repo.Internal.buildHandle({
                hex: handleHex,
                name: handleName,
                policy,
                personalization: personalizationUpdates,
                reference_token: defaultReferenceToken,
                image: 'ipfs://123',
                og_number: 0,
                version: 0,
                handle_type: HandleType.VIRTUAL_SUBHANDLE,
                pfp_image: 'todo',
                bg_image: 'todo',
                image_hash: '0x123',
                standard_image_hash: '0x123',
                svg_version: '1.0.0',
                standard_image: '',
                last_update_address: '',
                virtual: {
                    expires_time: 1,
                    public_mint: false
                },
                resolved_addresses: {ada: 'addr_test1qq9hgdhkephnvfvq7vfulmmez6kzhpmffqm5r3zj7sgtfe240h0h7dr4r98k6swwj3yjxz35f42spnhesexnvahmzs9qzkg9d7'},
                updated_slot_number: 300,
                utxo: `${defaultReferenceToken.tx_id}#${defaultReferenceToken.index}`
            }));

            const virtualSubHandle = repo.get(handleName);
            expect(virtualSubHandle?.personalization).toEqual(personalizationUpdates);

            await repo.save(await repo.Internal.buildHandle({
                ...virtualSubHandle,
                updated_slot_number: 400,
                virtual: {
                    expires_time: 2,
                    public_mint: false
                }
            }, metadata));

            const updatedVirtualSubHandle = repo.get(handleName);
            expect(updatedVirtualSubHandle?.virtual).toEqual({ expires_time: 2, public_mint: false });
        });
    });

    describe('saveSubHandleSettingsChange tests', () => {
        it('Should update SubHandle settings', async () => {
            await repo.save(await repo.Internal.buildHandle({
                hex: Buffer.from('shrimp-taco').toString('hex'),
                name: 'shrimp-taco',
                og_number: 0,
                utxo: 'utxo123#0',
                policy,
                lovelace: 0,
                image: 'ipfs://123',
                image_hash: '0x123',
                svg_version: '1.0.0',
                handle_type: HandleType.HANDLE,
                resolved_addresses: {ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q'},
                updated_slot_number: 100
            }));

            const settings = 'a2436e6674a347656e61626c6564014b7469657250726963696e679f9f011903e8ff9f021901f4ff9f0318faff9f040affff48656e61626c65507a00477669727475616ca447656e61626c6564014b7469657250726963696e679f9f010fffff48656e61626c65507a004f657870697265735f696e5f64617973190168';
            const utxoDetails = { address: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q', datum: settings, index: 0, lovelace: 1, tx_id: 'some_id' };

            let handle = repo.get('shrimp-taco')
            await repo.save(await repo.Internal.buildHandle({
                ...handle,
                hex: Buffer.from('shrimp-taco').toString('hex'),
                name: 'shrimp-taco',
                policy,
                subhandle_settings: {
                    payment_address: 'abc',
                    utxo: utxoDetails
                },
                updated_slot_number: 200
            }), handle!);

            handle = repo.get('shrimp-taco');
            expect(handle?.subhandle_settings).toEqual({
                utxo: utxoDetails,
                payment_address: 'abc'
            });

            expect(Array.from(HandleStore.slotHistoryIndex)).toEqual([
                [expect.any(Number), { barbacoa: { new: { name: 'barbacoa' }, old: null } }],
                [expect.any(Number), { burrito: { new: { name: 'burrito' }, old: null } }],
                [expect.any(Number), { taco: { new: { name: 'taco' }, old: null } }],
                [100, { 'shrimp-taco': { new: { name: 'shrimp-taco' }, old: null } }],
                [
                    200,
                    {
                        'shrimp-taco': {
                            new: {
                                subhandle_settings: {
                                    payment_address: 'abc',
                                    utxo: utxoDetails
                                },
                                updated_slot_number: 200
                            },
                            old: {
                                updated_slot_number: 100
                            }
                        }
                    }
                ]
            ]);
        });

        it('Should update settings and history correctly when saving multiple times', async () => {
            const handleName = 'halibut-taco';
            const handleHex = Buffer.from(handleName).toString('hex');
            await repo.save(await repo.Internal.buildHandle({
                hex: handleHex,
                name: handleName,
                og_number: 0,
                utxo: 'utxo123#0',
                policy,
                lovelace: 0,
                image: '',
                image_hash: '0x123',
                svg_version: '1.0.0',
                handle_type: HandleType.HANDLE,
                resolved_addresses: {ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q'},
                updated_slot_number: 100
            }));

            const utxoDetails = { address: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q', datum: 'a2436e6674a347656e61626c6564014b7469657250726963696e679f9f011903e8ff9f021901f4ff9f0318faff9f040affff48656e61626c65507a00477669727475616ca447656e61626c6564014b7469657250726963696e679f9f010fffff48656e61626c65507a004f657870697265735f696e5f64617973190168', index: 0, lovelace: 1, tx_id: 'some_id' };
            const payment_address = 'abc';

            let handle = repo.get(handleName);
            // First settings change
            await repo.save(await repo.Internal.buildHandle({
                ...handle,
                name: handleName,
                hex: handleHex,
                policy,
                subhandle_settings: {
                    payment_address,
                    utxo: utxoDetails
                },
                updated_slot_number: 200
            }), handle!);

            handle = repo.get(handleName);
            expect(handle?.subhandle_settings).toEqual({
                utxo: { address: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q', datum: 'a2436e6674a347656e61626c6564014b7469657250726963696e679f9f011903e8ff9f021901f4ff9f0318faff9f040affff48656e61626c65507a00477669727475616ca447656e61626c6564014b7469657250726963696e679f9f010fffff48656e61626c65507a004f657870697265735f696e5f64617973190168', index: 0, lovelace: 1, tx_id: 'some_id' },
                payment_address
            });


            await repo.save(await repo.Internal.buildHandle({
                ...handle,
                name: handleName,
                subhandle_settings: {
                    payment_address: 'def',
                    utxo: utxoDetails
                },
                updated_slot_number: 300
            }), handle!);

            handle = repo.get(handleName);
            await repo.save(await repo.Internal.buildHandle({
                ...handle,
                name: handleName,
                subhandle_settings: {
                    payment_address: 'ghi',
                    utxo: utxoDetails
                },
                updated_slot_number: 400
            }), handle!);

            // expect the first to be old null, meaning it was minted
            expect(Array.from(HandleStore.slotHistoryIndex)[3]).toEqual([100, { [handleName]: { new: { name: handleName }, old: null } }]);

            // expect the second to have the first pz updates.
            expect(Array.from(HandleStore.slotHistoryIndex)[4]).toEqual([
                200,
                {
                    [handleName]: {
                        new: {
                            subhandle_settings: {
                                payment_address,
                                utxo: utxoDetails
                            },
                            updated_slot_number: 200
                        },
                        old: {
                            updated_slot_number: 100
                        }
                    }
                }
            ]);

            // expect the third to have the second pz updates which didn't include social links
            expect(Array.from(HandleStore.slotHistoryIndex)[5]).toEqual([
                300,
                {
                    [handleName]: {
                        new: {
                            subhandle_settings: {
                                payment_address: 'def'
                            },
                            updated_slot_number: 300
                        },
                        old: {
                            subhandle_settings: {
                                payment_address,
                                utxo: utxoDetails
                            },
                            updated_slot_number: 200
                        }
                    }
                }
            ]);

            // expect the third to have the second pz updates which didn't include social links
            expect(Array.from(HandleStore.slotHistoryIndex)[6]).toEqual([
                400,
                {
                    [handleName]: {
                        new: {
                            subhandle_settings: {
                                payment_address: 'ghi'
                            },
                            updated_slot_number: 400
                        },
                        old: {
                            subhandle_settings: {
                                utxo: utxoDetails,
                                payment_address: 'def'
                            },
                            updated_slot_number: 300
                        }
                    }
                }
            ]);
        });
    });

    describe('saveHandleUpdate tests', () => {
        it('Should update a handle and the slot history', async () => {
            const handleHex = Buffer.from('salsa').toString('hex');
            const handleName = 'salsa';
            const stakeKey = 'stake_test1urc63cmezfacz9vrqu867axmqrvgp4zsyllxzud3k6danjsn0dn70';
            const updatedStakeKey = 'stake_test1urcr464g6xz4hn2ypnd4tulcnnjq38sg5e5rmdwa6tspwuqn7lhlg';
            const address = 'addr_test1qqpdrn4j46emtfydwfc0j2gtw2ty0zgwtr3k0srmjg7nwy834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qept00g';
            const newAddress = 'addr_test1qz8zyhdetz270qzfvkym38wx4wsqzx0m49urfu3wjkqsuchs8t4235v9t0x5grxm2hel388ypz0q3fng8k6am5hqzacq0fc746';

            await repo.save(await repo.Internal.buildHandle({
                hex: handleHex,
                name: handleName,
                og_number: 0,
                utxo: 'utxo_salsa1#0',
                policy,
                lovelace: 0,
                image: 'ipfs://123',
                datum: 'a2datum_salsa',
                image_hash: '0x123',
                svg_version: '1.0.0',
                handle_type: HandleType.HANDLE,
                resolved_addresses: {ada: address},
                updated_slot_number: 100
            }));

            const existingHandle = repo.get(handleName);
            expect(existingHandle?.resolved_addresses.ada).toEqual(address);
            expect(existingHandle?.holder).toEqual(stakeKey);

            const holderAddress = HandleStore.holderIndex.get(stakeKey);
            expect(holderAddress?.handles?.some(h => h.name == handleName)).toBeTruthy();

            await repo.save(await repo.Internal.buildHandle({
                ...existingHandle,
                lovelace: 10,
                hex: handleHex,
                name: handleName,
                utxo: 'utxo_salsa2#0',
                policy,
                resolved_addresses: {ada: newAddress},
                updated_slot_number: 200,
                datum: undefined
            }), existingHandle!);

            const handle = repo.get(handleName);
            expect(handle).toEqual({
                amount: 1,
                holder: updatedStakeKey,
                characters: 'letters',
                hex: handleHex,
                utxo: 'utxo_salsa2#0',
                policy,
                lovelace: 10,
                length: 5,
                name: 'salsa',
                image: 'ipfs://123',
                image_hash: '0x123',
                standard_image_hash: '0x123',
                svg_version: '1.0.0',
                numeric_modifiers: '',
                og_number: 0,
                standard_image: 'ipfs://123',
                rarity: 'common',
                resolved_addresses: { ada: newAddress },
                created_slot_number: expect.any(Number),
                updated_slot_number: expect.any(Number),
                has_datum: false,
                holder_type: 'wallet',
                version: 0,
                handle_type: HandleType.HANDLE,
                default_in_wallet: 'salsa',
                payment_key_hash: '8e225db95895e780496589b89dc6aba00119fba97834f22e95810e62'
            });

            const newHolderAddress = HandleStore.holderIndex.get(updatedStakeKey);
            expect([...(newHolderAddress?.handles ?? [])]).toEqual([{
                "created_slot_number": 100,
                "name": "salsa",
                "og_number": 0,
            }]);

            // expect the handle to be removed from the old holder
            const updatedHolderAddress = HandleStore.holderIndex.get(stakeKey);
            expect(updatedHolderAddress?.handles?.some(h => h.name == handleName)).toBeFalsy();

            // expect to get the correct slot history with all new handles
            expect(Array.from(HandleStore.slotHistoryIndex)).toEqual([
                [expect.any(Number), { barbacoa: { new: { name: 'barbacoa' }, old: null } }],
                [expect.any(Number), { burrito: { new: { name: 'burrito' }, old: null } }],
                [expect.any(Number), { taco: { new: { name: 'taco' }, old: null } }],
                [100, { [handleName]: { new: { name: 'salsa' }, old: null } }],
                [
                    200,
                    {
                        [handleName]: {
                            new: {
                                lovelace: 10,
                                holder: 'stake_test1urcr464g6xz4hn2ypnd4tulcnnjq38sg5e5rmdwa6tspwuqn7lhlg',
                                resolved_addresses: {
                                    ada: 'addr_test1qz8zyhdetz270qzfvkym38wx4wsqzx0m49urfu3wjkqsuchs8t4235v9t0x5grxm2hel388ypz0q3fng8k6am5hqzacq0fc746'
                                },
                                has_datum: false,
                                datum: undefined,
                                updated_slot_number: 200,
                                utxo: 'utxo_salsa2#0',
                                payment_key_hash: '8e225db95895e780496589b89dc6aba00119fba97834f22e95810e62'
                            },
                            old: {
                                lovelace: 0,
                                holder: stakeKey,
                                resolved_addresses: { ada: address },
                                datum: 'a2datum_salsa',
                                updated_slot_number: 100,
                                utxo: 'utxo_salsa1#0',
                                has_datum: true,
                                payment_key_hash: '02d1ceb2aeb3b5a48d7270f9290b729647890e58e367c07b923d3710'
                            }
                        }
                    }
                ]
            ]);
        });

        it('Should log an error if handle is not found', async () => {
            // This is needed since jest will fail the test if console.error is called
            const original = console.error
            console.error = jest.fn()

            const loggerSpy = jest.spyOn(Logger, 'log');

            const address = 'addr123_new';
            await repo.processScannedHandleInfo({
                address,
                assetName: `${klc.AssetNameLabel.LBL_222}${Buffer.from('not-a-handle').toString('hex')}`,
                isMintTx: false,
                lovelace: 0,
                slotNumber: 0,
                utxo: 'utxo',
                policy
            });
            expect(loggerSpy).toHaveBeenCalledWith({
                category: 'NOTIFY',
                event: 'saveHandleUpdate.noHandleFound',
                message: 'Handle was updated but there is no existing handle in storage with name: not-a-handle'
            });
            console.error = original;
        });
    });

    describe('burnHandle tests', () => {
        it('Should burn a handle, update history and update the default handle', async () => {
            const handleName = 'taco';
            let handle = repo.get(handleName);
            await repo.removeHandle(handle!, 200);

            // After burn, expect not to find the handle
            handle = repo.get(handleName);
            expect(handle).toEqual(null);

            // Once a handle is burned, expect it to be removed from the holderIndex and a NEW defaultHandle set
            expect(HandleStore.holderIndex.get('stake_test1urc63cmezfacz9vrqu867axmqrvgp4zsyllxzud3k6danjsn0dn70')).toEqual({
                defaultHandle: 'burrito',
                handles: [{name: 'barbacoa', og_number: 0, created_slot_number: expect.any(Number)}, {name: 'burrito', og_number: 0, created_slot_number: expect.any(Number)}],
                knownOwnerName: '',
                manuallySet: false,
                type: 'wallet'
            });

            // expect history to include the burn details. new is null, old is the entire handle.
            expect(Array.from(HandleStore.slotHistoryIndex)).toEqual([
                [expect.any(Number), { barbacoa: { new: { name: 'barbacoa' }, old: null } }],
                [expect.any(Number), { burrito: { new: { name: 'burrito' }, old: null } }],
                [expect.any(Number), { taco: { new: { name: 'taco' }, old: null } }],
                [
                    200,
                    {
                        [handleName]: {
                            new: null,
                            old: {
                                ...handlesFixture[2],
                                datum: 'some_datum_2',
                                has_datum: true,
                                holder: 'stake_test1urc63cmezfacz9vrqu867axmqrvgp4zsyllxzud3k6danjsn0dn70'
                            }
                        }
                    }
                ]
            ]);
        });
    });
});
