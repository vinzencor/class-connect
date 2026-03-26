import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Tables } from '@/types/database';
import { TemplateDesignData } from '@/services/idCardService';
import { PREVIEW_CARD_HEIGHT_PX, PREVIEW_CARD_WIDTH_PX } from './cardDimensions';

type Profile = Tables<'profiles'>;
type IdCard = Tables<'id_cards'>;

export interface StudentCardData {
    bloodGroup?: string | null;
    dateOfBirth?: string | null;
    batchName?: string | null;
    courseName?: string | null;
    fatherName?: string | null;
    mobile?: string | null;
}

interface StudentIDCardPreviewProps {
    id?: string;
    user: Profile;
    card?: IdCard;
    template: TemplateDesignData;
    organizationName?: string;
    organizationLogo?: string;
    organizationWebsite?: string;
    organizationAddress?: string;
    organizationPhone?: string;
    organizationTagline?: string;
    studentData?: StudentCardData;
    scale?: number;
    photoUrl?: string | null;
    side?: 'front' | 'back';
}

export interface StudentIDCardPreviewRef {
    // Kept for backward compatibility if any parent component tries to call it
    getCanvas: () => HTMLCanvasElement | null;
}

export const StudentIDCardPreview = forwardRef<StudentIDCardPreviewRef, StudentIDCardPreviewProps>(
    ({
        id,
        user,
        card,
        template,
        organizationName,
        organizationLogo,
        organizationWebsite,
        organizationAddress,
        organizationPhone,
        studentData,
        scale = 1,
        photoUrl,
        side = 'front'
    }, ref) => {
        const containerRef = useRef<HTMLDivElement>(null);
        const BASE_WIDTH = 285;
        const BASE_HEIGHT = 500;
        const fitScaleX = PREVIEW_CARD_WIDTH_PX / BASE_WIDTH;
        const fitScaleY = PREVIEW_CARD_HEIGHT_PX / BASE_HEIGHT;

        useImperativeHandle(ref, () => ({
            getCanvas: () => {
                // Return null since we no longer use a native canvas drawing.
                // html2canvas in the parent handles downloading the DOM element.
                return null;
            },
        }));

        const displayPhoto = user.avatar_url || photoUrl;
        const orgNameParts = (organizationName || 'TEAMMATES academy').split(' ');
        const mainOrgName = orgNameParts[0]?.toUpperCase() || 'TEAMMATES';
        const subOrgName = orgNameParts.slice(1).join(' ') || 'academy';

        const addressStr = organizationAddress || 'Savithri Building,\nopp Fathima Hospital,\nBank Road, Kozhikode - 673001';
        const addressLines = addressStr.split('\n');

        const FrontCard = () => (
            <div className="relative w-[285px] h-[500px] overflow-hidden bg-[#c5dde3] shadow-2xl shrink-0 selection:bg-transparent">
                <div className="absolute inset-0">
                    <div className="absolute -top-24 -left-28 w-[290px] h-[390px] bg-[#0d5260] rounded-full rotate-[18deg]" />
                    <div className="absolute top-[70px] left-[78px] w-[235px] h-[250px] bg-[#0d5260] rounded-[35%] rotate-[8deg] opacity-0" />
                    <div className="absolute top-[84px] left-[72px] w-[240px] h-[210px] bg-[#c5dde3] rounded-[42%] rotate-[8deg]" />
                </div>

                <div className="absolute top-[6px] left-1/2 -translate-x-1/2 w-[36px] h-[9px] bg-[#5c5c5c] rounded-full" />

                <div className="absolute top-[28px] left-1/2 -translate-x-1/2 text-center text-white">
                    <div className="flex flex-col items-center gap-0">
                        {template.showLogo === false ? null : organizationLogo ? (
                            <img src={organizationLogo} alt="Logo" className="h-8 object-contain" crossOrigin="anonymous" />
                        ) : (
                            <div className="relative w-5 h-5">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full" />
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-3 bg-white" style={{ clipPath: "polygon(0 100%, 0 40%, 50% 0, 100% 40%, 100% 100%)" }} />
                            </div>
                        )}
                        <div className="leading-none mt-0.5">
                            <div className="text-[12px] font-extrabold tracking-wide">{mainOrgName}</div>
                            <div className="text-[9px] font-medium tracking-wide">{subOrgName}</div>
                        </div>
                    </div>
                </div>

                {template.showPhoto !== false && (
                    <div className="absolute top-[85px] left-1/2 -translate-x-1/2 w-[190px] h-[190px]">
                        <svg
                            className="absolute inset-0 w-full h-full"
                            viewBox="0 0 190 190"
                            fill="none"
                        >
                            {/* Perfect round arc */}
                            <circle
                                cx="95"
                                cy="95"
                                r="72"
                                stroke="#0d5260"
                                strokeWidth="16"
                                strokeLinecap="round"
                                strokeDasharray="300 160"
                                transform="rotate(-35 95 95)"
                            />

                            {/* Yellow dots with gap from blue arc */}
                            <circle cx="155" cy="36" r="9" fill="#fbbc42" />
                            <circle cx="34" cy="145" r="9" fill="#fbbc42" />
                        </svg>

                        {/* Photo circle */}
                        <div className="absolute top-[30px] left-[30px] w-[130px] h-[130px] bg-[#fbbc42] rounded-full overflow-hidden flex items-center justify-center">
                            {displayPhoto ? (
                                <img
                                    src={displayPhoto}
                                    alt="Profile"
                                    className="w-full h-full object-cover"
                                    crossOrigin="anonymous"
                                />
                            ) : (
                                <span className="text-4xl font-bold text-gray-500 uppercase">
                                    {user.full_name.substring(0, 2)}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                <div className="absolute top-[280px] left-1/2 -translate-x-1/2 w-[180px] h-[150px] rounded-[20px] border-[1.5px] border-[#0d5260] bg-transparent p-4 text-[#18343c]">
                    <div className="space-y-4 text-[11px] font-bold tracking-wide leading-none flex flex-col h-full justify-center">
                        <div className="flex gap-1 overflow-hidden">
                            <span className="shrink-0 w-[60px] font-semibold text-[10px]">NAME:</span>
                            <span className="truncate flex-1">{user.full_name.toUpperCase()}</span>
                        </div>
                        <div className="flex gap-1 overflow-hidden">
                            <span className="shrink-0 w-[60px] font-semibold text-[10px]">COURSE:</span>
                            <span className="truncate flex-1 uppercase">{studentData?.courseName || '-'}</span>
                        </div>
                        <div className="flex gap-1 overflow-hidden">
                            <span className="shrink-0 w-[60px] font-semibold text-[10px]">BATCH:</span>
                            <span className="truncate flex-1 uppercase">{studentData?.batchName || '-'}</span>
                        </div>
                        <div className="flex gap-1 overflow-hidden relative">
                            {/* The specific blood group text length needs slightly more width, using negative margin trick or absolute pos if needed. We'll let flex handle it. */}
                            <span className="shrink-0 w-[95px] font-semibold text-[10px]">BLOOD GROUP:</span>
                            <span className="truncate flex-1 uppercase">{studentData?.bloodGroup || '-'}</span>
                        </div>
                    </div>
                </div>

                <div className="absolute -bottom-5 -left-5 w-[62px] h-[62px] border-[12px] border-[#0d5260] rounded-full">
                    <div className="absolute inset-[8px] rounded-full bg-[#c5dde3]" />
                </div>
            </div>
        );

        const BackCard = () => (
            <div className="relative w-[285px] h-[500px] overflow-hidden bg-[#c5dde3] shadow-2xl shrink-0 selection:bg-transparent">
                <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-[38px] h-[9px] bg-[#5c5c5c] rounded-full" />

                <div className="absolute -top-8 right-[-18px] w-[96px] h-[96px] border-[14px] border-[#0d5260] rounded-full">
                    <div className="absolute inset-[8px] rounded-full bg-[#d39b34]" />
                </div>

                <div className="absolute top-[82px] left-1/2 -translate-x-1/2 text-center text-[#123f4a]">
                    <div className="flex flex-col items-center gap-2">
                        {template.showLogo === false ? null : organizationLogo ? (
                            <img src={organizationLogo} alt="Logo" className="h-10 object-contain" crossOrigin="anonymous" />
                        ) : (
                            <div className="relative w-8 h-8">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#d39b34] rounded-full" />
                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-7 h-5 bg-[#123f4a]" style={{ clipPath: "polygon(0 100%, 0 30%, 50% 0, 100% 30%, 100% 100%)" }} />
                            </div>
                        )}
                        <div className="leading-none mt-1">
                            <div className="text-[20px] font-extrabold tracking-tight">{mainOrgName}</div>
                            <div className="text-[10px] font-medium tracking-[1.5px] text-[#5a5a5a]">{subOrgName}</div>
                        </div>
                    </div>
                </div>

                <div className="absolute top-[150px] left-1/2 -translate-x-1/2 w-[110px] h-[110px] rounded-[22px] border-[6px] border-[#0d5260] bg-white flex items-center justify-center p-2 shadow-md">
                    <div className="w-full h-full rounded-[10px] border border-gray-200 bg-[linear-gradient(90deg,#000_1px,transparent_1px),linear-gradient(#000_1px,transparent_1px)] bg-[size:12px_12px] opacity-80 relative flex items-center justify-center">
                        <div className="w-8 h-8 rounded-[10px] border-[3px] border-black flex items-center justify-center bg-white">
                            <div className="w-3 h-3 rounded-full border-[2px] border-black" />
                        </div>
                        <div className="absolute top-2 left-2 w-3 h-3 border-[2px] border-black rounded-md" />
                        <div className="absolute top-2 right-2 w-3 h-3 border-[2px] border-black rounded-md" />
                        <div className="absolute bottom-2 left-2 w-3 h-3 border-[2px] border-black rounded-md" />
                    </div>
                </div>

                <div className="absolute top-[282px] left-1/2 -translate-x-1/2 text-center text-[#123f4a] leading-tight w-full">
                    {/* Hardcoded tagline as requested by design, or configurable if we add a tagline prop later */}
                    <div className="text-[12px] font-extrabold">INSTITUTE FOR</div>
                    <div className="text-[11px] font-extrabold text-[#d39b34] uppercase">Bank | SSC | Railways|</div>
                    <div className="text-[11px] font-extrabold text-[#d39b34] uppercase">Insurance Coaching</div>

                    <div className="mt-4 text-[9px] font-medium text-[#4a4a4a] leading-[1.3] flex flex-col items-center">
                        {addressLines.map((line, i) => (
                            <p key={i}>{line}</p>
                        ))}
                        {organizationPhone && <p className="mt-0.5">{organizationPhone}</p>}
                    </div>
                </div>

                <div className="absolute -bottom-4 -left-4 w-[58px] h-[58px] border-[12px] border-[#0d5260] rounded-full">
                    <div className="absolute inset-[8px] rounded-full bg-[#c5dde3]" />
                </div>
            </div>
        );

        return (
            <div
                id={id}
                ref={containerRef}
                className="relative rounded-[16px] overflow-hidden"
                style={{ width: `${PREVIEW_CARD_WIDTH_PX * scale}px`, height: `${PREVIEW_CARD_HEIGHT_PX * scale}px` }}
            >
                <div style={{ transform: `scale(${scale * fitScaleX}, ${scale * fitScaleY})`, transformOrigin: 'top left' }}>
                    {side === 'back' ? <BackCard /> : <FrontCard />}
                </div>
            </div>
        );
    }
);

StudentIDCardPreview.displayName = 'StudentIDCardPreview';
