import fs from 'fs';
import { IHandle, IPersonalization } from '../../interfaces/handle.interface';
import { HandleStore } from '../../repositories/memory/HandleStore';

interface PersonalizationUpdates extends IHandle {
    personalization: IPersonalization;
}

export class LocalService {
    private filePath = 'storage/local.json';
    private rollForward(event: string) {
        if (event === 'change') {
            const data = fs.readFileSync('storage/local.json', 'utf-8');
            if (data) {
                const { hex, personalization } = JSON.parse(data) as PersonalizationUpdates;
                HandleStore.savePersonalizationChange({ hexName: hex, personalization });
            }
        }
    }

    async startSync() {
        await HandleStore.prepareHandlesStorage();
        fs.watch(this.filePath, this.rollForward);
    }
}
