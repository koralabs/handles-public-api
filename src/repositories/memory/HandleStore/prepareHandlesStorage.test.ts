import { HandleStore } from '.';

describe('prepareHandlesStorage', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('Should get starting point from AWS file because it is newer', async () => {
        const saveHandlesFileSpy = jest.spyOn(HandleStore, 'saveHandlesFile').mockImplementation();
        jest.spyOn(HandleStore, 'getFileOnline').mockResolvedValue({
            slot: 75171663,
            hash: 'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368',
            handles: {},
            schemaVersion: 1
        });
        jest.spyOn(HandleStore, 'getFile').mockResolvedValue({
            slot: 42971872,
            hash: 'b5b276cb389ee36e624c66c632b0e983027609e7390fa7072a222261077117d6',
            handles: {},
            schemaVersion: 1
        });

        const startingPoint = await HandleStore.prepareHandlesStorage();

        expect(startingPoint).toEqual({
            hash: 'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368',
            slot: 75171663
        });

        expect(saveHandlesFileSpy).toHaveBeenCalledWith(
            75171663,
            'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368'
        );
    });

    it('Should get starting point from the local file because it is newer', async () => {
        const saveHandlesFileSpy = jest.spyOn(HandleStore, 'saveHandlesFile').mockImplementation();
        jest.spyOn(HandleStore, 'getFileOnline').mockResolvedValue({
            slot: 42971872,
            hash: 'b5b276cb389ee36e624c66c632b0e983027609e7390fa7072a222261077117d6',
            handles: {},
            schemaVersion: HandleStore.storageSchemaVersion
        });
        jest.spyOn(HandleStore, 'getFile').mockResolvedValue({
            slot: 75171663,
            hash: 'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368',
            handles: {},
            schemaVersion: HandleStore.storageSchemaVersion
        });
        const startingPoint = await HandleStore.prepareHandlesStorage();
        expect(startingPoint).toEqual({
            hash: 'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368',
            slot: 75171663
        });
        expect(saveHandlesFileSpy).toHaveBeenCalledTimes(0);
    });

    it('Should get starting point from the online file because the schema is newer', async () => {
        const saveHandlesFileSpy = jest.spyOn(HandleStore, 'saveHandlesFile').mockImplementation();
        jest.spyOn(HandleStore, 'getFileOnline').mockResolvedValue({
            slot: 42971872,
            hash: 'b5b276cb389ee36e624c66c632b0e983027609e7390fa7072a222261077117d6',
            handles: {},
            schemaVersion: 2
        });
        jest.spyOn(HandleStore, 'getFile').mockResolvedValue({
            slot: 75171663,
            hash: 'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368',
            handles: {},
            schemaVersion: 1
        });
        const startingPoint = await HandleStore.prepareHandlesStorage();
        expect(startingPoint).toEqual({
            hash: 'b5b276cb389ee36e624c66c632b0e983027609e7390fa7072a222261077117d6',
            slot: 42971872
        });
        expect(saveHandlesFileSpy).toHaveBeenCalledTimes(1);
    });

    it('Should get starting point from the local file when schema is unavailable', async () => {
        const saveHandlesFileSpy = jest.spyOn(HandleStore, 'saveHandlesFile').mockImplementation();
        jest.spyOn(HandleStore, 'getFileOnline').mockResolvedValue({
            slot: 42971872,
            hash: 'b5b276cb389ee36e624c66c632b0e983027609e7390fa7072a222261077117d6',
            handles: {}
        });
        jest.spyOn(HandleStore, 'getFile').mockResolvedValue({
            slot: 75171663,
            hash: 'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368',
            handles: {},
            schemaVersion: HandleStore.storageSchemaVersion
        });
        const startingPoint = await HandleStore.prepareHandlesStorage();
        expect(startingPoint).toEqual({
            hash: 'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368',
            slot: 75171663
        });
        expect(saveHandlesFileSpy).toHaveBeenCalledTimes(0);
    });

    it('Should get starting point from the local file when online file is unavailable', async () => {
        const saveHandlesFileSpy = jest.spyOn(HandleStore, 'saveHandlesFile').mockImplementation();
        jest.spyOn(HandleStore, 'getFileOnline').mockResolvedValue(null);
        jest.spyOn(HandleStore, 'getFile').mockResolvedValue({
            slot: 1,
            hash: 'a',
            handles: {},
            schemaVersion: HandleStore.storageSchemaVersion
        });
        const startingPoint = await HandleStore.prepareHandlesStorage();
        expect(startingPoint).toEqual({
            hash: 'a',
            slot: 1
        });
        expect(saveHandlesFileSpy).toHaveBeenCalledTimes(0);
    });

    it('Should get starting point from the online file when local available', async () => {
        const saveHandlesFileSpy = jest.spyOn(HandleStore, 'saveHandlesFile').mockImplementation();
        jest.spyOn(HandleStore, 'getFileOnline').mockResolvedValue({
            slot: 2,
            hash: 'b',
            schemaVersion: 1,
            handles: {}
        });
        jest.spyOn(HandleStore, 'getFile').mockResolvedValue(null);
        const startingPoint = await HandleStore.prepareHandlesStorage();
        expect(startingPoint).toEqual({
            hash: 'b',
            slot: 2
        });
        expect(saveHandlesFileSpy).toHaveBeenCalledTimes(1);
    });

    it('Should use starting point from constants if both AWS and local file are not found', async () => {
        // clear the mock so we don't see the beforeAll() saves
        jest.clearAllMocks();
        const saveSpy = jest.spyOn(HandleStore, 'save');
        const saveHandlesFileSpy = jest.spyOn(HandleStore, 'saveHandlesFile').mockImplementation();
        jest.spyOn(HandleStore, 'getFileOnline').mockResolvedValue(null);
        jest.spyOn(HandleStore, 'getFile').mockResolvedValue(null);
        const startingPoint = await HandleStore.prepareHandlesStorage();
        expect(startingPoint).toEqual(null);
        expect(saveSpy).toHaveBeenCalledTimes(0);
        expect(saveHandlesFileSpy).toHaveBeenCalledTimes(0);
    });

    it('Should use starting point from constants if local schemaVersion does not match the HandleStore.storageSchemaVersion', async () => {
        // clear the mock so we don't see the beforeAll() saves
        jest.clearAllMocks();
        const saveSpy = jest.spyOn(HandleStore, 'save');
        const saveHandlesFileSpy = jest.spyOn(HandleStore, 'saveHandlesFile').mockImplementation();
        jest.spyOn(HandleStore, 'getFileOnline').mockResolvedValue(null);
        jest.spyOn(HandleStore, 'getFile').mockResolvedValue({
            slot: 1,
            hash: 'a',
            handles: {},
            schemaVersion: 1
        });
        const startingPoint = await HandleStore.prepareHandlesStorage();
        expect(startingPoint).toEqual(null);
        expect(saveSpy).toHaveBeenCalledTimes(0);
        expect(saveHandlesFileSpy).toHaveBeenCalledTimes(0);
    });

    it('Should save handles', async () => {
        const saveSpy = jest.spyOn(HandleStore, 'save').mockImplementation();
        jest.spyOn(HandleStore, 'getFileOnline').mockResolvedValue(null);
        jest.spyOn(HandleStore, 'getFile').mockResolvedValue({
            slot: 1,
            hash: 'a',
            handles: {
                hndl_1: {
                    name: 'hndl_1'
                }
            },
            schemaVersion: HandleStore.storageSchemaVersion
        });

        const startingPoint = await HandleStore.prepareHandlesStorage();
        expect(startingPoint).toEqual({ hash: 'a', slot: 1 });

        expect(saveSpy).toHaveBeenCalledWith({ handle: { name: 'hndl_1' }, saveHistory: false });
    });
});
