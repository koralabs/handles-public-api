import { Metadatum, Transaction } from '@cardano-ogmios/schema';
import { fetch } from 'cross-fetch';

const NETWORK = 'mainnet';

const koiosSettings = {_inputs: false, _withdrawals: false, _certs: false, _scripts: true, _bytecode: true, _governance: false, _metadata: true, _assets: true}

const blockfrostApiCall = async (endpointSegment: string) => {
    const headers = {
        project_id: process.env.BLOCKFROST_API_KEY ?? '',
        'Content-Type': 'application/json'
    };

    const url = `https://cardano-${NETWORK.toLowerCase()}.blockfrost.io/api/v0/${endpointSegment}`;
    return await fetch(url, {headers})
};

const fetchKoios = async(path: string, method = 'GET', body?: string) => {
    const url = `https://${NETWORK.toLowerCase() === 'mainnet' ? 'api' : NETWORK.toLowerCase()}.koios.rest/api/v1/${path}`;
    console.log('BODY', body, process.env.KOIOS_API_BEARER_TOKEN)
    const res = await fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.KOIOS_API_BEARER_TOKEN}`
        },
        body
    });

    return res;
}
// - Get blocks fom Blockfrost
// const bResp: {hash: string, slot: number}[] = await (await blockfrostApiCall(`blocks/08ddc47812efa93fc950fb825f02f17221160faae8621de2ba3ddb22323a923b/next`)).json()

// for (const b of bResp) {
    const block = {id: "0".repeat(64), slot: 123456789, transactions: [] as Transaction[]}
    //const _tx_hashes = await (await blockfrostApiCall(`blocks/${b.hash}/txs`)).json()
    const _tx_hashes = ['fe40d980c3105c956c2cf29567966b6cafcab0e150e856ec6d4969a4d08aa353']
    const txList: any[] = await (await fetchKoios(`tx_info`, 'POST', JSON.stringify({_tx_hashes, ...koiosSettings}))).json()
    
    for (const t of txList) {
        // - Convert to format that processBlock expects
        const tx: Transaction = {
            mint: t.assets_minted.reduce((acc: any, a: any) => {
                (acc[a.policy_id] ??= {})[a.asset_name] = BigInt(a.quantity);
                return acc;
            }, {}),
            id: t.tx_hash,
            spends: 'inputs',
            inputs: [],
            outputs: t.outputs.map((o: any) => { return {
                address: o.payment_addr.bech32,
                value: {
                    ada: {lovelace: BigInt(o.value)},
                    ...o.asset_list?.reduce((acc: any, a: any) => {
                        (acc[a.policy_id] ??= {})[a.asset_name] = BigInt(a.quantity);
                        return acc;
                    }, {})
                },
                datum: o.inline_datum?.bytes,
                script: o.reference_script ?? undefined
            }}),
            signatories: [],
            metadata: {hash:'', labels: Object.fromEntries(Object.entries(t.metadata).map(([label, value]) => [label, { json: value as Metadatum }]))}
        }
        block.transactions.push(tx);
        console.log('BLOCK', JSON.stringify(block, ( _, value) => typeof value == 'bigint' ? Number(value.toString()) : value, 4))
    }
//}