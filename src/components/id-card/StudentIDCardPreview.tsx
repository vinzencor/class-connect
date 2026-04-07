import React, { forwardRef, useImperativeHandle, useRef, useId } from 'react';
import { Tables } from '@/types/database';
import { TemplateDesignData } from '@/services/idCardService';
import { PREVIEW_CARD_HEIGHT_PX, PREVIEW_CARD_WIDTH_PX } from './cardDimensions';
import { COMMON_BACKSIDE_COLORS, COMMON_BACKSIDE_CONTENT, getBackSideContactLines } from './commonBackSide';

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
        const backSideContactLines = getBackSideContactLines(organizationAddress, organizationPhone);

        const FrontCard = () => {
            const uid = useId().replace(/:/g, "");

            return (
                <div className="relative overflow-hidden bg-[#BDE2E9] aspect-[153/243] w-[153px] h-[243px] shadow-2xl shrink-0 selection:bg-transparent">
                  {/* ── Dark-teal decorative background shapes ── */}
                    

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
                      <p className="text-[#104957] font-normal id-card-label whitespace-nowrap text-[6px] flex justify-center text-center">
                        <span className="font-bold truncate max-w-full">{user.full_name.toUpperCase()}</span>
                      </p>
                      <p className="text-[#104957] font-normal id-card-label whitespace-nowrap text-[6px] flex justify-center text-center">
                        <span className="font-bold truncate max-w-full uppercase">{studentData?.courseName || '-'}</span>
                      </p>
                      <p className="text-[#104957] font-normal id-card-label whitespace-nowrap text-[6px] flex justify-center text-center">
                        <span className="font-bold truncate max-w-full uppercase">{studentData?.batchName || '-'}</span>
                      </p>
                      <p className="text-[#104957] font-normal id-card-label whitespace-nowrap text-[6px] flex justify-center text-center leading-[6px]">
                        <span className="font-bold truncate max-w-full uppercase min-w-0" style={{ color: '#0d5260' }}>{studentData?.bloodGroup || '-'}</span>
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
          <div
            className="relative overflow-hidden shadow-2xl shrink-0 selection:bg-transparent rounded-[16px]"
            style={{
              width: `${PREVIEW_CARD_WIDTH_PX}px`,
              height: `${PREVIEW_CARD_HEIGHT_PX}px`,
              backgroundColor: COMMON_BACKSIDE_COLORS.background,
            }}
          >
            <div className="absolute inset-x-0 top-[28px] flex justify-center px-8">
              {organizationLogo ? (
                <img
                  src={organizationLogo}
                  alt={organizationName || 'Organization logo'}
                  className="max-h-[62px] max-w-[160px] object-contain"
                  crossOrigin="anonymous"
                />
              ) : (
                <div className="text-center text-white leading-none">
                  <div className="text-[24px] font-bold tracking-[0.04em]">{mainOrgName}</div>
                  {subOrgName ? <div className="mt-2 text-[14px] font-medium">{subOrgName}</div> : null}
                </div>
              )}
            </div>

            <div className="absolute left-1/2 top-[108px] h-[2px] w-[80%] -translate-x-1/2 bg-white/95" />

            <div
              className="absolute inset-x-0 top-[146px] px-8 text-center"
              style={{ color: COMMON_BACKSIDE_COLORS.text }}
            >
              {COMMON_BACKSIDE_CONTENT.instituteLines.map((line) => (
                <p key={line} className="text-[18px] font-semibold leading-[1.55]">
                  {line}
                </p>
              ))}
            </div>

            <div
              className="absolute inset-x-0 bottom-0 h-[140px]"
              style={{
                backgroundColor: COMMON_BACKSIDE_COLORS.footer,
                borderTopLeftRadius: '80px',
                borderTopRightRadius: '80px',
              }}
            />

            <div
              className="absolute inset-x-0 bottom-8 px-6 text-center text-[12px] leading-[1.45]"
              style={{ color: COMMON_BACKSIDE_COLORS.footerText }}
            >
              {backSideContactLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </div>
        );

        return (
            <div
                id={id}
                ref={containerRef}
                className="relative rounded-[16px] overflow-hidden"
                style={
                    side === 'back'
                    ? { width: `${PREVIEW_CARD_WIDTH_PX * scale}px`, height: `${PREVIEW_CARD_HEIGHT_PX * scale}px` }
                        : { width: `${PREVIEW_CARD_WIDTH_PX * scale}px`, height: `${PREVIEW_CARD_HEIGHT_PX * scale}px` }
                }
            >
                <div style={{
                  transform: side === 'back'
                    ? `scale(${scale})`
                    : `scale(${scale * fitScaleX}, ${scale * fitScaleY})`,
                    transformOrigin: 'top left'
                }}>
                    {side === 'back' ? <BackCard /> : <FrontCard />}
                </div>
            </div>
        );
    }
);

StudentIDCardPreview.displayName = 'StudentIDCardPreview';
