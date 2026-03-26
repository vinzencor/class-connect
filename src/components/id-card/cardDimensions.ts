// ISO/IEC 7810 ID-1 standard card size.
export const ID1_CARD_WIDTH_MM = 85.6;
export const ID1_CARD_HEIGHT_MM = 54;

// We render cards in portrait orientation in the UI while preserving the same ID-1 ratio.
export const PREVIEW_CARD_WIDTH_PX = 285;
export const PREVIEW_CARD_HEIGHT_PX = Math.round(
    PREVIEW_CARD_WIDTH_PX * (ID1_CARD_WIDTH_MM / ID1_CARD_HEIGHT_MM)
);
