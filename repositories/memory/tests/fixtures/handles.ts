import { HandleSearchModel, HandleType, Holder, ISlotHistory, Rarity, StoredHandle } from '@koralabs/kora-labs-common';
import { bech32 } from 'bech32';
import { MemoryHandlesProvider } from '../..';
import { HandlesRepository } from '../../../handlesRepository';

export const handlesFixture: StoredHandle[] = [
    {
        hex: 'barbacoa-hex',
        name: 'barbacoa',
        holder: 'stake_test1urc63cmezfacz9vrqu867axmqrvgp4zsyllxzud3k6danjsn0dn70',
        image: '',
        standard_image: '',
        length: 8,
        og_number: 0,
        utxo: 'utxo1#0',
        lovelace: 0,
        rarity: Rarity.basic,
        characters: 'letters',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q'
        },
        default_in_wallet: 'taco',
        pfp_image: '',
        bg_image: '',
        created_slot_number: Date.now(),
        updated_slot_number: Date.now(),
        has_datum: false,
        amount: 1,
        image_hash: '',
        last_update_address: '',
        standard_image_hash: '',
        svg_version: '1.0.0',
        holder_type: 'wallet',
        version: 0,
        handle_type: HandleType.HANDLE,
        payment_key_hash: '9a2bb4492f1a7b2a1c10c8cc37fe3fe2b4e613704ba5331cb94b6388'
    },
    {
        hex: 'burrito-hex',
        name: 'burrito',
        holder: 'stake_test1urc63cmezfacz9vrqu867axmqrvgp4zsyllxzud3k6danjsn0dn70',
        image: '',
        standard_image: '',
        length: 7,
        og_number: 0,
        utxo: 'utxo2#0',
        lovelace: 0,
        rarity: Rarity.common,
        characters: 'letters',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q'
        },
        default_in_wallet: 'taco',
        pfp_image: '',
        bg_image: '',
        created_slot_number: Date.now() + 10,
        updated_slot_number: Date.now() + 10,
        has_datum: false,
        amount: 1,
        image_hash: '',
        last_update_address: '',
        standard_image_hash: '',
        svg_version: '1.0.0',
        holder_type: 'wallet',
        version: 0,
        handle_type: HandleType.HANDLE,
        payment_key_hash: '9a2bb4492f1a7b2a1c10c8cc37fe3fe2b4e613704ba5331cb94b6388'
    },
    {
        hex: 'taco-hex',
        name: 'taco',
        holder: 'stake_test1urc63cmezfacz9vrqu867axmqrvgp4zsyllxzud3k6danjsn0dn70',
        image: '',
        standard_image: '',
        length: 4,
        og_number: 0,
        utxo: 'utxo3#0',
        lovelace: 0,
        rarity: Rarity.common,
        characters: 'letters',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q'
        },
        default_in_wallet: 'taco',
        pfp_image: '',
        bg_image: '',
        created_slot_number: Date.now() + 20,
        updated_slot_number: Date.now() + 20,
        has_datum: false,
        amount: 1,
        image_hash: '',
        last_update_address: '',
        standard_image_hash: '',
        svg_version: '1.0.0',
        holder_type: 'wallet',
        version: 0,
        handle_type: HandleType.HANDLE,
        payment_key_hash: '9a2bb4492f1a7b2a1c10c8cc37fe3fe2b4e613704ba5331cb94b6388'
    }
];

