import { IHandle, IPersonalization } from '@koralabs/handles-public-api-interfaces';
import fs from 'fs';
import { HandleStore } from '../../repositories/memory/HandleStore';
import { IHandleFileContent } from '../../repositories/memory/interfaces/handleStore.interfaces';

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
                    await HandleStore.savePersonalizationChange({
                        hex,
                        name,
                        personalization,
                        addresses,
                        slotNumber: fileContents.slot,
                        setDefault: false // TODO: make this dynamic
                    });
                });
            }
        }
    }

    async startSync() {
        await HandleStore.prepareHandlesStorage();
        fs.watch(this.filePath, this.rollForward);
    }
}
