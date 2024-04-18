const subHandleSettings = {
    tierPricing: {
        '[all]': {
            ['0']: 'number',
            ['1']: 'number'
        }
    },
    creatorDefaults: {
        font: 'string',
        text_ribbon_gradient: 'string',
        qr_inner_eye: 'string',
        qr_outer_eye: 'string',
        qr_dot: 'string',
        bg_image: 'string'
    }
};

export const subHandleSettingsDatumSchema = {
    nft: subHandleSettings,
    virtual: {
        ...subHandleSettings,
        expires_in_days: 'number'
    },
    buy_down_paid: 'number'
};
