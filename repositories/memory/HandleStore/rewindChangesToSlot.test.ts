import { Logger } from '@koralabs/kora-labs-common';
import { HandleStore } from '.';
import { handlesFixture, slotHistoryFixture } from '../tests/fixtures/handles';


describe('rewindChangesToSlot', () => {
    beforeEach(async () => {
        // populate storage
        for (const key in handlesFixture) {
            const handle = handlesFixture[key];
            const {
                hex,
                standard_image: image,
                standard_image_hash,
                svg_version,
                name,
                og_number,
                updated_slot_number: slotNumber,
                utxo,
                lovelace,
                resolved_addresses: { ada: adaAddress },
                handle_type,
                last_update_address
            } = handle;
            await HandleStore.saveMintedHandle({ adaAddress, hex, image, name, og_number, slotNumber, utxo, lovelace, image_hash: standard_image_hash, svg_version, handle_type, last_update_address });
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
        jest.spyOn(Logger, 'log');
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
        expect(setMetricsSpy).toHaveBeenCalledWith({ currentBlockHash: hash, currentSlot: slot, lastSlot });
    });

    it('Should rewind to the slot 2 and and reset the ada address to the old address', async () => {
        const slot = 2;
        const hash = 'hash2';
        const lastSlot = 10;
        const setMetricsSpy = jest.spyOn(HandleStore, 'setMetrics').mockImplementation();

        await HandleStore.rewindChangesToSlot({ slot, hash, lastSlot });

        // and none after the rollback
        expect(HandleStore.get('burrito')?.resolved_addresses.ada).toEqual('addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q');
        expect(HandleStore.get('barbacoa')?.resolved_addresses.ada).toEqual('addr_test1qzdzhdzf9ud8k2suzryvcdl78l3tfesnwp962vcuh99k8z834r3hjynmsy2cxpc04a6dkqxcsr29qfl7v9cmrd5mm89qfmc97q');

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
        expect(HandleStore.get('taco')).toEqual({ ...handlesFixture[2], holder: 'stake_test1urc63cmezfacz9vrqu867axmqrvgp4zsyllxzud3k6danjsn0dn70' });
    });
});
