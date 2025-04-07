import { Holder, ISlotHistory, StoredHandle } from '@koralabs/kora-labs-common';

export class HandleStore {
    public static handles = new Map<string, StoredHandle>();
    public static slotHistoryIndex = new Map<number, ISlotHistory>();
    public static holderIndex = new Map<string, Holder>();
    public static subHandlesIndex = new Map<string, Set<string>>();
    public static rarityIndex = new Map<string, Set<string>>();
    public static ogIndex = new Map<string, Set<string>>();
    public static charactersIndex = new Map<string, Set<string>>();
    public static paymentKeyHashesIndex = new Map<string, Set<string>>();
    public static hashOfStakeKeyHashIndex = new Map<string, Set<string>>();
    public static addressesIndex = new Map<string, Set<string>>();
    public static numericModifiersIndex = new Map<string, Set<string>>();
    public static lengthIndex = new Map<string, Set<string>>();
}