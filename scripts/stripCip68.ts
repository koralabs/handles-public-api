import * as fs from 'fs';

// Load and parse JSON data
const rawData = fs.readFileSync('../handles/mainnet/snapshot/handles.json', 'utf-8');
const data = JSON.parse(rawData);

const handles = Object.keys(data.handles);
// Filter out records where 'hex' starts with '0'
handles.forEach((key) => {
    if (
        data.handles[key].hex.startsWith('000de140') 
        || data.handles[key].hex.startsWith('00000000')
        || data.handles[key].created_slot_number >= 97958246
        || data.handles[key].updated_slot_number >= 97958246) {
        delete data.handles[key];
    }
    
})

// Save the filtered data back to a new file (or overwrite original)
fs.writeFileSync('../handles/mainnet/snapshot/handles.json', JSON.stringify(data), 'utf-8');