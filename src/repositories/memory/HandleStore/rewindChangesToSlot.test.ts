import { Logger } from '@koralabs/kora-labs-common';
import { HandleStore } from '.';
import { handlesFixture, slotHistoryFixture } from '../tests/fixtures/handles';
import * as addresses from '../../../utils/addresses';

jest.mock('../../../utils/addresses');

describe('rewindChangesToSlot', () => {
    beforeEach(async () => {
        jest.spyOn(addresses, 'getAddressHolderDetails').mockReturnValue({
            address: 'stake123',
            type: 'base',
            knownOwnerName: 'unknown'
        });
        // populate storage
        for (const key in handlesFixture) {
            const handle = handlesFixture[key];
            const {
                hex,
                standard_image: image,
                image_hash,
                standard_image_hash,
                svg_version,
                name,
                og_number,
                updated_slot_number: slotNumber,
                utxo,
                resolved_addresses: { ada: adaAddress }
            } = handle;
            await HandleStore.saveMintedHandle({ adaAddress, hex, image, name, og_number, slotNumber, utxo,
                image_hash: standard_image_hash,
                svg_version });
        }

        // set the slotHistoryIndex
        HandleStore.slotHistoryIndex = new Map(
            Object.keys(slotHistoryFixture).map((k) => {
                const slot = parseInt(k);
                return [slot, slotHistoryFixture[slot]];
            })
        );
    });

    afterEach(() => {
        for (const key in handlesFixture) {
            const handle = handlesFixture[key];
            HandleStore.remove(handle.name);
        }

        HandleStore.slotHistoryIndex = new Map();

        jest.clearAllMocks();
    });

    it('Should rewind to the slot 0 and remove all handle', async () => {
        const loggerSpy = jest.spyOn(Logger, 'log');
        const setMetricsSpy = jest.spyOn(HandleStore, 'setMetrics').mockImplementation();

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
            message: 'Finished Rewinding to slot 0 with 3 updates and 3 deletes.'
        });
        expect(setMetricsSpy).toHaveBeenCalledWith({ currentBlockHash: hash, currentSlot: slot, lastSlot });
    });

    it('Should rewind to the slot 2 and and reset the ada address to the old address', async () => {
        const slot = 2;
        const hash = 'hash2';
        const lastSlot = 10;
        const setMetricsSpy = jest.spyOn(HandleStore, 'setMetrics').mockImplementation();

        await HandleStore.rewindChangesToSlot({ slot, hash, lastSlot });

        // and none after the rollback
        expect(HandleStore.get('burrito')?.resolved_addresses.ada).toEqual('123');
        expect(HandleStore.get('barbacoa')?.resolved_addresses.ada).toEqual('456');

        expect(setMetricsSpy).toHaveBeenCalledWith({ currentBlockHash: hash, currentSlot: slot, lastSlot });
    });

    it('Should get entire handle during rewind when burn happens', async () => {
        const slot = 4;
        const hash = 'hash4';
        const lastSlot = 10;
        jest.spyOn(HandleStore, 'setMetrics').mockImplementation();

        await HandleStore.burnHandle('taco', 5);

        await HandleStore.rewindChangesToSlot({ slot, hash, lastSlot });

        // should pull back the entire handle
        expect(HandleStore.get('taco')).toEqual({ ...handlesFixture[2], holder: 'stake123' });
    });
});
