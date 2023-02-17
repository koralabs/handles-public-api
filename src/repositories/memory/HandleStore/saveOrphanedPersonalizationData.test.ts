import { IPersonalization } from '@koralabs/handles-public-api-interfaces';
import { HandleStore } from '.';
import { MetadatumAssetLabel } from '../../../interfaces/ogmios.interfaces';

describe('saveOrphanedPersonalizationData tests', () => {
    afterEach(() => {
        jest.clearAllMocks();
        HandleStore.orphanedPersonalizationIndex.clear();
        HandleStore.slotHistoryIndex.clear();
    });

    it('should save to the orphanedPersonalizationIndex and create history', async () => {
        const hexName = 'orphaned-hex';
        const personalization: IPersonalization = {
            nft_appearance: {
                handleTextShadowColor: 'todo'
            }
        };

        HandleStore.saveOrphanedPersonalizationData({ hexName, personalization, slotNumber: 100 });

        expect(Array.from(HandleStore.orphanedPersonalizationIndex)).toEqual([[hexName, personalization]]);

        expect(Array.from(HandleStore.slotHistoryIndex)).toEqual([
            [100, { '000643b0orphaned-hex': { new: { name: undefined }, old: null } }]
        ]);
    });

    it('should find existing orphaned personalization and update it', async () => {
        const hexName = 'orphaned-hex2';
        const personalization: IPersonalization = {
            nft_appearance: {
                handleTextShadowColor: '#000'
            }
        };

        // set existing orphaned personalization
        HandleStore.orphanedPersonalizationIndex.set(hexName, { nft_appearance: { handleTextShadowColor: '#fff' } });

        // save new orphaned personalization
        HandleStore.saveOrphanedPersonalizationData({ hexName, personalization, slotNumber: 100 });

        // expect the new personalization to be saved
        expect(Array.from(HandleStore.orphanedPersonalizationIndex)).toEqual([[hexName, personalization]]);

        // expect the old value to be in the history
        expect(Array.from(HandleStore.slotHistoryIndex)).toEqual([
            [
                100,
                {
                    [`${MetadatumAssetLabel.REFERENCE_NFT}${hexName}`]: {
                        new: { personalization },
                        old: { personalization: { nft_appearance: { handleTextShadowColor: '#fff' } } }
                    }
                }
            ]
        ]);
    });
});
