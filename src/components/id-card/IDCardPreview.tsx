import React, { useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { Tables } from '@/types/database';
import { TemplateDesignData } from '@/services/idCardService';
import { Nfc } from 'lucide-react';
import { PREVIEW_CARD_HEIGHT_PX, PREVIEW_CARD_WIDTH_PX } from './cardDimensions';
import { COMMON_BACKSIDE_COLORS, COMMON_BACKSIDE_CONTENT, getBackSideContactLines } from './commonBackSide';

type Profile = Tables<'profiles'>;
type IdCard = Tables<'id_cards'>;

interface IDCardPreviewProps {
    id?: string;
    user: Profile;
    card?: IdCard;
    template: TemplateDesignData;
    organizationName?: string;
    organizationLogo?: string;
    organizationWebsite?: string;
    organizationAddress?: string;
    organizationPhone?: string;
    designationName?: string;
    roleName?: string | null;
    scale?: number;
    photoUrl?: string | null;
    bloodGroup?: string | null;
    side?: 'front' | 'back';
}

export interface IDCardPreviewRef {
    getCanvas: () => HTMLCanvasElement | null;
}

// Portrait render preserving ISO ID-1 ratio (85.60 x 54.00 mm)
const CARD_WIDTH = PREVIEW_CARD_WIDTH_PX;
const CARD_HEIGHT = PREVIEW_CARD_HEIGHT_PX;

// Photo dimensions kept proportional to the original design.
const PHOTO_WIDTH = Math.round(CARD_WIDTH * (100 / 240));
const PHOTO_HEIGHT = Math.round(CARD_HEIGHT * (133 / 360));
const COMMON_BACK_DIVIDER_WIDTH = CARD_WIDTH * 0.8;

const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const sanitizeColor = (value: string | undefined, fallback: string): string => {
    if (!value) return fallback;
    const normalized = value.trim();
    return HEX_COLOR_REGEX.test(normalized) ? normalized : fallback;
};

const truncateToWidth = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
): string => {
    if (ctx.measureText(text).width <= maxWidth) {
        return text;
    }

    let output = text;
    while (output.length > 0 && ctx.measureText(`${output}...`).width > maxWidth) {
        output = output.slice(0, -1);
    }

    return output ? `${output}...` : '';
};

