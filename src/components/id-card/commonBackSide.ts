export const COMMON_BACKSIDE_COLORS = {
    background: '#bce1e8',
    footer: '#0e5361',
    text: '#ffffff',
};

export const COMMON_BACKSIDE_CONTENT = {
    instituteLines: [
        'INSTITUTE FOR',
        'BANK | SSC | PSC &',
        'UPSC COACHING',
    ],
    addressLines: [
        'Savithri Building,',
        'Opp. Fathima Hospital',
        'Bank Road, Kozhikode - 673001',
    ],
};

export const getBackSideContactLines = (
    organizationAddress?: string | null,
    organizationPhone?: string | null
) => {
    const addressLines = String(organizationAddress || '')
        .split(/\r?\n|,/)
        .map((part) => part.trim())
        .filter(Boolean);

    if (addressLines.length === 0) {
        return COMMON_BACKSIDE_CONTENT.addressLines;
    }

    const phone = String(organizationPhone || '').trim();
    return phone ? [...addressLines, `Ph: ${phone}`] : addressLines;
};