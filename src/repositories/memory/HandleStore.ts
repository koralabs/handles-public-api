import { IHandle, IHandleStats, IPersonalization } from '@koralabs/handles-public-api-interfaces';
import { LogCategory, Logger } from '@koralabs/kora-labs-common';
import fetch from 'cross-fetch';
import fs from 'fs';
import lockfile from 'proper-lockfile';
import { NETWORK, NODE_ENV } from '../../config';
import { buildCharacters, buildNumericModifiers, getRarity } from '../../services/ogmios/utils';
import { getDefaultHandle } from '../../utils/getDefaultHandle';
import { AddressDetails, getAddressHolderDetails } from '../../utils/addresses';
import { getDateStringFromSlot, getElapsedTime } from '../../utils/util';
import {
    IHandleFileContent,
    IHandleStoreMetrics,
    SaveMintingTxInput,
    SavePersonalizationInput,
    SaveWalletAddressMoveInput,
    HolderAddressIndex
} from './interfaces/handleStore.interfaces';
export class HandleStore {
    private static handles = new Map<string, IHandle>();
    static personalization = new Map<string, IPersonalization>();
    static holderAddressIndex = new Map<string, HolderAddressIndex>();
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

    static buildNetworkForNaming = () => {
        if (NETWORK === 'mainnet') {
            return '';
        }

        return `-${NETWORK}`;
    };

    static storageFolder = process.env.HANDLES_STORAGE || `${process.cwd()}/handles`;
    static storagePath = `${HandleStore.storageFolder}/handles${HandleStore.buildNetworkForNaming()}.json`;
    static storageSchemaVersion = 3;

    static get = (key: string): IHandle | null => {
        const handle = this.handles.get(key);
        if (!handle) {
            return null;
        }

        const holderAddressIndex = this.holderAddressIndex.get(handle.holder_address);
        if (holderAddressIndex) {
            handle.default_in_wallet = holderAddressIndex.defaultHandle;
        }

        return handle;
    };

    static getPersonalization = (key: string) => {
        return this.personalization.get(key);
    };

    static count = () => {
        return this.handles.size;
    };

    static getHandles = () => {
        const handles = Array.from(this.handles, ([_, value]) => ({ ...value } as IHandle));
        return handles.map((handle) => this.get(handle.hex) as IHandle);
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
        const updatedHandle = JSON.parse(JSON.stringify(handle));
        const {
            name,
            rarity,
            og,
            characters,
            numeric_modifiers,
            length,
            hex,
            resolved_addresses: { ada }
        } = updatedHandle;

        const holderAddressDetails = await getAddressHolderDetails(ada);
        updatedHandle.holder_address = holderAddressDetails.address;

        // Set the main index
        this.handles.set(hex, updatedHandle);

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

        // TODO: set default name during personalization
        this.setHolderAddressIndex(holderAddressDetails, hex);
    };

    static setHolderAddressIndex = async (
        holderAddressDetails: AddressDetails,
        newHex: string,
        defaultName?: string
    ) => {
        // first get all the handles for the stake key
        const { address: holderAddress, knownOwnerName, type } = holderAddressDetails;

        const initialHolderAddressDetails: HolderAddressIndex = {
            hexes: new Set(),
            defaultHandle: '',
            manuallySet: false,
            type,
            knownOwnerName
        };

        const existingHolderAddressDetails = this.holderAddressIndex.get(holderAddress) ?? initialHolderAddressDetails;

        // add the new hex to the set
        existingHolderAddressDetails.hexes.add(newHex);

        const handles = [...existingHolderAddressDetails.hexes].map((hex) => this.handles.get(hex) as IHandle);

        // get the default handle or use the defaultName provided (this is used during personalization)
        const defaultHandle = defaultName ?? getDefaultHandle(handles)?.name ?? '';

        this.holderAddressIndex.set(holderAddress, {
            ...existingHolderAddressDetails,
            defaultHandle,
            manuallySet: !!defaultName
        });
    };

    static buildHandle = ({
        hexName,
        name,
        adaAddress,
        og,
        image,
        slotNumber,
        background = '',
        default_in_wallet = '',
        profile_pic = ''
    }: SaveMintingTxInput): IHandle => {
        const newHandle: IHandle = {
            hex: hexName,
            name,
            holder_address: '', // Populate on save
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
            background,
            default_in_wallet,
            profile_pic,
            created_slot_number: slotNumber,
            updated_slot_number: slotNumber
        };

        return newHandle;
    };

    static saveMintedHandle = async (input: SaveMintingTxInput) => {
        const newHandle: IHandle = this.buildHandle(input);
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
        Array.from(Array(1000000).keys()).forEach(async (number) => {
            const hex = `hash-${number}`;
            const name = `${number}`.padStart(8, 'a');
            const image = 'QmUtUk9Yi2LafdaYRcYdSgTVMaaDewPXoxP9wc18MhHygW';

            const handle = this.buildHandle({
                hexName: hex,
                name,
                adaAddress:
                    'addr_test1qqrvwfds2vxvzagdrejjpwusas4j0k64qju5ul7hfnjl853lqpk6tq05pf67hwvmplvu0gc2xn75vvy3gyuxe6f7e5fsw0ever',
                image,
                og: 0,
                slotNumber: Date.now(),
                background: image,
                profile_pic: image
            });

            await this.save(handle);
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
            const localHandlesHasValidSchemaVersion = (localHandles?.schemaVersion ?? 0) >= this.storageSchemaVersion;
            let isNew = false;
            let handlesContent: IHandleFileContent | null;
            if (!externalHandles) {
                handlesContent = localHandlesHasValidSchemaVersion ? localHandles : null;
            } else if (!localHandles) {
                isNew = true;
                handlesContent = externalHandles;
            } else {
                if (
                    localHandles.slot > externalHandles.slot &&
                    (localHandles.schemaVersion ?? 0) >= (externalHandles.schemaVersion ?? 0)
                ) {
                    handlesContent = localHandlesHasValidSchemaVersion ? localHandles : null;
                } else {
                    isNew = true;
                    handlesContent = externalHandles;
                }
            }

            if (!handlesContent) {
                return null;
            }

            const { handles, slot, hash } = handlesContent;
            const keys = Object.keys(handles ?? {});
            for (let i = 0; i < keys.length; i++) {
                const hex = keys[i];
                const handle = handles[hex];
                const newHandle = {
                    ...handle
                };
                delete newHandle.personalization;
                await HandleStore.save(newHandle, handle.personalization);
            }

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
