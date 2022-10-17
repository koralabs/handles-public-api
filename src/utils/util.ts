/**
 * @method isEmpty
 * @param {String | Number | Object} value
 * @returns {Boolean} true & false
 * @description this value is Empty Check
 */
export const isEmpty = (value: string | number | object): boolean => {
    if (value === null) {
        return true;
    } else if (typeof value !== 'number' && value === '') {
        return true;
    } else if (typeof value === 'undefined' || value === undefined) {
        return true;
    } else if (value !== null && typeof value === 'object' && !Object.keys(value).length) {
        return true;
    } else {
        return false;
    }
};

export const uuidv4 = () => {
    return `${1e7}-${1e3}-${4e3}-${8e3}-${1e11}`.replace(/[018]/g, (c) => {
        const char = parseInt(c);
        return (char ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (char / 4)))).toString(16);
    });
};

export const isNumeric = (n: string) => {
    return !isNaN(parseFloat(n)) && isFinite(parseFloat(n));
};

export const getMimeType = (filename: string) => {
    const extension = filename.split('.').slice(1).join('.');
    switch (extension) {
        case 'html':
            return 'text/html';
        case 'json':
        case 'js.map':
            return 'application/json';
        case 'js':
            return 'text/javascript';
        case 'css':
            return 'text/css';
        case 'png':
            return 'image/png';
        case 'jpeg':
            return 'image/jpeg';
        case 'gif':
            return 'image/gif';
        case 'yml':
            return 'application/x-yaml';
        default:
            return 'text/plain';
    }
};

export const getElapsedTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const mins = Math.floor(seconds / 60);
    return `${mins}:${(seconds - mins * 60).toString().padStart(2, '0')}`;
};

export const writeConsoleLine = (startTime: number, msg = ''): void => {
    const elapsed = getElapsedTime(Math.floor((new Date().getTime() - startTime) / 1000));
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(`${elapsed} elapsed. ${msg}`);
};