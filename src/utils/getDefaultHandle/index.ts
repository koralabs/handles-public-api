import { IHandle } from '@koralabs/handles-public-api-interfaces';

const sortOGHandle = (handles: IHandle[]): IHandle | null => {
    // filter by OG
    const ogHandles = handles.filter((handle) => handle.og_number);
    if (ogHandles.length > 0) {
        // sort by the OG number
        ogHandles.sort((a, b) => a.og_number - b.og_number);
        return ogHandles[0];
    }

    return null;
};

const sortedByLength = (handles: IHandle[]): IHandle[] => {
    const groupedHandles = handles.reduce<Record<string, IHandle[]>>((acc, handle) => {
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

const sortByUpdatedSlotNumber = (handles: IHandle[]): IHandle[] => {
    // group handles by updated_slot_number
    const groupedHandles = handles.reduce<Record<string, IHandle[]>>((acc, handle) => {
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

const sortAlphabetically = (handles: IHandle[]): IHandle => {
    const sortedHandles = [...handles];
    sortedHandles.sort((a, b) => a.name.localeCompare(b.name));
    return sortedHandles[0];
};

export const getDefaultHandle = (handles: IHandle[]): IHandle => {
    // OG if no default set
    const ogHandle = sortOGHandle(handles);
    if (ogHandle) return ogHandle;

    // filter shortest length from handles
    const sortedHandlesByLength = sortedByLength(handles);
    if (sortedHandlesByLength.length == 1) sortedHandlesByLength[0];

    //Latest slot number if same length
    const sortedHandlesBySlot = sortByUpdatedSlotNumber(sortedHandlesByLength);
    if (sortedHandlesBySlot.length == 1) sortedHandlesBySlot[0];

    //Alphabetical if minted same time
    return sortAlphabetically(sortedHandlesBySlot);
};
