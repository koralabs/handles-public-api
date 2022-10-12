import http from 'http';
import fs from 'fs';
import url from 'url';

const requestListener = function (req, res) {
    let path = url.parse(req.url).pathname;
    let file = path.substring(path.lastIndexOf('/')+1);
    if (!path.startsWith('/swagger') && !path.startsWith('/health')) {
        res.writeHead(404);
        res.end('404: Not Found');
    }
    if (path.startsWith('/health')) {
        http.get('http://127.0.0.1:1337/health', healthRes => {
            let str = '';
            healthRes.on('data', function (chunk) {
              str += chunk;
            });
            healthRes.on('end', function () {
                res.writeHead(200);
                res.write(str);
                res.end();
            });
        }).on('error', err => {
            res.writeHead(503);
            res.write(`503 - Ogmios Not Running - ${err}`);
            res.end();
        });
        return;
    }
    if (path === '/swagger') {
        path += '/index.html';
        file = 'index.html';
    }
    fs.readFile(path.replace('/swagger/','/docs/').substr(1), (err, data) => {
        if (err) {
           console.error(err);
           res.writeHead(404);
           res.write('404: Not Found');
        } else {
           res.writeHead(200, { 'Content-Type': getMimeType(file) });
           res.write(data.toString());
        }
        res.end();
        return;
     });
}

const getMimeType = (filename) => {
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

}

const server = http.createServer(requestListener);
server.listen(3141);
