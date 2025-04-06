import { HandleStore } from '.';

describe('getFilesContent', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it('Should have AWS file first because it is newer', async () => {
        const handles = {};
        jest.spyOn(HandleStore, 'getFileOnline').mockResolvedValue({
            slot: 75171663,
            hash: 'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368',
            handles,
            schemaVersion: HandleStore.storageSchemaVersion
        });
        jest.spyOn(HandleStore, 'getFile').mockResolvedValue({
            slot: 42971872,
            hash: 'b5b276cb389ee36e624c66c632b0e983027609e7390fa7072a222261077117d6',
            handles,
            schemaVersion: HandleStore.storageSchemaVersion
        });

        const filesContent = await HandleStore.getFilesContent();

        expect(filesContent).toEqual([
            { handles, hash: 'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368', schemaVersion: HandleStore.storageSchemaVersion, slot: 75171663 },
            { handles, hash: 'b5b276cb389ee36e624c66c632b0e983027609e7390fa7072a222261077117d6', schemaVersion: HandleStore.storageSchemaVersion, slot: 42971872 }
        ]);
    });

    it('Should have local file first because it is newer', async () => {
        const handles = {};
        jest.spyOn(HandleStore, 'getFileOnline').mockResolvedValue({
            slot: 42971872,
            hash: 'b5b276cb389ee36e624c66c632b0e983027609e7390fa7072a222261077117d6',
            handles,
            schemaVersion: HandleStore.storageSchemaVersion
        });
        jest.spyOn(HandleStore, 'getFile').mockResolvedValue({
            slot: 75171663,
            hash: 'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368',
            handles,
            schemaVersion: HandleStore.storageSchemaVersion
        });
        const startingPoint = await HandleStore.getFilesContent();
        expect(startingPoint).toEqual([
            { handles, hash: 'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368', history: undefined, schemaVersion: HandleStore.storageSchemaVersion, slot: 75171663 },
            { handles, hash: 'b5b276cb389ee36e624c66c632b0e983027609e7390fa7072a222261077117d6', history: undefined, schemaVersion: HandleStore.storageSchemaVersion, slot: 42971872 }
        ]);
    });

    it('Should get starting point from the online file because the schema is newer', async () => {
        const handles = {};
        jest.spyOn(HandleStore, 'getFileOnline').mockResolvedValue({
            slot: 42971872,
            hash: 'b5b276cb389ee36e624c66c632b0e983027609e7390fa7072a222261077117d6',
            handles,
            schemaVersion: HandleStore.storageSchemaVersion + 1
        });
        jest.spyOn(HandleStore, 'getFile').mockResolvedValue({
            slot: 75171663,
            hash: 'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368',
            handles,
            schemaVersion: HandleStore.storageSchemaVersion
        });
        const startingPoint = await HandleStore.getFilesContent();
        expect(startingPoint).toEqual([{ handles, hash: 'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368', schemaVersion: HandleStore.storageSchemaVersion, slot: 75171663 }]);
    });

    it('Should get starting point from the local file when schema is unavailable', async () => {
        const handles = {};
        jest.spyOn(HandleStore, 'getFileOnline').mockResolvedValue({
            slot: 42971872,
            hash: 'b5b276cb389ee36e624c66c632b0e983027609e7390fa7072a222261077117d6',
            handles
        });
        jest.spyOn(HandleStore, 'getFile').mockResolvedValue({
            slot: 75171663,
            hash: 'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368',
            handles,
            schemaVersion: HandleStore.storageSchemaVersion
        });
        const startingPoint = await HandleStore.getFilesContent();
        expect(startingPoint).toEqual([{ handles, hash: 'd7b348e2d841e25d13e5551246275f6c8c6f47c2591288a64a009945b392a368', schemaVersion: HandleStore.storageSchemaVersion, slot: 75171663 }]);
    });

    it('Should get starting point from the local file when online file is unavailable', async () => {
        jest.spyOn(HandleStore, 'getFileOnline').mockResolvedValue(null);
        jest.spyOn(HandleStore, 'getFile').mockResolvedValue({
            slot: 1,
            hash: 'a',
            handles: {},
            schemaVersion: HandleStore.storageSchemaVersion
        });
        const startingPoint = await HandleStore.getFilesContent();
        expect(startingPoint).toEqual([{ handles: {}, hash: 'a', schemaVersion: HandleStore.storageSchemaVersion, slot: 1 }]);
    });

    it('Should get starting point from the online file when local available', async () => {
        jest.spyOn(HandleStore, 'getFileOnline').mockResolvedValue({
            slot: 2,
            hash: 'b',
            schemaVersion: HandleStore.storageSchemaVersion,
            handles: {}
        });
        jest.spyOn(HandleStore, 'getFile').mockResolvedValue(null);
        const startingPoint = await HandleStore.getFilesContent();
        expect(startingPoint).toEqual([{ handles: {}, hash: 'b', schemaVersion: HandleStore.storageSchemaVersion, slot: 2 }]);
    });

    it('Should use starting point from constants if both AWS and local file are not found', async () => {
        // clear the mock so we don't see the beforeAll() saves
        jest.clearAllMocks();
        jest.spyOn(HandleStore, 'getFileOnline').mockResolvedValue(null);
        jest.spyOn(HandleStore, 'getFile').mockResolvedValue(null);
        const startingPoint = await HandleStore.getFilesContent();
        expect(startingPoint).toEqual(null);
    });

    it('Should use starting point from constants if local schemaVersion does not match the HandleStore.storageSchemaVersion', async () => {
        // clear the mock so we don't see the beforeAll() saves
        jest.clearAllMocks();
        jest.spyOn(HandleStore, 'getFileOnline').mockResolvedValue(null);
        jest.spyOn(HandleStore, 'getFile').mockResolvedValue({
            slot: 1,
            hash: 'a',
            handles: {},
            schemaVersion: 1
        });
        const startingPoint = await HandleStore.getFilesContent();
        expect(startingPoint).toEqual(null);
    });

    it('Should save handles', async () => {
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

        const startingPoint = await HandleStore.getFilesContent();
        expect(startingPoint).toEqual([{ handles: { hndl_1: { name: 'hndl_1' } }, hash: 'a', schemaVersion: HandleStore.storageSchemaVersion, slot: 1 }]);
    });
});