export const slotHistoryFixture: Record<number, ISlotHistory> = {
    0: {},
    1: {
        barbacoa: {
            old: null
        },
        burrito: {
            old: null
        },
        taco: {
            old: null
        }
    },
    2: {
        barbacoa: {
            old: { resolved_addresses: { ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q' } }
        }
    },
    3: {
        burrito: {
            old: { resolved_addresses: { ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q' } }
        }
    },
    4: {
        barbacoa: {
            old: { resolved_addresses: { ada: 'addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q' } }
        }
    }
};

export const holdersFixture = new Map<string, Holder>([
    [
        'addr1',
        {
            handles: new Set(['']),
            defaultHandle: 'burritos',
            manuallySet: false,
            type: 'script',
            knownOwnerName: 'funnable.token',
            address: ''
        }
    ],
    [
        'addr2',
        {
            handles: new Set(['7461636F73', '66616A69746173']),
            defaultHandle: 'tacos',
            manuallySet: false,
            type: 'wallet',
            knownOwnerName: '',
            address: ''
        }
    ]
]);

export const createRandomHandles = async (count: number, saveToHandleStore = false): Promise<StoredHandle[]> => {
    const repo = new HandlesRepository(new MemoryHandlesProvider());
    const handles: StoredHandle[] = [];
    for (let i = 0; i < count; i++) {
        const handleName = createRandomHandleName();
        if (!repo.get(handleName)) {
            const handle = await repo.Internal.buildHandle({
                adaAddress: createRandomAddress(),
                name: handleName,
                hex: Buffer.from(handleName).toString('hex'),
                image: `ipfs://${Buffer.from(handleName).toString('hex')}`,
                og_number: Math.floor(Math.random() * 2438),
                slotNumber: i,
                handle_type: HandleType.HANDLE,
                utxo: createRandomUtxo(),
                lovelace: 0
            });
            if (saveToHandleStore) {
                await repo.save({ handle });
            }
            handles.push(handle);
        }
    }
    return handles;
};

export const createRandomUtxo = (): string => {
    let result = '';
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let counter = 0;
    while (counter < 32) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
        counter += 1;
    }
    return `${result}#${Math.floor(Math.random() * 10)}`;
};

export const createRandomAddress = (): string => {
    return bech32.encode('addr_test', [0, 4, Math.floor(Math.random() * 32), 12, 18, 20, 22, 11, 25, 9, 29, 24, 30, 27, 11, 16, 13, 3, 8, 30, 9, 31, 25, 9, 30, 4, 0, 23, 31, 3, 14, 7, 13, 26, 15, 25, 7, 26, 24, 30, 7, 9, 24, 11, 12, 30, 14, 2, 10, 7, 13, 0, 10, 1, 30, 10, 25, 31, 20, 1, 8, 27, 14, 11, 15, 25, 9, 8, 24, 26, 10, 26, 6, 22, 1, 4, 23, 16, 14, 16, 0, 22, 4, 0, 22, 8, 26, 10, 10, 1, Math.floor(Math.random() * 32), 16], 108);
};

export const createRandomHandleName = (): string => {
    let result = '';
    const characters = 'abcdefghijklmnopqrstuvwxyz0123456789_.-';
    let counter = 0;
    while (counter < Math.ceil(Math.random() * 15)) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
        counter += 1;
    }
    return result;
};

export const performRandomHandleUpdates = async (count: number, beginningSlot = 0) => {
    const repo = new HandlesRepository(new MemoryHandlesProvider());
    for (let i = 0; i < count; i++) {
        switch (i % 3) {
            case 0: { // add
                const handleName = createRandomHandleName();
                if (!repo.get(handleName)) {
                    const newHandle = await repo.Internal.buildHandle({
                        adaAddress: createRandomAddress(),
                        name: handleName,
                        hex: Buffer.from(handleName).toString('hex'),
                        image: `ipfs://${Buffer.from(handleName).toString('hex')}`,
                        og_number: Math.floor(Math.random() * 2438),
                        slotNumber: beginningSlot + i,
                        handle_type: HandleType.HANDLE,
                        utxo: createRandomUtxo(),
                        lovelace: 0
                    });
                    await repo.save({ handle: newHandle });
                }
                break;
            }
            case 1: { // update
                const handleNames = repo.getAllHandleNames({} as HandleSearchModel);
                const oldHandle = repo.get(handleNames[Math.floor(Math.random() * handleNames.length)]) ?? undefined;
                const handle = {
                    ...oldHandle,
                    utxo: createRandomUtxo(),
                    resolved_addresses: { ada: createRandomAddress() },
                    updated_slot_number: beginningSlot + i
                } as StoredHandle;
                await repo.save({ handle, oldHandle });
                break;
            }
            case 2: { // remove
                const handleNames = repo.getAllHandleNames({} as HandleSearchModel);
                await repo.removeHandle(handleNames[Math.floor(Math.random() * handleNames.length)], beginningSlot + i);
                break;
            }
        }
    }
};
