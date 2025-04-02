import { StoredHandle } from '@koralabs/kora-labs-common';

export const sortOGHandle = (handles: StoredHandle[]): StoredHandle | null => {
    // filter by OG
    const ogHandles = handles.filter((handle) => handle.og_number);
    if (ogHandles.length > 0) {
        // sort by the OG number
        ogHandles.sort((a, b) => a.og_number - b.og_number);
        return ogHandles[0];
    }

    return null;
};

export const sortedByLength = (handles: StoredHandle[]): StoredHandle[] => {
    const groupedHandles = handles.reduce<Record<string, StoredHandle[]>>((acc, handle) => {
        const length = handle.name.length;
        if (!acc[length]) {
            acc[length] = [];
        }
        acc[length].push(handle);
        return acc;
    }, {});

    // sort grouped handles by updated_slot_number key
    const groupedHandleKeys = Object.keys(groupedHandles);
    groupedHandleKeys.sort((a, b) => parseInt(a) - parseInt(b));
    const [firstKey] = groupedHandleKeys;
    return groupedHandles[firstKey] ?? [];
};

export const sortByUpdatedSlotNumber = (handles: StoredHandle[]): StoredHandle[] => {
    // group handles by updated_slot_number
    const groupedHandles = handles.reduce<Record<string, StoredHandle[]>>((acc, handle) => {
        const updatedSlotNumber = handle.updated_slot_number;
        if (!acc[updatedSlotNumber]) {
            acc[updatedSlotNumber] = [];
        }
        acc[updatedSlotNumber].push(handle);
        return acc;
    }, {});

    // sort grouped handles by updated_slot_number key
    const groupedHandleKeys = Object.keys(groupedHandles);
    groupedHandleKeys.sort((a, b) => parseInt(b, 10) - parseInt(a, 10));
    const [firstKey] = groupedHandleKeys;
    return groupedHandles[firstKey] ?? [];
};

export const sortAlphabetically = (handles: StoredHandle[]): StoredHandle => {
    const sortedHandles = [...handles];
    sortedHandles.sort((a, b) => a.name.localeCompare(b.name));
    return sortedHandles[0];
};

