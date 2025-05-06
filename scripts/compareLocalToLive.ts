import { asyncForEach } from '@koralabs/kora-labs-common';
import http, { OutgoingHttpHeaders } from 'http';
import https from 'https';
const NETWORK = 'mainnet';

const apiRequest = (url: string): Promise<{ statusCode?: number; body?: string; error?: string, headers?: OutgoingHttpHeaders }> => {
    const client = url.startsWith('http:') ? http : https;
    return new Promise((resolve, reject) => {
        try {
            const options: https.RequestOptions = {
                method: 'GET',
                headers: { Accept: 'application/json'}
            };

            let body = '';
            const get_req = client.request(url, options, (res) => {
                res.on('data', (chunk) => { body += chunk; });
                res.on('error', (err) => {
                    resolve({
                        statusCode: res.statusCode,
                        error: err.message
                    });
                });
                res.on('end', (chunk: any) => {
                    resolve({
                        statusCode: res.statusCode,
                        body,
                        headers: res.headers
                    });
                });
            });
            get_req.end();
        }
        catch (error: any) {
            resolve({
                statusCode: 500,
                error: error.message
            });
        }
    });
};

(async () => {
    let localHandles: Map<string, any> = new Map<string, any>();
    let liveHandles: Map<string, any> = new Map<string, any>();
    const pageSize = 1000
    const totalPages = Math.ceil(parseInt((await apiRequest(`http://localhost:3141/handles?records_per_page=${pageSize}&page=1`)).headers!['x-handles-search-total']!.toString()) / pageSize);
    await asyncForEach([...Array(totalPages).keys()], async (i) => {
        console.log('Fetching page', i);
        const [local, live] = await Promise.all([
            apiRequest(`http://localhost:3141/handles?records_per_page=${pageSize}&page=${i}`),
            apiRequest(`https://${NETWORK == 'mainnet' ? '' : NETWORK + '.'}api.handle.me/handles?records_per_page=${pageSize}&page=${i}`)
        ])
        if (local.error || live.error) {
            console.error('ERROR', local.error, live.error);
            process.exit(1);
        }
        
        localHandles = new Map([...localHandles, ...new Map<string, any>(JSON.parse(local.body!).map(h => [h.name, h]))]);
        liveHandles = new Map([...liveHandles, ...new Map<string, any>(JSON.parse(live.body!).map(h => [h.name, h]))]);
    }, 1000)

    const localKeys = new Set(localHandles.keys());
    const liveKeys = new Set(liveHandles.keys());
    const bothKeys = new Set([...localKeys].filter(k => liveKeys.has(k)));

    const missingInLive = [...localKeys].filter(key => !liveKeys.has(key));
    const missingInLocal = [...liveKeys].filter(key => !localKeys.has(key));

    if (missingInLive.length > 0) {
        console.log('Missing in live:', missingInLive);
    }
    if (missingInLocal.length > 0) {
        console.log('Missing in local:', missingInLocal);
    }

    bothKeys.forEach(key => {
        const localHandle = localHandles.get(key);
        const liveHandle = liveHandles.get(key);

        if (localHandle.utxo !== liveHandle.utxo) {
            console.log(`UTxO mismatch for ${key}: ${localHandle.utxo} vs ${liveHandle.utxo}`);
        }
        if (localHandle.resolved_addresses.ada !== liveHandle.resolved_addresses.ada) {
            console.log(`Address mismatch for ${key}: ${localHandle.resolved_addresses.ada} vs ${liveHandle.resolved_addresses.ada}`);
        }
        // if (localHandle.default_in_wallet !== liveHandle.default_in_wallet) {
        //     console.log(`Default mismatch for ${key}: ${localHandle.default_in_wallet} vs ${liveHandle.default_in_wallet}`);
        // }
    });
})()