import https from 'https';

export const requestIpfs = (
    url: string
): Promise<{
    statusCode?: number;
    cbor?: string;
    error?: string
}> => {
    return new Promise((resolve, reject) => {
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
                        statusCode: res.statusCode,
                        error: err.message
                    });
                });
                res.on('end', (chunk: any) => {
                    resolve({
                        statusCode: res.statusCode,
                        cbor: Buffer.concat(body).toString('hex')
                    });
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
