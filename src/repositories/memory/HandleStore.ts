import { IHandle, IHandleStats, IPersonalization } from '@koralabs/handles-public-api-interfaces';
import { LogCategory, Logger } from '@koralabs/logger';
import fetch from 'cross-fetch';
import fs from 'fs';
import lockfile from 'proper-lockfile';
import { NETWORK, NODE_ENV } from '../../config';
import { buildCharacters, buildNumericModifiers, getRarity } from '../../services/ogmios/utils';
import { getAddressStakeKey } from '../../utils/serialization';
import { getDateStringFromSlot, getElapsedTime } from '../../utils/util';
import {
    IHandleFileContent,
    IHandleStoreMetrics,
    SaveMintingTxInput,
    SavePersonalizationInput,
    SaveWalletAddressMoveInput
} from './interfaces/handleStore.interfaces';
export class HandleStore {
    static handles = new Map<string, IHandle>();
    static personalization = new Map<string, IPersonalization>();
    static nameIndex = new Map<string, string>();
    static rarityIndex = new Map<string, Set<string>>();
    static ogIndex = new Map<string, Set<string>>();
    static charactersIndex = new Map<string, Set<string>>();
    static numericModifiersIndex = new Map<string, Set<string>>();
    static lengthIndex = new Map<string, Set<string>>();
    static stakeKeyIndex = new Map<string, Set<string>>();
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

    static buildNetworkForNaming = () => {
        if (NETWORK === 'mainnet') {
            return '';
        }

        return `-${NETWORK}`;
    };

    static storagePath = `${process.cwd()}/handles/handles${HandleStore.buildNetworkForNaming()}.json`;
    static storageSchemaVersion = 2;

    static get = (key: string) => {
        return this.handles.get(key);
    };

    static getPersonalization = (key: string) => {
        return this.personalization.get(key);
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

    static save = async (handle: IHandle, personalization?: IPersonalization) => {
        const {
            name,
            rarity,
            og,
            characters,
            numeric_modifiers,
            length,
            hex,
            resolved_addresses: { ada }
        } = handle;

        // Set the main index
        this.handles.set(hex, handle);

        // set the personalization index
        if (personalization) {
            this.personalization.set(hex, personalization);
        }

        // set all one-to-one indexes
        this.nameIndex.set(name, hex);

        // set all one-to-many indexes
        this.addIndexSet(this.rarityIndex, rarity, hex);
        this.addIndexSet(this.ogIndex, `${og}`, hex);
        this.addIndexSet(this.charactersIndex, characters, hex);
        this.addIndexSet(this.numericModifiersIndex, numeric_modifiers, hex);
        this.addIndexSet(this.lengthIndex, `${length}`, hex);

        const stakeKey = await getAddressStakeKey(ada);
        if (stakeKey) {
            this.addIndexSet(this.stakeKeyIndex, stakeKey, hex);
        }
    };

    static saveMintedHandle = async ({ hexName, name, adaAddress, og, image, slotNumber }: SaveMintingTxInput) => {
        const newHandle: IHandle = {
            hex: hexName,
            name,
            length: name.length,
            rarity: getRarity(name),
            characters: buildCharacters(name),
            numeric_modifiers: buildNumericModifiers(name),
            resolved_addresses: {
                ada: adaAddress
            },
            og,
            original_nft_image: image,
            nft_image: image,
            background: '',
            default_in_wallet: '',
            profile_pic: '',
            created_slot_number: slotNumber,
            updated_slot_number: slotNumber
        };

        await this.save(newHandle);
    };

    static saveWalletAddressMove = async ({ hexName, adaAddress, slotNumber }: SaveWalletAddressMoveInput) => {
        const existingHandle = HandleStore.get(hexName);
        if (!existingHandle) {
            Logger.log({
                message: `Wallet moved, but there is no existing handle in storage with hex: ${hexName}`,
                category: LogCategory.ERROR,
                event: 'saveWalletAddressMove.noHandleFound'
            });
            return;
        }

        existingHandle.resolved_addresses.ada = adaAddress;
        existingHandle.updated_slot_number = slotNumber;
        await HandleStore.save(existingHandle);
    };

    static async savePersonalizationChange({
        hexName,
        personalization,
        addresses,
        slotNumber
    }: SavePersonalizationInput) {
        const existingHandle = HandleStore.get(hexName);
        if (!existingHandle) {
            Logger.log({
                message: `Wallet moved, but there is no existing handle in storage with hex: ${hexName}`,
                category: LogCategory.ERROR,
                event: 'saveWalletAddressMove.noHandleFound'
            });
            return;
        }

        if (personalization) {
            const { nft_appearance } = personalization;
            existingHandle.nft_image = nft_appearance?.image ?? '';
            existingHandle.background = nft_appearance?.background ?? '';
            existingHandle.profile_pic = nft_appearance?.profilePic ?? '';
            existingHandle.default_in_wallet = ''; // TODO: figure out how this is updated
            existingHandle.updated_slot_number = slotNumber;
        }

        // update resolved addresses
        // remove ada from the new addresses.
        if (addresses.ada) {
            delete addresses.ada;
        }

        // set ADA and replace
        existingHandle.resolved_addresses = {
            ada: existingHandle.resolved_addresses.ada,
            ...addresses
        };

        await HandleStore.save(existingHandle, personalization);
    }

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

        const slotDate = getDateStringFromSlot(currentSlot);

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

    static isCaughtUp(): boolean {
        const { firstSlot = 0, lastSlot = 0, currentSlot = 0 } = this.metrics;
        const handleSlotRange = lastSlot - firstSlot;
        const currentSlotInRange = currentSlot - firstSlot;
        const percentageComplete =
            currentSlot === 0 ? '0.00' : ((currentSlotInRange / handleSlotRange) * 100).toFixed(2);

        const slotDate = getDateStringFromSlot(currentSlot);

        const date = slotDate.getTime();
        const now = new Date().getTime();

        return date < now - 60000 && percentageComplete != `100.00`;
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
                default_in_wallet: 'hdl',
                background: 'QmUtUk9Yi2LafdaYRcYdSgTVMaaDewPXoxP9wc18MhHygW',
                profile_pic: 'QmUtUk9Yi2LafdaYRcYdSgTVMaaDewPXoxP9wc18MhHygW',
                created_slot_number: Date.now(),
                updated_slot_number: Date.now()
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
            Logger.log({
                message: `Error writing file: ${error.message}`,
                event: 'saveFile.errorSavingFile',
                category: LogCategory.ERROR
            });
            return false;
        }
    }

