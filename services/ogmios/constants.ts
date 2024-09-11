import { Point } from '@cardano-ogmios/schema';

export interface EraBoundaries {
    [network: string]: Point;
}

export const handleEraBoundaries: EraBoundaries = {
    mainnet: {
        slot: 47931333,
        id: '847543d30b99cbb288bee3064f83ff50140cf944ce60fa5d356f27611e94b1f0'
    },
    testnet: {
        slot: 42971872,
        id: 'b5b276cb389ee36e624c66c632b0e983027609e7390fa7072a222261077117d6'
    },
    preprod: {
        slot: 0, //19783872,
        id: '' //'46a069ecc79659fcfc98e03e31bd29ee7f05b88623cc606d8b9658d804728842'
    },
    preview: {
        slot: 0, // 1470391,
        id: '' // '56ace254a1474adc08d301a23884d6b3bc670e2208859abbf7e8adc010d8f8de'
    }
};