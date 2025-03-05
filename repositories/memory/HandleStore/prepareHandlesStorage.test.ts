import { IHandleFileContent } from '@koralabs/kora-labs-common';
import { HandleStore } from '.';

describe('prepareHandlesStorage', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('Should save handles', async () => {
        const saveSpy = jest.spyOn(HandleStore, 'save').mockImplementation();
        const handleFileContent: IHandleFileContent = {
            slot: 1,
            hash: 'a',
            handles: {
                // @ts-ignore
                hndl_1: {
                    name: 'hndl_1'
                }
            },
            schemaVersion: HandleStore.storageSchemaVersion
        };

        await HandleStore.prepareHandlesStorage(handleFileContent);
        expect(saveSpy).toHaveBeenCalledWith({ handle: { name: 'hndl_1' }, saveHistory: false });
    });
});
