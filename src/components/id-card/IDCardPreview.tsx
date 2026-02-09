import React, { useRef, forwardRef, useImperativeHandle } from 'react';
import { Tables } from '@/types/database';
import { TemplateDesignData } from '@/services/idCardService';
import { QrCode, Nfc } from 'lucide-react';

type Profile = Tables<'profiles'>;
type IdCard = Tables<'id_cards'>;

interface IDCardPreviewProps {
    user: Profile;
    card?: IdCard;
    template: TemplateDesignData;
    organizationName?: string;
    organizationLogo?: string;
    scale?: number;
}

export interface IDCardPreviewRef {
    getCanvas: () => HTMLCanvasElement | null;
}

// ID Card dimensions: 3.375" x 2.125" at 96 DPI = 324 x 204 pixels
const CARD_WIDTH = 324;
const CARD_HEIGHT = 204;

export const IDCardPreview = forwardRef<IDCardPreviewRef, IDCardPreviewProps>(
    ({ user, card, template, organizationName, organizationLogo, scale = 1 }, ref) => {
        const canvasRef = useRef<HTMLCanvasElement>(null);

        useImperativeHandle(ref, () => ({
            getCanvas: () => canvasRef.current,
        }));

        // Draw the card on canvas for export
        const drawCard = React.useCallback(() => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Set canvas size
            canvas.width = CARD_WIDTH * 2; // 2x for retina
            canvas.height = CARD_HEIGHT * 2;
            ctx.scale(2, 2);

            // Background
            ctx.fillStyle = template.backgroundColor;
            ctx.roundRect(0, 0, CARD_WIDTH, CARD_HEIGHT, 12);
            ctx.fill();

            // Accent stripe
            ctx.fillStyle = template.accentColor;
            ctx.fillRect(0, 0, 8, CARD_HEIGHT);

            // Organization name
            if (template.fields.organization.visible && organizationName) {
                ctx.fillStyle = template.textColor;
                ctx.font = `bold ${template.fields.organization.fontSize}px Inter, sans-serif`;
                ctx.fillText(
                    organizationName,
                    template.fields.organization.x,
                    template.fields.organization.y
                );
            }

            // User name
            if (template.fields.name.visible) {
                ctx.fillStyle = template.textColor;
                ctx.font = `bold ${template.fields.name.fontSize}px Inter, sans-serif`;
                ctx.fillText(user.full_name, template.fields.name.x, template.fields.name.y);
            }

            // Role badge
            if (template.fields.role.visible) {
                ctx.fillStyle = template.accentColor;
                const roleText = user.role.toUpperCase();
                ctx.font = `bold ${template.fields.role.fontSize}px Inter, sans-serif`;
                const roleWidth = ctx.measureText(roleText).width + 16;
                ctx.roundRect(
                    template.fields.role.x,
                    template.fields.role.y - 12,
                    roleWidth,
                    18,
                    4
                );
                ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.fillText(roleText, template.fields.role.x + 8, template.fields.role.y);
            }

            // Card number
            if (template.fields.cardNumber.visible && card?.card_number) {
                ctx.fillStyle = template.textColor;
                ctx.globalAlpha = 0.7;
                ctx.font = `${template.fields.cardNumber.fontSize}px Inter, sans-serif`;
                ctx.fillText(
                    `ID: ${card.card_number}`,
                    template.fields.cardNumber.x,
                    template.fields.cardNumber.y
                );
                ctx.globalAlpha = 1;
            }

            // Valid until
            if (template.fields.validUntil.visible && card?.expiry_date) {
                ctx.fillStyle = template.textColor;
                ctx.globalAlpha = 0.7;
                ctx.font = `${template.fields.validUntil.fontSize}px Inter, sans-serif`;
                const expiryDate = new Date(card.expiry_date).toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric',
                });
                ctx.fillText(
                    `Valid until: ${expiryDate}`,
                    template.fields.validUntil.x,
                    template.fields.validUntil.y
                );
                ctx.globalAlpha = 1;
            }

            // Draw photo placeholder
            if (template.showPhoto) {
                ctx.fillStyle = '#374151';
                ctx.beginPath();
                ctx.roundRect(
                    template.photoPosition.x,
                    template.photoPosition.y,
                    80,
                    100,
                    8
                );
                ctx.fill();

                // User initials in photo area
                ctx.fillStyle = template.accentColor;
                ctx.font = 'bold 24px Inter, sans-serif';
                const initials = user.full_name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);
                const textWidth = ctx.measureText(initials).width;
                ctx.fillText(
                    initials,
                    template.photoPosition.x + 40 - textWidth / 2,
                    template.photoPosition.y + 55
                );
            }

            // NFC indicator
            if (template.showNFCId && card?.nfc_id) {
                ctx.fillStyle = template.accentColor;
                ctx.globalAlpha = 0.3;
                ctx.beginPath();
                ctx.arc(CARD_WIDTH - 30, CARD_HEIGHT - 30, 20, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        }, [user, card, template, organizationName]);

        React.useEffect(() => {
            drawCard();
        }, [drawCard]);

        return (
            <div
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

                {/* Overlays for icons that can't be drawn easily on canvas */}
                {template.showQRCode && (
                    <div
                        className="absolute bg-white p-1 rounded"
                        style={{
                            left: template.qrPosition.x * scale,
                            top: template.qrPosition.y * scale,
                        }}
                    >
                        <QrCode className="w-8 h-8 text-gray-900" style={{ transform: `scale(${scale})` }} />
                    </div>
                )}

                {template.showNFCId && card?.nfc_id && (
                    <div
                        className="absolute"
                        style={{
                            right: 15 * scale,
                            bottom: 15 * scale,
                        }}
                    >
                        <Nfc
                            className="text-white/70"
                            style={{
                                width: 24 * scale,
                                height: 24 * scale
                            }}
                        />
                    </div>
                )}
            </div>
        );
    }
);

IDCardPreview.displayName = 'IDCardPreview';
