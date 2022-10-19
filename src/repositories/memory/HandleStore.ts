import fs from 'fs';
import { IHandle, IHandleStats } from '../../interfaces/handle.interface';
import { getRarity } from '../../services/ogmios/utils';
import { LogCategory, Logger } from '../../utils/logger';
import { getElapsedTime } from '../../utils/util';

interface HandleStoreMetrics {
    firstSlot?: number;
    lastSlot?: number;
    currentSlot?: number;
    elapsedOgmiosExec?: number;
    elapsedBuildingExec?: number;
    firstMemoryUsage?: number;
    currentBlockHash?: string;
}

export class HandleStore {
    static handles = new Map<string, IHandle>();
    static nameIndex = new Map<string, string>();
    static rarityIndex = new Map<string, Set<string>>();
    static ogIndex = new Map<string, Set<string>>();
    static charactersIndex = new Map<string, Set<string>>();
    static numericModifiersIndex = new Map<string, Set<string>>();
    static metrics: HandleStoreMetrics = {
        firstSlot: 0,
        lastSlot: 0,
        currentSlot: 0,
        elapsedOgmiosExec: 0,
        elapsedBuildingExec: 0,
        firstMemoryUsage: 0,
        currentBlockHash: ''
    };

    static get = (key: string) => {
        return this.handles.get(key);
    };

    static count = () => {
        return this.handles.size;
    };

    static addIndexSet = (indexSet: Map<string, Set<string>>, indexKey: string, hexName: string) => {
        const set = indexSet.get(indexKey) ?? new Set();
        set.add(hexName);
        indexSet.set(indexKey, set);
    };

    static save = (key: string, handle: IHandle) => {
        const { name, rarity, og, characters, numeric_modifiers } = handle;

        // Set the main index
        this.handles.set(key, handle);

        // set all one-to-one indexes
        this.nameIndex.set(name, key);

        // set all one-to-many indexes
        this.addIndexSet(this.rarityIndex, rarity, key);
        this.addIndexSet(this.ogIndex, `${og}`, key);
        this.addIndexSet(this.charactersIndex, characters, key);
        this.addIndexSet(this.numericModifiersIndex, numeric_modifiers, key);
    };

    static convertMapsToObjects = (mapInstance: Map<string, any>) => {
        return Array.from(mapInstance).reduce<Record<string, unknown>>((obj, [key, value]) => {
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
            ...this.convertMapsToObjects(this.charactersIndex),
            ...this.convertMapsToObjects(this.numericModifiersIndex)
        };

        return Buffer.byteLength(JSON.stringify(object));
    }

    static setMetrics(metrics: HandleStoreMetrics): void {
        this.metrics = { ...this.metrics, ...metrics };
    }

    static getTimeMetrics() {
        const { elapsedOgmiosExec = 0, elapsedBuildingExec = 0 } = this.metrics;
        return {
            elapsedOgmiosExec,
            elapsedBuildingExec
        }
    }

    static getMetrics(): IHandleStats {
        const {
            firstSlot = 0,
            lastSlot = 0,
            currentSlot = 0,
            firstMemoryUsage = 0,
            elapsedOgmiosExec = 0,
            elapsedBuildingExec = 0,
            currentBlockHash = ''
        } = this.metrics;

        const handleSlotRange = lastSlot - firstSlot;
        const currentSlotInRange = currentSlot - firstSlot;

        const percentageComplete = currentSlot === 0 ? '0.00' : ((currentSlotInRange / handleSlotRange) * 100).toFixed(2);

        const currentMemoryUsage = process.memoryUsage().rss;
        const currentMemoryUsed = Math.round(((currentMemoryUsage - firstMemoryUsage) / 1024 / 1024) * 100) / 100;

        const memorySize = this.memorySize();

        const ogmiosElapsed = getElapsedTime(elapsedOgmiosExec);
        const buildingElapsed = getElapsedTime(elapsedBuildingExec);

        const slotDate = new Date((1596491091 + (currentSlot - 4924800)) * 1000)

        return {
            percentageComplete,
            currentMemoryUsed,
            memorySize,
            ogmiosElapsed,
            buildingElapsed,
            slotDate,
            currentSlot,
            currentBlockHash
        };
    }

    static buildStorage() {
        // used to quickly build a large datastore
        Array.from(Array(1000000).keys()).forEach((number) => {
            const handle: IHandle = {
                hex: `hash-${number}`,
                name: `${number}`.padStart(8, 'a'),
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

            this.save(`hash-${number}`, handle);
        });
    }

    static saveFile(slot: number, hash: string) {
        const handles = {
            ...this.convertMapsToObjects(this.handles)
        };

        try {
            fs.writeFileSync(
                'storage/handles.json',
                JSON.stringify({
                    slot,
                    hash,
                    handles
                })
            );
        } catch (error: any) {
            Logger.log(`Error writing file: ${error.message}`, LogCategory.ERROR);
        }
    }

    static getFile(): string | null {
        try {
            return fs.readFileSync('handle-storage.json', { encoding: 'utf8' });
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                return null;
            }

            throw error;
        }
    }
}
