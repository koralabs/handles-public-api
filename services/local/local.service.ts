import { IHandle, IHandleFileContent, IPersonalization } from '@koralabs/kora-labs-common';
import fs from 'fs';
import { MemoryHandlesRepository } from '../../repositories/memory';
const repo = new MemoryHandlesRepository();

interface PersonalizationUpdates extends IHandle {
    personalization: IPersonalization;
}

export class LocalService {
    private filePath = 'storage/local.json';
    private rollForward(event: string) {
        if (event === 'change') {
            const data = fs.readFileSync('storage/local.json', 'utf-8');
            if (data) {
                const fileContents = JSON.parse(data) as IHandleFileContent;
                Object.entries(fileContents.handles).forEach(async ([k, v]) => {
                    const { hex, name, personalization, resolved_addresses: addresses } = v as PersonalizationUpdates;
                    console.log(`${name} changed! saving personalization`);
                    await repo.savePersonalizationChange({
                        hex,
                        name,
                        personalization,
                        addresses,
                        slotNumber: fileContents.slot,
                        setDefault: false, // TODO: make this dynamic,
                        // @ts-ignore
                        metadata: {}
                    });
                });
            }
        }
    }

    async startSync() {
        await repo.prepareHandlesStorage();
        fs.watch(this.filePath, this.rollForward);
    }
}