export const IDCardPreview = forwardRef<IDCardPreviewRef, IDCardPreviewProps>(
    ({ id, user, card, template, organizationName, organizationLogo, organizationWebsite, organizationAddress, organizationPhone, designationName, roleName, scale = 1, photoUrl, bloodGroup, side = 'front' }, ref) => {
        const canvasRef = useRef<HTMLCanvasElement>(null);
        const [photoLoaded, setPhotoLoaded] = useState(false);
        const [logoLoaded, setLogoLoaded] = useState(false);
        const photoImgRef = useRef<HTMLImageElement | null>(null);
        const logoImgRef = useRef<HTMLImageElement | null>(null);

        useImperativeHandle(ref, () => ({
            getCanvas: () => canvasRef.current,
        }));

        // Load user photo
        React.useEffect(() => {
            const avatarUrl = user.avatar_url || photoUrl;
            if (avatarUrl) {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => { photoImgRef.current = img; setPhotoLoaded(true); };
                img.onerror = () => { photoImgRef.current = null; setPhotoLoaded(false); };
                img.src = avatarUrl;
            } else {
                photoImgRef.current = null;
                setPhotoLoaded(false);
            }
        }, [user.avatar_url, photoUrl]);

        // Load organization logo
        React.useEffect(() => {
            if (organizationLogo) {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => { logoImgRef.current = img; setLogoLoaded(true); };
                img.onerror = () => { logoImgRef.current = null; setLogoLoaded(false); };
                img.src = organizationLogo;
            } else {
                logoImgRef.current = null;
                setLogoLoaded(false);
            }
        }, [organizationLogo]);

        const showLogo = template.showLogo ?? true;
        const showPhoto = template.showPhoto ?? true;
        const backSideContactLines = getBackSideContactLines(organizationAddress, organizationPhone);

        // Colors from template, with safe fallbacks for malformed values.
        const CARD_BG = sanitizeColor(template.backgroundColor, '#FFFFFF');
        const TEXT_COLOR = sanitizeColor(template.textColor, '#1a1a1a');
        const ACCENT_COLOR = sanitizeColor(template.accentColor, '#4F7F8C');
        const WHITE = '#ffffff';

        const drawFrontSide = (ctx: CanvasRenderingContext2D) => {
            // White background with rounded corners
            ctx.fillStyle = CARD_BG;
            ctx.beginPath();
            ctx.roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 12);
            ctx.fill();
            ctx.clip();

            // --- Organization Logo ---
            let currentY = 60;
            if (showLogo && logoImgRef.current) {
                const logo = logoImgRef.current;
                const maxLogoH = 40;
                const maxLogoW = 160;
                const logoRatio = logo.width / logo.height;
                let lw = maxLogoH * logoRatio;
                let lh = maxLogoH;
                if (lw > maxLogoW) { lw = maxLogoW; lh = lw / logoRatio; }
                const lx = (CARD_WIDTH - lw) / 2;
                ctx.drawImage(logo, lx, currentY - lh / 2, lw, lh);
                currentY += lh / 2 + 12;
            } else if (organizationName) {
                // Fallback: draw text
                ctx.fillStyle = TEXT_COLOR;
                ctx.font = 'bold 13px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(organizationName.toUpperCase(), CARD_WIDTH / 2, currentY + 6);
                ctx.textAlign = 'left';
                currentY += 20;
            }

            // --- Organization Name (bold uppercase) ---
            if (organizationName && showLogo && logoImgRef.current) {
                currentY += 4;
                ctx.fillStyle = TEXT_COLOR;
                ctx.font = 'bold 11px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(organizationName.toUpperCase(), CARD_WIDTH / 2, currentY);
                ctx.textAlign = 'left';
                currentY += 14;
            } else {
                currentY += 6;
            }

            // --- Photo with teal border ---
            const photoX = (CARD_WIDTH - PHOTO_WIDTH) / 2;
            const photoY = currentY + 4;
            const photoBorderPad = 3;

            if (showPhoto) {
                ctx.strokeStyle = ACCENT_COLOR;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.roundRect(
                    photoX - photoBorderPad,
                    photoY - photoBorderPad,
                    PHOTO_WIDTH + photoBorderPad * 2,
                    PHOTO_HEIGHT + photoBorderPad * 2,
                    8
                );
                ctx.stroke();

                // Draw photo (or fallback initials) only when photo section is enabled.
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(photoX, photoY, PHOTO_WIDTH, PHOTO_HEIGHT, 6);
                ctx.clip();

                if (photoImgRef.current) {
                    const img = photoImgRef.current;
                    const imgRatio = img.width / img.height;
                    const boxRatio = PHOTO_WIDTH / PHOTO_HEIGHT;
                    let sx = 0;
                    let sy = 0;
                    let sw = img.width;
                    let sh = img.height;
                    if (imgRatio > boxRatio) {
                        sw = img.height * boxRatio;
                        sx = (img.width - sw) / 2;
                    } else {
                        sh = img.width / boxRatio;
                        sy = (img.height - sh) / 2;
                    }
                    ctx.drawImage(img, sx, sy, sw, sh, photoX, photoY, PHOTO_WIDTH, PHOTO_HEIGHT);
                } else {
                    ctx.fillStyle = '#e5e7eb';
                    ctx.fillRect(photoX, photoY, PHOTO_WIDTH, PHOTO_HEIGHT);
                    ctx.fillStyle = ACCENT_COLOR;
                    ctx.font = 'bold 32px Inter, sans-serif';
                    ctx.textAlign = 'center';
                    const initials = user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
                    ctx.fillText(initials, photoX + PHOTO_WIDTH / 2, photoY + PHOTO_HEIGHT / 2 + 12);
                    ctx.textAlign = 'left';
                }
                ctx.restore();
            }

            // --- Name ---
            const nameY = showPhoto ? photoY + PHOTO_HEIGHT + 24 : currentY + 30;
            ctx.fillStyle = TEXT_COLOR;
            ctx.font = 'bold 15px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(user.full_name, CARD_WIDTH / 2, nameY);
            ctx.textAlign = 'left';

            // --- Designation ---
            const showDesignation = template.showDesignation ?? true;
            let infoY = nameY + 18;
            if (showDesignation && designationName && designationName !== '-') {
                ctx.fillStyle = TEXT_COLOR;
                ctx.font = '12px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(designationName, CARD_WIDTH / 2, infoY);
                ctx.textAlign = 'left';
                infoY += 16;
            }

            // --- Role ---
            if (roleName) {
                ctx.fillStyle = TEXT_COLOR;
                ctx.font = '11px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(roleName, CARD_WIDTH / 2, infoY);
                ctx.textAlign = 'left';
                infoY += 16;
            }

            // --- Blood Group ---
            if (bloodGroup) {
                ctx.fillStyle = ACCENT_COLOR;
                ctx.font = 'bold 11px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`Blood Group: ${bloodGroup}`, CARD_WIDTH / 2, infoY);
                ctx.textAlign = 'left';
            }

            // --- Bottom curved wave (deep teal) ---
            const waveStartY = CARD_HEIGHT - 56;
            ctx.fillStyle = ACCENT_COLOR;
            ctx.beginPath();
            ctx.moveTo(0, CARD_HEIGHT);
            ctx.lineTo(0, waveStartY + 18);
            // Curved wave shape going upward in the middle
            ctx.quadraticCurveTo(CARD_WIDTH / 2, waveStartY - 14, CARD_WIDTH, waveStartY + 18);
            ctx.lineTo(CARD_WIDTH, CARD_HEIGHT);
            ctx.closePath();
            ctx.fill();

            // --- Website URL ---
            const websiteText = organizationWebsite || '';
            if (websiteText) {
                const displayUrl = websiteText.replace(/^https?:\/\//, '').replace(/\/$/, '');
                ctx.fillStyle = '#ffffff';
                ctx.font = '11px Inter, sans-serif';
                ctx.textAlign = 'center';
                const trimmedUrl = truncateToWidth(ctx, displayUrl, CARD_WIDTH - 24);
                ctx.fillText(trimmedUrl, CARD_WIDTH / 2, CARD_HEIGHT - 12);
                ctx.textAlign = 'left';
            }
        };

        const drawBackSide = (ctx: CanvasRenderingContext2D) => {
            ctx.fillStyle = COMMON_BACKSIDE_COLORS.background;
            ctx.beginPath();
            ctx.roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 12);
            ctx.fill();
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 12);
            ctx.clip();

            ctx.textAlign = 'center';

            if (logoImgRef.current) {
                const logo = logoImgRef.current;
                const maxLogoH = 62;
                const maxLogoW = 160;
                const ratio = logo.width / logo.height;
                let logoWidth = maxLogoH * ratio;
                let logoHeight = maxLogoH;

                if (logoWidth > maxLogoW) {
                    logoWidth = maxLogoW;
                    logoHeight = logoWidth / ratio;
                }

                ctx.drawImage(logo, (CARD_WIDTH - logoWidth) / 2, 28, logoWidth, logoHeight);
            } else if (organizationName) {
                ctx.fillStyle = COMMON_BACKSIDE_COLORS.text;
                ctx.font = 'bold 24px Inter, sans-serif';
                ctx.fillText(organizationName.toUpperCase(), CARD_WIDTH / 2, 64);
            }

            ctx.fillStyle = COMMON_BACKSIDE_COLORS.text;
            ctx.fillRect((CARD_WIDTH - COMMON_BACK_DIVIDER_WIDTH) / 2, 108, COMMON_BACK_DIVIDER_WIDTH, 2);

            ctx.font = 'bold 18px Inter, sans-serif';
            COMMON_BACKSIDE_CONTENT.instituteLines.forEach((line, index) => {
                ctx.fillText(line, CARD_WIDTH / 2, 158 + index * 28);
            });

            const waveY = CARD_HEIGHT - 140;
            ctx.fillStyle = COMMON_BACKSIDE_COLORS.footer;
            ctx.beginPath();
            ctx.moveTo(0, CARD_HEIGHT);
            ctx.lineTo(0, waveY + 56);
            ctx.quadraticCurveTo(CARD_WIDTH / 2, waveY - 22, CARD_WIDTH, waveY + 56);
            ctx.lineTo(CARD_WIDTH, CARD_HEIGHT);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = COMMON_BACKSIDE_COLORS.footerText;
            ctx.font = '12px Inter, sans-serif';
            const contactStartY = CARD_HEIGHT - 70 - Math.max(0, backSideContactLines.length - 3) * 9;
            backSideContactLines.forEach((line, index) => {
                ctx.fillText(line, CARD_WIDTH / 2, contactStartY + index * 18);
            });
            ctx.textAlign = 'left';

            ctx.restore();
        };

        const drawCard = React.useCallback(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            canvas.width = CARD_WIDTH * 2;
            canvas.height = CARD_HEIGHT * 2;
            ctx.scale(2, 2);
            ctx.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

            if (side === 'back') {
                drawBackSide(ctx);
            } else {
                drawFrontSide(ctx);
            }
        }, [user, card, template, organizationName, organizationLogo, organizationWebsite, organizationAddress, organizationPhone, designationName, photoLoaded, logoLoaded, bloodGroup, side]);

        React.useEffect(() => {
            drawCard();
        }, [drawCard]);

        return (
            <div
                id={id}
                className="relative rounded-xl overflow-hidden shadow-2xl"
                style={{ width: CARD_WIDTH * scale, height: CARD_HEIGHT * scale }}
            >
                <canvas
                    ref={canvasRef}
                    style={{ width: CARD_WIDTH * scale, height: CARD_HEIGHT * scale }}
                    className="rounded-xl"
                />

                {template.showNFCId && card?.nfc_id && (
                    <div className="absolute" style={{ right: 10 * scale, bottom: 34 * scale }}>
                        <Nfc
                            className="text-white"
                            style={{ width: 22 * scale, height: 22 * scale, opacity: 0.9 }}
                        />
                    </div>
                )}
            </div>
        );
    }
);

IDCardPreview.displayName = 'IDCardPreview';
