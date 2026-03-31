import React, { forwardRef, useImperativeHandle, useRef, useId } from 'react';
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
        const BASE_WIDTH = 153;
        const BASE_HEIGHT = 243;
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

        const FrontCard = () => {
            const uid = useId().replace(/:/g, "");

            return (
                <div className="relative overflow-hidden bg-[#BDE2E9] aspect-[153/243] w-[153px] h-[243px] shadow-2xl shrink-0 selection:bg-transparent">
                  {/* ── Dark-teal decorative background shapes ── */}
                  <svg
                    className="absolute top-0 left-0 w-[153px] h-auto pointer-events-none"
                    viewBox="0 0 154 172"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <mask
                      id={`mask-bg-${uid}`}
                      style={{ maskType: "luminance" }}
                      maskUnits="userSpaceOnUse"
                      x="0"
                      y="0"
                      width="154"
                      height="172"
                    >
                      <path d="M153.07 0H0V171.88H153.07V0Z" fill="white" />
                    </mask>
                    <g mask={`url(#mask-bg-${uid})`}>
                      <path
                        d="M-0.212656 -153.549L-168.541 -12.4551L-78.4202 95.0605L89.9077 -46.0333L-0.212656 -153.549Z"
                        fill="#0d5260"
                      />
                      <path
                        d="M-47.57 194.07L-113.19 115.79L148.11 -103.26L213.68 -25.04C206.08 -15.76 197.5 -7.02 187.97 0.960007C148.07 34.41 98.69 49.13 50.52 46.06C45.14 94.02 22.02 140.07 -17.88 173.52C-27.3 181.42 -37.23 188.26 -47.59 194.07"
                        fill="#0d5260"
                      />
                    </g>
                  </svg>

                  {/* Hole punch indicator that was on the original card */}
                  <div className="absolute top-[4px] left-1/2 -translate-x-1/2 w-[24px] h-[4px] bg-[#5c5c5c] rounded-full z-20" />

                  {/* ── TEAMMATES Academy logo ── */}
                  <div className="absolute top-[2.2%] left-[34.6%] w-[31.4%] aspect-square flex items-center justify-center overflow-hidden">
                    {template.showLogo === false ? null : organizationLogo ? (
                        <img
                          src={organizationLogo}
                          alt="TEAMMATES Academy"
                          className="w-full h-full object-contain"
                          crossOrigin="anonymous"
                        />
                    ) : (
                        <div className="relative w-full h-full flex flex-col items-center justify-center text-white">
                            <div className="text-[7px] font-bold leading-none">{mainOrgName}</div>
                            <div className="text-[4px]">{subOrgName}</div>
                        </div>
                    )}
                  </div>

                  {/* ── Large orange circle (profile backdrop) ── */}
                  <div
                    className="absolute top-[19.8%] left-[30.7%] w-[42.5%] aspect-square rounded-full bg-[#fbbc42]"
                    aria-hidden="true"
                  />

                  {/* ── Profile photo (clipped to circle) ── */}
                  {template.showPhoto !== false && (
                    <div className="absolute top-[18.2%] left-[30.7%] w-[42.5%] aspect-square rounded-full overflow-hidden flex items-center justify-center">
                        {displayPhoto ? (
                            <img
                              src={displayPhoto}
                              alt="Student profile"
                              className="absolute object-cover"
                              style={{ left: "9%", top: "6%", width: "86%", height: "97%", borderRadius: "100px" }}
                              crossOrigin="anonymous"
                            />
                        ) : (
                            <span className="text-[14px] font-bold text-gray-500 uppercase bg-white w-[86%] h-[86%] rounded-full flex items-center justify-center mt-2">
                                {user.full_name.substring(0, 2)}
                            </span>
                        )}
                    </div>
                  )}

                  {/* ── Arc stroke around/over profile ── */}
                  <svg
                    className="absolute top-[21.8%] left-[32.7%] w-[50.3%] overflow-hidden pointer-events-none"
                    style={{ height: "30.9%" }}
                    viewBox="0 0 77 75"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <defs>
                      <clipPath id={`clip-arc1-${uid}`}>
                        <rect width="76.89" height="74.77" />
                      </clipPath>
                    </defs>
                    <path
                      d="M2.89 61.75C19.86 73.76 43.14 72.12 58.23 57.87C73.37 43.57 76.29 20.3 65.14 2.67"
                      stroke="#0d5260"
                      strokeWidth="10"
                      strokeMiterlimit="10"
                      clipPath={`url(#clip-arc1-${uid})`}
                    />
                  </svg>

                  {/* ── Small orange dot – upper right of profile ── */}
                  <div
                    className="absolute top-[18.5%] left-[69.3%] w-[6.5%] aspect-square rounded-full bg-[#fbbc42]"
                    aria-hidden="true"
                  />

                  {/* ── Small orange dot – lower left of profile ── */}
                  <div
                    className="absolute top-[43.6%] left-[27.5%] w-[6.5%] aspect-square rounded-full bg-[#fbbc42]"
                    aria-hidden="true"
                  />

                  {/* ── Info box ── */}
                  <div
                    className="absolute top-[58%] left-[19.6%] w-[62.1%] border-[0.5px] border-[#0d5260]/70 rounded-[3%] bg-transparent"
                    style={{ height: "30.5%" }}
                  >
                    <div className="flex flex-col justify-around h-full px-[8%] py-[5%]">
                      <p className="text-[#104957] font-normal id-card-label whitespace-nowrap text-[6px] flex">
                        <span className="w-[45%] inline-block text-[5.5px]">NAME :</span>
                        <span className="font-bold truncate flex-1 ml-1">{user.full_name.toUpperCase()}</span>
                      </p>
                      <p className="text-[#104957] font-normal id-card-label whitespace-nowrap text-[6px] flex">
                        <span className="w-[45%] inline-block text-[5.5px]">COURSE:</span>
                        <span className="font-bold truncate flex-1 ml-1 uppercase">{studentData?.courseName || '-'}</span>
                      </p>
                      <p className="text-[#104957] font-normal id-card-label whitespace-nowrap text-[6px] flex">
                        <span className="w-[45%] inline-block text-[5.5px]">BATCH:</span>
                        <span className="font-bold truncate flex-1 ml-1 uppercase">{studentData?.batchName || '-'}</span>
                      </p>
                      <p className="text-[#104957] font-normal id-card-label whitespace-nowrap text-[6px] flex leading-[6px]">
                        <span className="w-[45%] inline-block tracking-tighter text-[5px]">BLOOD GROUP:</span>
                        <span className="font-bold truncate flex-1 ml-1 uppercase min-w-0" style={{ color: '#0d5260' }}>{studentData?.bloodGroup || '-'}</span>
                      </p>
                    </div>
                  </div>

                  {/* ── Bottom-left arc ── */}
                  <svg
                    className="absolute left-[-4.6%] top-[88.5%] w-[22.9%] overflow-hidden pointer-events-none"
                    style={{ height: "15.6%" }}
                    viewBox="0 0 35 38"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <defs>
                      <clipPath id={`clip-arc2-${uid}`}>
                        <rect width="34.45" height="37.97" />
                      </clipPath>
                    </defs>
                    <path
                      d="M2.18 6.93999C9.82 3.23999 18.96 4.94999 24.55 11.04C30.53 17.55 31.12 27.65 25.81 35.06"
                      stroke="#0d5260"
                      strokeWidth="10"
                      strokeMiterlimit="10"
                      clipPath={`url(#clip-arc2-${uid})`}
                    />
                  </svg>
                </div>
            );
        };

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
