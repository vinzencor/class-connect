import React, { useRef, forwardRef, useImperativeHandle, useState } from 'react';
import { Tables } from '@/types/database';
import { TemplateDesignData } from '@/services/idCardService';
import { QrCode, Nfc } from 'lucide-react';

type Profile = Tables<'profiles'>;
type IdCard = Tables<'id_cards'>;

interface IDCardPreviewProps {
    id?: string;
    user: Profile;
    card?: IdCard;
    template: TemplateDesignData;
    organizationName?: string;
    organizationLogo?: string;
    scale?: number;
    photoUrl?: string | null;
}

export interface IDCardPreviewRef {
    getCanvas: () => HTMLCanvasElement | null;
}

// Portrait ID Card dimensions: 2.125" x 3.375" at 96 DPI = 204 x 324 pixels
const CARD_WIDTH = 204;
const CARD_HEIGHT = 324;

// Photo dimensions
const PHOTO_WIDTH = 90;
const PHOTO_HEIGHT = 110;

export const IDCardPreview = forwardRef<IDCardPreviewRef, IDCardPreviewProps>(
    ({ id, user, card, template, organizationName, organizationLogo, scale = 1, photoUrl }, ref) => {
        const canvasRef = useRef<HTMLCanvasElement>(null);
        const [photoLoaded, setPhotoLoaded] = useState(false);
        const photoImgRef = useRef<HTMLImageElement | null>(null);

        useImperativeHandle(ref, () => ({
            getCanvas: () => canvasRef.current,
        }));

        // Load user photo (use photoUrl prop as fallback for student_details.photo_url)
        React.useEffect(() => {
            const avatarUrl = user.avatar_url || photoUrl;
            if (avatarUrl) {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => {
                    photoImgRef.current = img;
                    setPhotoLoaded(true);
                };
                img.onerror = () => {
                    photoImgRef.current = null;
                    setPhotoLoaded(false);
                };
                img.src = avatarUrl;
            } else {
                photoImgRef.current = null;
                setPhotoLoaded(false);
            }
        }, [user.avatar_url, photoUrl]);

        // Draw the card on canvas for export
        const drawCard = React.useCallback(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Set canvas size (2x for retina)
            canvas.width = CARD_WIDTH * 2;
            canvas.height = CARD_HEIGHT * 2;
            ctx.scale(2, 2);

            // Background
            ctx.fillStyle = template.backgroundColor;
            ctx.beginPath();
            ctx.roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 12);
            ctx.fill();

            // Top accent bar
            ctx.fillStyle = template.accentColor;
            ctx.fillRect(0, 0, CARD_WIDTH, 6);

            // Organization name at top center
            if (organizationName) {
                ctx.fillStyle = template.textColor;
                ctx.font = `bold 13px Inter, sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(organizationName, CARD_WIDTH / 2, 28);
                ctx.textAlign = 'left';
            }

            // Divider line
            ctx.strokeStyle = template.accentColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(16, 38);
            ctx.lineTo(CARD_WIDTH - 16, 38);
            ctx.stroke();

            // Photo area - centered
            const photoX = (CARD_WIDTH - PHOTO_WIDTH) / 2;
            const photoY = 48;

            if (template.showPhoto) {
                // Draw photo or placeholder
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(photoX, photoY, PHOTO_WIDTH, PHOTO_HEIGHT, 8);
                ctx.clip();

                if (photoImgRef.current) {
                    // Draw actual photo
                    const img = photoImgRef.current;
                    const imgRatio = img.width / img.height;
                    const boxRatio = PHOTO_WIDTH / PHOTO_HEIGHT;
                    let sx = 0, sy = 0, sw = img.width, sh = img.height;
                    if (imgRatio > boxRatio) {
                        sw = img.height * boxRatio;
                        sx = (img.width - sw) / 2;
                    } else {
                        sh = img.width / boxRatio;
                        sy = (img.height - sh) / 2;
                    }
                    ctx.drawImage(img, sx, sy, sw, sh, photoX, photoY, PHOTO_WIDTH, PHOTO_HEIGHT);
                } else {
                    // Placeholder with initials
                    ctx.fillStyle = '#374151';
                    ctx.fillRect(photoX, photoY, PHOTO_WIDTH, PHOTO_HEIGHT);
                    ctx.fillStyle = template.accentColor;
                    ctx.font = 'bold 28px Inter, sans-serif';
                    ctx.textAlign = 'center';
                    const initials = user.full_name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2);
                    ctx.fillText(initials, photoX + PHOTO_WIDTH / 2, photoY + PHOTO_HEIGHT / 2 + 10);
                    ctx.textAlign = 'left';
                }
                ctx.restore();

                // Photo border
                ctx.strokeStyle = template.accentColor;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.roundRect(photoX, photoY, PHOTO_WIDTH, PHOTO_HEIGHT, 8);
                ctx.stroke();
            }

            // Student name - centered below photo
            const nameY = photoY + PHOTO_HEIGHT + 24;
            if (template.fields.name.visible) {
                ctx.fillStyle = template.textColor;
                ctx.font = `bold 15px Inter, sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(user.full_name, CARD_WIDTH / 2, nameY);
                ctx.textAlign = 'left';
            }

            // Role badge - centered
            if (template.fields.role.visible) {
                const roleText = user.role.toUpperCase();
                ctx.font = `bold 10px Inter, sans-serif`;
                const roleWidth = ctx.measureText(roleText).width + 16;
                const roleX = (CARD_WIDTH - roleWidth) / 2;
                const roleY = nameY + 10;
                ctx.fillStyle = template.accentColor;
                ctx.beginPath();
                ctx.roundRect(roleX, roleY, roleWidth, 18, 4);
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.fillText(roleText, CARD_WIDTH / 2, roleY + 13);
                ctx.textAlign = 'left';
            }

            // Card number - centered
            if (template.fields.cardNumber.visible && card?.card_number) {
                ctx.fillStyle = template.textColor;
                ctx.globalAlpha = 0.8;
                ctx.font = `bold 11px Inter, sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillText(`ID: ${card.card_number}`, CARD_WIDTH / 2, nameY + 42);
                ctx.textAlign = 'left';
                ctx.globalAlpha = 1;
            }

            // Valid until - bottom center
            if (template.fields.validUntil.visible && card?.expiry_date) {
                ctx.fillStyle = template.textColor;
                ctx.globalAlpha = 0.6;
                ctx.font = `9px Inter, sans-serif`;
                ctx.textAlign = 'center';
                const expiryDate = new Date(card.expiry_date).toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric',
                });
                ctx.fillText(`Valid until: ${expiryDate}`, CARD_WIDTH / 2, CARD_HEIGHT - 14);
                ctx.textAlign = 'left';
                ctx.globalAlpha = 1;
            }

            // NFC indicator - bottom right
            if (template.showNFCId && card?.nfc_id) {
                ctx.fillStyle = template.accentColor;
                ctx.globalAlpha = 0.3;
                ctx.beginPath();
                ctx.arc(CARD_WIDTH - 24, CARD_HEIGHT - 24, 16, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        }, [user, card, template, organizationName, photoLoaded]);

        React.useEffect(() => {
            drawCard();
        }, [drawCard]);

        return (
            <div
                id={id}
                className="relative rounded-xl overflow-hidden shadow-2xl"
                style={{
                    width: CARD_WIDTH * scale,
                    height: CARD_HEIGHT * scale,
                }}
            >
                <canvas
                    ref={canvasRef}
                    style={{
                        width: CARD_WIDTH * scale,
                        height: CARD_HEIGHT * scale,
                    }}
                    className="rounded-xl"
                />

                {/* QR Code overlay */}
                {template.showQRCode && (
                    <div
                        className="absolute bg-white p-1 rounded"
                        style={{
                            left: ((CARD_WIDTH - 40) / 2) * scale,
                            bottom: 30 * scale,
                        }}
                    >
                        <QrCode className="w-8 h-8 text-gray-900" style={{ transform: `scale(${scale})` }} />
                    </div>
                )}

                {template.showNFCId && card?.nfc_id && (
                    <div
                        className="absolute"
                        style={{
                            right: 10 * scale,
                            bottom: 10 * scale,
                        }}
                    >
                        <Nfc
                            className="text-white/70"
                            style={{
                                width: 20 * scale,
                                height: 20 * scale
                            }}
                        />
                    </div>
                )}
            </div>
        );
    }
);

IDCardPreview.displayName = 'IDCardPreview';
