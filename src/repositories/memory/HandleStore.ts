import fetch from 'cross-fetch';
import fs from 'fs';
import lockfile from 'proper-lockfile';
import { IHandle, IHandleStats } from '../../interfaces/handle.interface';
import { getRarity } from '../../services/ogmios/utils';
import { LogCategory, Logger } from '../../utils/logger';
import { getElapsedTime } from '../../utils/util';
import { IHandleFileContent, IHandleStoreMetrics } from './interfaces/handleStore.interfaces';
export class HandleStore {
    static handles = new Map<string, IHandle>();
    static nameIndex = new Map<string, string>();
    static rarityIndex = new Map<string, Set<string>>();
    static ogIndex = new Map<string, Set<string>>();
    static charactersIndex = new Map<string, Set<string>>();
    static numericModifiersIndex = new Map<string, Set<string>>();
    static lengthIndex = new Map<string, Set<string>>();
    static metrics: IHandleStoreMetrics = {
        firstSlot: 0,
        lastSlot: 0,
        currentSlot: 0,
        elapsedOgmiosExec: 0,
        elapsedBuildingExec: 0,
        firstMemoryUsage: 0,
        currentBlockHash: '',
        memorySize: 0
    };

    static storagePath = 'storage/handles.json';
    static storageSchemaVersion = 1;

    static get = (key: string) => {
        return this.handles.get(key);
    };

    static count = () => {
        return this.handles.size;
    };

    static getHandles = () => {
        return Array.from(this.handles, ([_, value]) => ({ ...value } as IHandle));
    };

    static getFromNameIndex = (name: string) => {
        return this.nameIndex.get(name);
    };

    static addIndexSet = (indexSet: Map<string, Set<string>>, indexKey: string, hexName: string) => {
        const set = indexSet.get(indexKey) ?? new Set();
        set.add(hexName);
        indexSet.set(indexKey, set);
    };

    static save = (handle: IHandle) => {
        const { name, rarity, og, characters, numeric_modifiers, length, hex } = handle;

        // Set the main index
        this.handles.set(hex, handle);

        // set all one-to-one indexes
        this.nameIndex.set(name, hex);

        // set all one-to-many indexes
        this.addIndexSet(this.rarityIndex, rarity, hex);
        this.addIndexSet(this.ogIndex, `${og}`, hex);
        this.addIndexSet(this.charactersIndex, characters, hex);
        this.addIndexSet(this.numericModifiersIndex, numeric_modifiers, hex);
        this.addIndexSet(this.lengthIndex, `${length}`, hex);
    };

    static convertMapsToObjects = <T>(mapInstance: Map<string, T>) => {
        return Array.from(mapInstance).reduce<Record<string, T>>((obj, [key, value]) => {
            obj[key] = value;
            return obj;
        }, {});
    };

    static memorySize() {
        const object = {
            ...this.convertMapsToObjects(this.handles),
            ...this.convertMapsToObjects(this.nameIndex),
            ...this.convertMapsToObjects(this.rarityIndex),
            ...this.convertMapsToObjects(this.ogIndex),
            ...this.convertMapsToObjects(this.lengthIndex),
            ...this.convertMapsToObjects(this.charactersIndex),
            ...this.convertMapsToObjects(this.numericModifiersIndex)
        };

        return Buffer.byteLength(JSON.stringify(object));
    }

    static setMetrics(metrics: IHandleStoreMetrics): void {
        this.metrics = { ...this.metrics, ...metrics };
    }

    static getTimeMetrics() {
        const { elapsedOgmiosExec = 0, elapsedBuildingExec = 0 } = this.metrics;
        return {
            elapsedOgmiosExec,
            elapsedBuildingExec
        };
    }

