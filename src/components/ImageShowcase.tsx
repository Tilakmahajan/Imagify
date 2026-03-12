"use client";

import React from "react";

/* ─────────────────────────────────────────────────────────────
   ImageShowcase — shows 4 response images as feedback cards
   (replacing old text-only badge labels with image reactions)
───────────────────────────────────────────────────────────── */

const RESPONSES = [
    { src: "/images/response.png", borderBg: "linear-gradient(135deg, #FF4F8B, #8A4DFF)", glow: "rgba(255, 79, 139, 0.55)", glowSoft: "rgba(255, 79, 139, 0.22)", rotate: "-7deg", zIndex: 1 },
    { src: "/images/response1.png", borderBg: "linear-gradient(135deg, #8A4DFF, #3DA9FF)", glow: "rgba(138, 77, 255, 0.65)", glowSoft: "rgba(138, 77, 255, 0.28)", rotate: "0deg", zIndex: 10 },
    { src: "/images/response2.png", borderBg: "linear-gradient(135deg, #3DA9FF, #FF4F8B)", glow: "rgba(61, 169, 255, 0.55)", glowSoft: "rgba(61, 169, 255, 0.22)", rotate: "7deg", zIndex: 1 },
    { src: "/images/response3.jpg", borderBg: "linear-gradient(135deg, #FF4F8B, #FFE500)", glow: "rgba(255, 61, 127, 0.5)", glowSoft: "rgba(255, 229, 0, 0.2)", rotate: "-4deg", zIndex: 1 },
    { src: "/images/response4.jpg", borderBg: "linear-gradient(135deg, #3DA9FF, #8A4DFF)", glow: "rgba(61, 169, 255, 0.5)", glowSoft: "rgba(124, 58, 255, 0.2)", rotate: "4deg", zIndex: 1 },
    { src: "/images/response5.png", borderBg: "linear-gradient(135deg, #00FF94, #3DA9FF)", glow: "rgba(0, 255, 148, 0.5)", glowSoft: "rgba(0, 200, 255, 0.2)", rotate: "-5deg", zIndex: 1 },
    { src: "/images/response6.png", borderBg: "linear-gradient(135deg, #8A4DFF, #FFE500)", glow: "rgba(124, 58, 255, 0.5)", glowSoft: "rgba(255, 229, 0, 0.2)", rotate: "3deg", zIndex: 1 },
];

export function ImageShowcase() {
    return (
        <div className="flex flex-wrap items-end justify-center gap-6 sm:gap-8 lg:gap-10">
            {RESPONSES.map((r, i) => {
                const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
                    e.currentTarget.style.transform = "rotate(0deg) scale(1.08)";
                };
                const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
                    e.currentTarget.style.transform = `rotate(${r.rotate})`;
                };
                return (
                <div
                    key={i}
                    className="group relative flex-shrink-0 cursor-pointer"
                    style={{
                        transform: `rotate(${r.rotate})`,
                        transition: "transform 0.4s cubic-bezier(0.34,1.56,0.64,1)",
                        zIndex: r.zIndex,
                    }}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    {/* Gradient border wrapper */}
                    <div
                        className="p-[3px] rounded-2xl sm:rounded-3xl"
                        style={{
                            background: r.borderBg,
                            boxShadow: `0 0 40px ${r.glow}, 0 0 80px ${r.glowSoft}`,
                        }}
                    >
                        <div className="rounded-2xl sm:rounded-3xl overflow-hidden bg-black w-44 h-56 sm:w-52 sm:h-66 md:w-60 md:h-76">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={r.src}
                                alt={`Response image ${i + 1}`}
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                loading="lazy"
                            />
                        </div>
                    </div>
                </div>
                );
            })}
        </div>
    );
}
