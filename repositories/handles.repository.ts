import { IHandleStats, IUTxO } from '@koralabs/kora-labs-common';
import { HolderAddressDetailsResponse } from '../interfaces/handle.interface';
import { HandlePaginationModel } from '../models/handlePagination.model';
import { HandleSearchModel } from '../models/HandleSearch.model';
import { HolderPaginationModel } from '../models/holderPagination.model';
import { IHandleStoreMetrics, SaveMintingTxInput, SavePersonalizationInput, SaveSubHandleSettingsInput, SaveWalletAddressMoveInput, StoredHandle } from '../interfaces/handleStore.interfaces';

interface IHandlesRepository {
    initialize: () => Promise<IHandlesRepository>;
    getAll: (params: { pagination: HandlePaginationModel; search: HandleSearchModel }) => Promise<{ searchTotal: number; handles: StoredHandle[] }>;
    getHandlesByPaymentKeyHashes: (hashes: string[]) => string[];
    getHandlesByAddresses: (addresses: string[]) => string[];
    getHandlesByHolderAddresses: (addresses: string[]) => string[];
    getAllHandleNames: (search: HandleSearchModel, sort: string) => Promise<string[]>;
    getHandleByName: (handleName: string) => Promise<StoredHandle | null>;
    getHandleByHex: (handleHex: string) => Promise<StoredHandle | null>;
    getHolderAddressDetails: (key: string) => Promise<HolderAddressDetailsResponse>;
    getAllHolders: (params: { pagination: HolderPaginationModel }) => Promise<HolderAddressDetailsResponse[]>;
    getHandleStats: () => IHandleStats;
    getTotalHandlesStats: () => { total_handles: number; total_holders: number };
    currentHttpStatus: () => number;
    getHandleDatumByName: (handleName: string) => Promise<string | null>;
    getSubHandleSettings: (handleName: string) => Promise<{ settings?: string; utxo: IUTxO } | null>;
    getSubHandles: (handleName: string) => Promise<StoredHandle[]>;
    getTimeMetrics: () => { elapsedOgmiosExec: number; elapsedBuildingExec: number };
    setMetrics: (metrics: IHandleStoreMetrics) => void;
    getMetrics: () => IHandleStats;
    prepareHandlesStorage: (loadS3: boolean) => Promise<{ slot: number; hash: string } | null>;
    rollBackToGenesis: () => Promise<void>;
    isCaughtUp: () => boolean;
    burnHandle: (handleName: string, slotNumber: number) => Promise<void>;
    rewindChangesToSlot: ({ slot, hash, lastSlot }: { slot: number; hash: string; lastSlot: number }) => Promise<{ name: string; action: string; handle: Partial<StoredHandle> | undefined }[]>;
    savePersonalizationChange: ({ name, hex, personalization, reference_token, personalizationDatum, slotNumber, metadata }: SavePersonalizationInput) => Promise<void>;
    saveSubHandleSettingsChange: ({ name, settingsDatum, utxoDetails, slotNumber }: SaveSubHandleSettingsInput) => Promise<void>;
    saveMintedHandle: (input: SaveMintingTxInput) => Promise<void>;
    saveHandleUpdate: ({ name, adaAddress, utxo, slotNumber, datum, script }: SaveWalletAddressMoveInput) => Promise<void>;
    destroy: () => void;
}

export default IHandlesRepository;
