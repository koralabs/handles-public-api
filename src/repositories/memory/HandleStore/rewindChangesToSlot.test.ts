import { Logger } from '@koralabs/kora-labs-common';
import { HandleStore } from '.';
import { handlesFixture, slotHistoryFixture } from '../tests/fixtures/handles';
import * as addresses from '../../../utils/addresses';

jest.mock('../../../utils/addresses');

describe('rewindChangesToSlot', () => {
    beforeEach(async () => {
        jest.spyOn(addresses, 'getAddressHolderDetails').mockResolvedValue({
            address: 'stake123',
            type: 'base',
            knownOwnerName: 'unknown'
        });
        // populate storage
        for (const key in handlesFixture) {
            const handle = handlesFixture[key];
            const {
                hex: hexName,
                original_nft_image: image,
                name,
                og,
                updated_slot_number: slotNumber,
                utxo,
                resolved_addresses: { ada: adaAddress }
            } = handle;
            await HandleStore.saveMintedHandle({ adaAddress, hexName, image, name, og, slotNumber, utxo });
        }

        // set the slotHistoryIndex
        HandleStore.slotHistoryIndex = new Map(
            Object.keys(slotHistoryFixture).map((k) => {
                const slot = parseInt(k);
                return [slot, slotHistoryFixture[slot]];
            })
        );

        HandleStore.orphanedPersonalizationIndex = new Map([
            ['taco-hex', { nft_appearance: { handleTextShadowColor: '#CCC' } }]
        ]);
    });

    afterEach(() => {
        for (const key in handlesFixture) {
            const handle = handlesFixture[key];
            HandleStore.remove(handle.hex);
        }

        HandleStore.slotHistoryIndex = new Map();
        HandleStore.orphanedPersonalizationIndex = new Map();

        jest.clearAllMocks();
    });

    it('Should rewind to the slot 0 and remove all handle', async () => {
        const loggerSpy = jest.spyOn(Logger, 'log');
        const setMetricsSpy = jest.spyOn(HandleStore, 'setMetrics');

        // We should have 3 handles before the rollback
        expect(HandleStore.getHandles()).toHaveLength(3);

        const slot = 0;
        const hash = 'hash0';
        const lastSlot = 10;

        await HandleStore.rewindChangesToSlot({ slot, hash, lastSlot });

        // and none after the rollback
        expect(HandleStore.getHandles().length).toEqual(0);
        expect(Object.entries(HandleStore.slotHistoryIndex)).toEqual([]);

        expect(loggerSpy).toHaveBeenNthCalledWith(4, {
            category: 'INFO',
            event: 'HandleStore.rewindChangesToSlot',
            message:
                'Finished Rewinding to slot 0 with 3 handle updates, 3 handle deletes, 2 orphaned personalization updates, and 1 orphaned personalization deletes'
        });
        expect(setMetricsSpy).toHaveBeenCalledWith({ currentBlockHash: hash, currentSlot: slot, lastSlot });
    });

    it('Should rewind to the slot 2 and and reset the ada address to the old address', async () => {
        const slot = 2;
        const hash = 'hash2';
        const lastSlot = 10;
        await HandleStore.rewindChangesToSlot({ slot, hash, lastSlot });
        const setMetricsSpy = jest.spyOn(HandleStore, 'setMetrics');

        // and none after the rollback
        expect(HandleStore.get('burrito-hex')?.resolved_addresses.ada).toEqual('123');
        expect(HandleStore.get('barbacoa-hex')?.resolved_addresses.ada).toEqual('456');
        expect(HandleStore.orphanedPersonalizationIndex.get('taco-hex')).toEqual({
            nft_appearance: { handleTextShadowColor: '#fff' }
        });

        expect(setMetricsSpy).toHaveBeenCalledWith({ currentBlockHash: hash, currentSlot: slot, lastSlot });
    });
});
