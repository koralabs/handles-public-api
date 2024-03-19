const subHandleSettings = {
    enabled: 'bool',
    tierPricing: {
        '[all]': {
            ['0']: 'number',
            ['1']: 'number'
        }
    },
    enablePz: 'bool',
    creatorDefaults: {
        font: 'string',
        text_ribbon_gradient: 'string',
        force_creator_settings: 'bool',
        qr_inner_eye: 'string',
        qr_outer_eye: 'string',
        qr_dot: 'string',
        bg_image: 'string'
    },
    creatorDefaultsBgImage: 'string'
};

export const subHandleSettingsDatumSchema = {
    nft: subHandleSettings,
    virtual: {
        ...subHandleSettings,
        expires_in_days: 'number'
    }
};
