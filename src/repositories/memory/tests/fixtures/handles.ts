import { ApiHandle, HandleType, Rarity } from '@koralabs/kora-labs-common';
import { ISlotHistoryIndex, HolderAddressIndex } from '../../interfaces/handleStore.interfaces';
import { HandleStore } from '../../HandleStore';
import { bech32 } from 'bech32';

export const handlesFixture: ApiHandle[] = [
    {
        hex: 'barbacoa-hex',
        name: 'barbacoa',
        holder: 'stake-key1',
        image: '',
        standard_image: '',
        length: 8,
        og_number: 0,
        utxo: 'utxo1#0',
        rarity: Rarity.basic,
        characters: 'letters',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: '123'
        },
        default_in_wallet: 'taco',
        pfp_image: '',
        bg_image: '',
        created_slot_number: Date.now(),
        updated_slot_number: Date.now(),
        has_datum: false,
        amount: 1,
        image_hash: '',
        standard_image_hash: '',
        svg_version: '1.0.0',
        holder_type: '',
        version: 0,
        type: HandleType.HANDLE
    },
    {
        hex: 'burrito-hex',
        name: 'burrito',
        holder: 'stake-key1',
        image: '',
        standard_image: '',
        length: 7,
        og_number: 0,
        utxo: 'utxo2#0',
        rarity: Rarity.common,
        characters: 'letters',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: '123'
        },
        default_in_wallet: 'taco',
        pfp_image: '',
        bg_image: '',
        created_slot_number: Date.now() + 10,
        updated_slot_number: Date.now() + 10,
        has_datum: false,
        amount: 1,
        image_hash: '',
        standard_image_hash: '',
        svg_version: '1.0.0',
        holder_type: '',
        version: 0,
        type: HandleType.HANDLE
    },
    {
        hex: 'taco-hex',
        name: 'taco',
        holder: 'stake-key1',
        image: '',
        standard_image: '',
        length: 4,
        og_number: 0,
        utxo: 'utxo3#0',
        rarity: Rarity.common,
        characters: 'letters',
        numeric_modifiers: '',
        resolved_addresses: {
            ada: '123'
        },
        default_in_wallet: 'taco',
        pfp_image: '',
        bg_image: '',
        created_slot_number: Date.now() + 20,
        updated_slot_number: Date.now() + 20,
        has_datum: false,
        amount: 1,
        image_hash: '',
        standard_image_hash: '',
        svg_version: '1.0.0',
        holder_type: '',
        version: 0,
        type: HandleType.HANDLE
    }
];

export const slotHistoryFixture: Record<number, ISlotHistoryIndex> = {
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
            old: { resolved_addresses: { ada: '123' } }
        }
    },
    3: {
        burrito: {
            old: { resolved_addresses: { ada: '123' } }
        }
    },
    4: {
        barbacoa: {
            old: { resolved_addresses: { ada: '456' } }
        }
    }
};

export const holdersFixture = new Map<string, HolderAddressIndex>([
    [
        'addr1',
        {
            handles: new Set(['']),
            defaultHandle: 'burritos',
            manuallySet: false,
            type: 'script',
            knownOwnerName: 'funnable.token'
        }
    ],
    [
        'addr2',
        {
            handles: new Set(['7461636F73', '66616A69746173']),
            defaultHandle: 'tacos',
            manuallySet: false,
            type: 'wallet',
            knownOwnerName: ''
        }
    ]
]);

export const createRandomHandles = async (count: number, saveToHandleStore = false): Promise<ApiHandle[]> => {
    let handles: ApiHandle[] = [];
    for (let i = 0; i < count; i++) {
        const handleName = createRandomHandleName();
        if (!HandleStore.get(handleName)) {
            const handle = HandleStore.buildHandle({
                adaAddress: createRandomAddress(),
                name: handleName,
                hex: Buffer.from(handleName).toString('hex'),
                image: `ipfs://${Buffer.from(handleName).toString('hex')}`,
                og_number: Math.floor(Math.random() * 2438),
                slotNumber: i,
                type: HandleType.HANDLE,
                utxo: createRandomUtxo()
            });
            if (saveToHandleStore) {
                await HandleStore.save({ handle });
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
    for (let i = 0; i < count; i++) {
        switch (i % 3) {
            case 0: // add
                const handleName = createRandomHandleName();
                if (!HandleStore.get(handleName)) {
                    const newHandle = HandleStore.buildHandle({
                        adaAddress: createRandomAddress(),
                        name: handleName,
                        hex: Buffer.from(handleName).toString('hex'),
                        image: `ipfs://${Buffer.from(handleName).toString('hex')}`,
                        og_number: Math.floor(Math.random() * 2438),
                        slotNumber: beginningSlot + i,
                        type: HandleType.HANDLE,
                        utxo: createRandomUtxo()
                    });
                    await HandleStore.save({ handle: newHandle });
                }
                break;
            case 1: // update
                let oldHandle = HandleStore.getHandles()[Math.floor(Math.random() * HandleStore.getHandles().length)];
                const handle = {
                    ...oldHandle,
                    utxo: createRandomUtxo(),
                    resolved_addresses: { ada: createRandomAddress() },
                    updated_slot_number: beginningSlot + i
                };
                await HandleStore.save({ handle, oldHandle });
                break;
            case 2: // remove
                await HandleStore.burnHandle(HandleStore.getHandles()[Math.floor(Math.random() * HandleStore.getHandles().length)].name, beginningSlot + i);
                break;
        }
    }
};
