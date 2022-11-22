import fs from 'fs';
import { IHandle, IPersonalization } from '../../interfaces/handle.interface';
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
                Object.entries(fileContents.handles).forEach(([k, v]) => {
                    const { hex, name, personalization, resolved_addresses: addresses } = v as PersonalizationUpdates;
                    console.log(`${name} changed! saving personalization`);
                    HandleStore.savePersonalizationChange({ hexName: hex, personalization, addresses });
                });
            }
        }
    }

    async startSync() {
        await HandleStore.prepareHandlesStorage();
        fs.watch(this.filePath, this.rollForward);
    }
}
