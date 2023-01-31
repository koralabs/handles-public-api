import { PointOrOrigin, TipOrOrigin } from '@cardano-ogmios/schema';
import { Logger } from '@koralabs/kora-labs-common';
import { HandleStore } from '../../repositories/memory/HandleStore';

export const processRollback = async (point: PointOrOrigin, tip: TipOrOrigin) => {
    if (point === 'origin') {
        // this is a rollback to genesis. We need to clear the memory store and start over
        Logger.log(`ROLLBACK POINT: ${JSON.stringify(point)}`);
        await HandleStore.rollBackToGenesis();
    } else {
        const { slot, hash } = point;
        let lastSlot = 0;
        if (tip !== 'origin') {
            lastSlot = tip.slot;
        }

        // The idea here is we need to rollback all changes from a given slot
        await HandleStore.rewindChangesToSlot({ slot, hash, lastSlot });
    }
};
