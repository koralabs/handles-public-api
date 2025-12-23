import https from 'https';

export const requestIpfs = (
    url: string
): Promise<{
    statusCode?: number;
    cbor?: string;
    error?: string
}> => {
    return new Promise((resolve) => {
        try {
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
                    resolve({
                        statusCode: 500,
                        error: err.message
                    });
                });
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        cbor: Buffer.concat(body).toString('hex')
                    });
                });
            }).on('error', (err) => {
                resolve({
                    statusCode: 500,
                    error: err.message
                });
            });
            post_req.end();
        }
        catch (error: any) {
            resolve({
                statusCode: 500,
                error: error.message
            });
        }
    });
};