    static checkIfExists(path: string): boolean {
        try {
            const exists = fs.statSync(path);
            if (exists) {
                return true;
            }

            return false;
        } catch (error) {
            return false;
        }
    }

    static async getFile(storagePath?: string): Promise<IHandleFileContent | null> {
        const path = NODE_ENV === 'local' ? 'storage/local.json' : storagePath ?? this.storagePath;

        try {
            const exists = this.checkIfExists(path);
            if (!exists) {
                Logger.log({
                    message: `${path} file does not exist`,
                    category: LogCategory.INFO,
                    event: 'HandleStore.getFile.doesNotExist'
                });
                return null;
            }

            const isLocked = await lockfile.check(path);
            if (isLocked) {
                Logger.log({
                    message: `${path} file is locked`,
                    category: LogCategory.INFO,
                    event: 'HandleStore.getFile.locked'
                });
                return null;
            }

            const file = fs.readFileSync(path, { encoding: 'utf8' });
            Logger.log({
                message: `${path} found`,
                category: LogCategory.INFO,
                event: 'HandleStore.getFile.fileFound'
            });

            return JSON.parse(file) as IHandleFileContent;
        } catch (error: any) {
            Logger.log(`Error getting file from ${path} with error: ${error.message}`);
            return null;
        }
    }

    static async getFileOnline(): Promise<IHandleFileContent | null> {
        if (NODE_ENV === 'local') {
            return null;
        }

        try {
            const fileName = `handles${HandleStore.buildNetworkForNaming()}.json`;
            const url = `http://api.handle.me.s3-website-us-west-2.amazonaws.com/${this.storageSchemaVersion}/${fileName}`;
            Logger.log(`Fetching ${url}`);
            const awsResponse = await fetch(url);
            if (awsResponse.status === 200) {
                const text = await awsResponse.text();
                Logger.log(`Found ${url}`);
                return JSON.parse(text) as IHandleFileContent;
            }

            Logger.log(`Unable to find ${url} online`);
            return null;
        } catch (error: any) {
            Logger.log(`Error fetching file from online with error: ${error.message}`);
            return null;
        }
    }

    static async prepareHandlesStorage(): Promise<IHandleFileContent | null> {
        const [externalHandles, localHandles] = await Promise.all([HandleStore.getFileOnline(), HandleStore.getFile()]);

        if (externalHandles || localHandles) {
            let isNew = false;
            let handlesContent: IHandleFileContent | null;
            if (!externalHandles) {
                handlesContent = localHandles;
            } else if (!localHandles) {
                isNew = true;
                handlesContent = externalHandles;
            } else {
                if (
                    localHandles.slot > externalHandles.slot &&
                    (localHandles.schemaVersion ?? 0) >= (externalHandles.schemaVersion ?? 0)
                ) {
                    handlesContent = localHandles;
                } else {
                    isNew = true;
                    handlesContent = externalHandles;
                }
            }

            if (!handlesContent) {
                return null;
            }

            const { handles, slot, hash } = handlesContent;
            Object.keys(handles ?? {}).forEach(async (k) => {
                const handle = handles[k];
                const newHandle = {
                    ...handle
                };
                delete newHandle.personalization;
                await HandleStore.save(newHandle, handle.personalization);
            });

            Logger.log(
                `Handle storage found at slot: ${slot} and hash: ${hash} with ${
                    Object.keys(handles ?? {}).length
                } handles`
            );

            if (isNew) {
                await HandleStore.saveFile(slot, hash);
            }

            return handlesContent;
        }

        return null;
    }
}
