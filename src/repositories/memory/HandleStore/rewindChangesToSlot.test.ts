import { Logger } from '@koralabs/kora-labs-common';
import { HandleStore } from '.';
import { handlesFixture, slotHistoryFixture } from '../tests/fixtures/handles';
import * as addresses from '../../../utils/addresses';
import { HandleHistory } from '../interfaces/handleStore.interfaces';

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
                resolved_addresses: { ada: adaAddress },
                hasDatum
            } = handle;
            await HandleStore.saveMintedHandle({ adaAddress, hexName, image, name, og, slotNumber, utxo, hasDatum });
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
            HandleStore.remove(handle.hex);
        }

        HandleStore.slotHistoryIndex = new Map();

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

        // get the amount of updates and deletes from slotHistoryFixture
        const fixtureChanges = Object.keys(slotHistoryFixture).reduce<{ updates: number; deletes: number }>(
            (acc, curr) => {
                const { updates, deletes } = Object.keys(slotHistoryFixture[parseInt(curr)]).reduce(
                    (acc2, handleKey) => {
                        const item = slotHistoryFixture[parseInt(curr)][handleKey] as HandleHistory;
                        if (item.old) {
                            acc2.updates += 1;
                        } else {
                            acc2.deletes += 1;
                        }
                        return acc2;
                    },
                    { updates: 0, deletes: 0 }
                );
                acc.updates += updates;
                acc.deletes += deletes;
                return acc;
            },
            { updates: 0, deletes: 0 }
        );

        expect(loggerSpy).toHaveBeenNthCalledWith(4, {
            category: 'INFO',
            event: 'HandleStore.rewindChangesToSlot',
            message: `Finished Rewinding to slot ${slot} with ${fixtureChanges.updates} updates and ${fixtureChanges.deletes} deletes`
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

        expect(setMetricsSpy).toHaveBeenCalledWith({ currentBlockHash: hash, currentSlot: slot, lastSlot });
    });
});