    static getMetrics(): IHandleStats {
        const {
            firstSlot = 0,
            lastSlot = 0,
            currentSlot = 0,
            firstMemoryUsage = 0,
            elapsedOgmiosExec = 0,
            elapsedBuildingExec = 0,
            currentBlockHash = '',
            memorySize = 0
        } = this.metrics;

        const handleSlotRange = lastSlot - firstSlot;
        const currentSlotInRange = currentSlot - firstSlot;

        const handleCount = this.count();

        const percentageComplete =
            currentSlot === 0 ? '0.00' : ((currentSlotInRange / handleSlotRange) * 100).toFixed(2);

        const currentMemoryUsage = process.memoryUsage().rss;
        const currentMemoryUsed = Math.round(((currentMemoryUsage - firstMemoryUsage) / 1024 / 1024) * 100) / 100;

        const ogmiosElapsed = getElapsedTime(elapsedOgmiosExec);
        const buildingElapsed = getElapsedTime(elapsedBuildingExec);

        const slotDate = new Date((1596491091 + (currentSlot - 4924800)) * 1000);

        return {
            percentageComplete,
            currentMemoryUsed,
            ogmiosElapsed,
            buildingElapsed,
            slotDate,
            handleCount,
            memorySize,
            currentSlot,
            currentBlockHash
        };
    }

    static buildStorage() {
        // used to quickly build a large datastore
        Array.from(Array(1000000).keys()).forEach((number) => {
            const hex = `hash-${number}`;
            const name = `${number}`.padStart(8, 'a');
            const handle: IHandle = {
                hex,
                name,
                nft_image: `QmUtUk9Yi2LafdaYRcYdSgTVMaaDewPXoxP9wc18MhHygW`,
                original_nft_image: `QmUtUk9Yi2LafdaYRcYdSgTVMaaDewPXoxP9wc18MhHygW`,
                length: `${number}`.length,
                og: 0,
                rarity: getRarity(`${number}`),
                characters: 'letters,numbers,special',
                numeric_modifiers: 'negative,decimal',
                resolved_addresses: {
                    ada: 'addr_test1qqrvwfds2vxvzagdrejjpwusas4j0k64qju5ul7hfnjl853lqpk6tq05pf67hwvmplvu0gc2xn75vvy3gyuxe6f7e5fsw0ever'
                },
                personalization: {}
            };

            this.save(handle);
        });
    }

    static async saveFile(slot: number, hash: string, storagePath?: string, processing?: Function): Promise<boolean> {
        const handles = {
            ...this.convertMapsToObjects(this.handles)
        };

        const path = storagePath ?? this.storagePath;

        try {
            Logger.log(`Saving file with ${this.handles.size} handles`);
            const isLocked = await lockfile.check(path);
            if (isLocked) {
                Logger.log('Unable to save. File is locked');
                return false;
            }

            const release = await lockfile.lock(path);

            fs.writeFileSync(
                storagePath ?? this.storagePath,
                JSON.stringify({
                    slot,
                    hash,
                    schemaVersion: this.storageSchemaVersion,
                    handles
                })
            );

            if (processing) await processing();

            await release();
            return true;
        } catch (error: any) {
            Logger.log(`Error writing file: ${error.message}`, LogCategory.ERROR);
            return false;
        }
    }

    static async getFile(storagePath?: string): Promise<IHandleFileContent | null> {
        const path = storagePath ?? this.storagePath;

        try {
            const isLocked = await lockfile.check(path);
            if (isLocked) {
                return null;
            }

            const file = fs.readFileSync(path, { encoding: 'utf8' });
            return JSON.parse(file) as IHandleFileContent;
        } catch (error: any) {
            Logger.log(`Error getting file from ${path} with error: ${error.message}`);
            return null;
        }
    }

    static async getFileOnline(): Promise<IHandleFileContent | null> {
        try {
            Logger.log('Fetching handles.json');
            const awsResponse = await fetch('http://api.handle.me.s3-website-us-west-2.amazonaws.com/handles.json');
            if (awsResponse.status === 200) {
                const text = await awsResponse.text();
                Logger.log('Found handles.json');
                return JSON.parse(text) as IHandleFileContent;
            }

            return null;
        } catch (error: any) {
            Logger.log(`Error fetching file from online with error: ${error.message}`);
            return null;
        }
    }
}
