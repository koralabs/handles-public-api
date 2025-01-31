import { delay } from '@koralabs/kora-labs-common';
import fs from 'fs';
import { createServer } from 'http';

let sleepSeconds = 0;
setInterval(async () => {await delay(500)}, 1000);
setInterval(() => {sleepSeconds++}, 1000);

const server = createServer(async (req, res) => {
    if (req.url === '/') {
        res.end(`${sleepSeconds}`);
    }
});

server.listen(3000, () => console.log('Server running on http://localhost:3000'));

const loadFile = async () => {
    fs.readFileSync('/dev/urandom');
}

await loadFile();