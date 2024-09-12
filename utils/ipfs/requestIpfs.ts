import https from 'https';

export const requestIpfs = (
    url: string
): Promise<{
    statusCode?: number;
    cbor: string;
}> => {
    return new Promise((resolve, reject) => {
        const options: https.RequestOptions = {
            method: 'GET',
            headers: {
                Accept: 'application/octet-stream'
            }
        };

        const body: any = [];
        const post_req = https.request(url, options, (res) => {
            res.on('data', (chunk) => {
                body.push(chunk);
            });
            res.on('error', (err) => {
                reject(err);
            });
            res.on('end', (chunk: any) => {
                resolve({
                    statusCode: res.statusCode,
                    cbor: Buffer.concat(body).toString('hex')
                });
            });
        });
        post_req.end();
    });
};
