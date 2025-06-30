import { asyncForEach } from '@koralabs/kora-labs-common';
import fs from 'fs';
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
    if (fs.existsSync('localHandles.json')) {
        localHandles = new Map<string, any>(JSON.parse(fs.readFileSync('localHandles.json').toString()));
        liveHandles = new Map<string, any>(JSON.parse(fs.readFileSync('liveHandles.json').toString()));
    } else {
        const pageSize = 1000
        const totalPages = Math.ceil(parseInt((await apiRequest(`http://localhost:3141/handles?records_per_page=${pageSize}&page=1`)).headers!['x-handles-search-total']!.toString()) / pageSize);
        await asyncForEach([...Array(totalPages).keys()], async (i) => {
            const [local, live] = await Promise.all([
                apiRequest(`http://localhost:3141/handles?records_per_page=${pageSize}&page=${i+1}`),
                apiRequest(`https://${NETWORK == 'mainnet' ? '' : NETWORK + '.'}api.handle.me/handles?records_per_page=${pageSize}&page=${i+1}`)
            ])
            console.log(`Page ${i+1} of ${totalPages} - Local: ${local.statusCode} - Live: ${live.statusCode}`);
            if (local.error || live.error) {
                console.error('ERROR', local.error, live.error);
                process.exit(1);
            }
            
            localHandles = new Map([...localHandles, ...new Map<string, any>(JSON.parse(local.body!).map(h => [h.name, h]))]);
            liveHandles = new Map([...liveHandles, ...new Map<string, any>(JSON.parse(live.body!).map(h => [h.name, h]))]);
        }, 1000);
        fs.writeFileSync('localHandles.json', JSON.stringify(Array.from(localHandles.entries())));
        fs.writeFileSync('liveHandles.json', JSON.stringify(Array.from(liveHandles.entries())));
    }

    const localKeys = new Set(localHandles.keys());
    const liveKeys = new Set(liveHandles.keys());
    const bothKeys = new Set([...localKeys].filter(k => liveKeys.has(k)));

    const missingInLive = [...localKeys].filter(key => !liveKeys.has(key));
    const missingInLocal = [...liveKeys].filter(key => !localKeys.has(key));

    const addressMismatches: Record<string, any> = {};
    const utxoMismatches: Record<string, any> = {};
    const holderMismatches: Record<string, any> = {};
    const defaultMismatches: Record<string, any> = {};
    bothKeys.forEach(key => {
        const localHandle = localHandles.get(key);
        const liveHandle = liveHandles.get(key);

        if (localHandle.utxo !== liveHandle.utxo) {
            utxoMismatches[key] = { utxo: {live: liveHandle.utxo, local: localHandle.utxo}};
        }
        if (localHandle.resolved_addresses.ada !== liveHandle.resolved_addresses.ada) {
            addressMismatches[key] = { resolved_address: {live: liveHandle.resolved_addresses.ada, local: localHandle.resolved_addresses.ada}};
        }
        if (localHandle.holder !== liveHandle.holder) {
            holderMismatches[key] = { holder: {live: liveHandle.holder, local: localHandle.holder}};
        }
        if (localHandle.default_in_wallet !== liveHandle.default_in_wallet) {
            defaultMismatches[key] = { default_in_wallet: {live: liveHandle.default_in_wallet, local: localHandle.default_in_wallet}};
        }
    });

    const mismatches: Record<string, any> = {};
    for (const map of [utxoMismatches, addressMismatches, holderMismatches, defaultMismatches]) {
      for (const [key, value] of Object.entries(map)) {
        mismatches[key] = { ...mismatches[key], ...value };
      }
    }
    
    console.log(`Missing in live: ${missingInLive.length ?? 0}\nMissing in local: ${missingInLocal.length ?? 0}`);
    console.log(`Address mismatches: ${Object.entries(addressMismatches).length ?? 0}`);
    console.log(`UTxO mismatches: ${Object.entries(utxoMismatches).length ?? 0}`);
    console.log(`Holder mismatches: ${Object.entries(holderMismatches).length ?? 0}`);
    console.log(`Default mismatches: ${Object.entries(defaultMismatches).length ?? 0}`);

    fs.writeFileSync('discrepancies.json', JSON.stringify({missingInLive, missingInLocal, mismatches}, null, 2));
})()