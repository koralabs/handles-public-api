import { DefaultHandleInfo } from '@koralabs/kora-labs-common';

export const sortOGHandle = (handles: DefaultHandleInfo[]): DefaultHandleInfo | null => {
    // filter by OG
    const ogHandles = handles.filter((handle) => handle.og_number);
    if (ogHandles.length > 0) {
        // sort by the OG number
        ogHandles.sort((a, b) => a.og_number - b.og_number);
        return ogHandles[0];
    }

    return null;
};

export const sortedByLength = (handles: DefaultHandleInfo[]): DefaultHandleInfo[] => {
    const groupedHandles = handles.reduce<Record<string, DefaultHandleInfo[]>>((acc, handle) => {
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

export const sortByCreatedSlotNumber = (handles: DefaultHandleInfo[]): DefaultHandleInfo[] => {
    // group handles by updated_slot_number
    const groupedHandles = handles.reduce<Record<string, DefaultHandleInfo[]>>((acc, handle) => {
        const createdSlotNumber = handle.created_slot_number;
        if (!acc[createdSlotNumber]) {
            acc[createdSlotNumber] = [];
        }
        acc[createdSlotNumber].push(handle);
        return acc;
    }, {});

    // sort grouped handles by updated_slot_number key
    const groupedHandleKeys = Object.keys(groupedHandles);
    groupedHandleKeys.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
    const [firstKey] = groupedHandleKeys;
    return groupedHandles[firstKey] ?? [];
};

export const sortAlphabetically = (handles: DefaultHandleInfo[]): DefaultHandleInfo => {
    const sortedHandles = [...handles];
    sortedHandles.sort((a, b) => a.name.localeCompare(b.name));
    return sortedHandles[0];
};

