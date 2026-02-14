// Royal piece set — elegant, refined with smooth curves and regal proportions
const W = '#ffffff';
const B = '#1a1a2e';
const S = '#000000';
const SL = '#ffffff';

function svg(children, props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
      {children}
    </svg>
  );
}

export const royalPieces = {
  wK: (props) => svg(
    <g fill={props?.fill ?? W} stroke={S} strokeWidth="1.2" strokeLinejoin="round">
      {/* Ornate cross */}
      <path d="M22.5 3v7M19 6.5h7" strokeWidth="1.8" strokeLinecap="round"/>
      {/* Crown with arches */}
      <path d="M12 28c0-7 2-12 4-15 1-2 3-3 6.5-3s5.5 1 6.5 3c2 3 4 8 4 15z"/>
      <path d="M12 28c-1 2-1 4 0 5h21c1-1 1-3 0-5" fill="none"/>
      {/* Decorative band */}
      <path d="M14 23c3-1 5.5-1.5 8.5-1.5s5.5.5 8.5 1.5" fill="none" strokeWidth="0.8"/>
      {/* Base */}
      <ellipse cx="22.5" cy="37" rx="12" ry="3"/>
      <path d="M12 33h21v4H12z"/>
    </g>, props),
  bK: (props) => svg(
    <g fill={props?.fill ?? B} stroke={SL} strokeWidth="1.2" strokeLinejoin="round">
      <path d="M22.5 3v7M19 6.5h7" strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M12 28c0-7 2-12 4-15 1-2 3-3 6.5-3s5.5 1 6.5 3c2 3 4 8 4 15z"/>
      <path d="M12 28c-1 2-1 4 0 5h21c1-1 1-3 0-5" fill="none"/>
      <path d="M14 23c3-1 5.5-1.5 8.5-1.5s5.5.5 8.5 1.5" fill="none" strokeWidth="0.8"/>
      <ellipse cx="22.5" cy="37" rx="12" ry="3"/>
      <path d="M12 33h21v4H12z"/>
    </g>, props),
  wQ: (props) => svg(
    <g fill={props?.fill ?? W} stroke={S} strokeWidth="1.2" strokeLinejoin="round">
      {/* Crown orb */}
      <circle cx="22.5" cy="5.5" r="2.5"/>
      {/* Elegant crown */}
      <path d="M9 28l3-14 4 6 6.5-12 6.5 12 4-6 3 14z"/>
      {/* Crown jewels */}
      <circle cx="12" cy="14" r="1.5"/><circle cx="33" cy="14" r="1.5"/>
      <circle cx="16.5" cy="10" r="1.3"/><circle cx="28.5" cy="10" r="1.3"/>
      {/* Collar */}
      <path d="M9 28c0 2.5 6 4 13.5 4s13.5-1.5 13.5-4" fill="none"/>
      {/* Base */}
      <ellipse cx="22.5" cy="37" rx="12" ry="3"/>
      <path d="M11.5 32h22v5h-22z"/>
    </g>, props),
  bQ: (props) => svg(
    <g fill={props?.fill ?? B} stroke={SL} strokeWidth="1.2" strokeLinejoin="round">
      <circle cx="22.5" cy="5.5" r="2.5"/>
      <path d="M9 28l3-14 4 6 6.5-12 6.5 12 4-6 3 14z"/>
      <circle cx="12" cy="14" r="1.5"/><circle cx="33" cy="14" r="1.5"/>
      <circle cx="16.5" cy="10" r="1.3"/><circle cx="28.5" cy="10" r="1.3"/>
      <path d="M9 28c0 2.5 6 4 13.5 4s13.5-1.5 13.5-4" fill="none"/>
      <ellipse cx="22.5" cy="37" rx="12" ry="3"/>
      <path d="M11.5 32h22v5h-22z"/>
    </g>, props),
  wR: (props) => svg(
    <g fill={props?.fill ?? W} stroke={S} strokeWidth="1.2" strokeLinejoin="round">
      {/* Crenellations */}
      <path d="M11 13h3.5v-4h4v4h8v-4h4v4H34v3H11z"/>
      {/* Tapered body */}
      <path d="M13 16l-1 16h21l-1-16"/>
      {/* Decorative band */}
      <path d="M13 24h19" fill="none" strokeWidth="0.8"/>
      {/* Base */}
      <path d="M10 38h25v-4H10z" />
      <path d="M11 34v-2h23v2"/>
    </g>, props),
  bR: (props) => svg(
    <g fill={props?.fill ?? B} stroke={SL} strokeWidth="1.2" strokeLinejoin="round">
      <path d="M11 13h3.5v-4h4v4h8v-4h4v4H34v3H11z"/>
      <path d="M13 16l-1 16h21l-1-16"/>
      <path d="M13 24h19" fill="none" strokeWidth="0.8"/>
      <path d="M10 38h25v-4H10z"/>
      <path d="M11 34v-2h23v2"/>
    </g>, props),
  wB: (props) => svg(
    <g fill={props?.fill ?? W} stroke={S} strokeWidth="1.2" strokeLinejoin="round">
      {/* Top finial */}
      <circle cx="22.5" cy="6" r="2.5"/>
      {/* Mitre body — smooth curves */}
      <path d="M22.5 8.5c-3 0-5 4-7 8s-3 8-2.5 14h19c.5-6-.5-10-2.5-14s-4-8-7-8z"/>
      {/* Sash */}
      <path d="M16 19l13 6M16 25l13-6" fill="none" strokeWidth="0.7"/>
      {/* Base */}
      <ellipse cx="22.5" cy="37" rx="11" ry="3"/>
      <path d="M13 31h19v6H13z"/>
    </g>, props),
  bB: (props) => svg(
    <g fill={props?.fill ?? B} stroke={SL} strokeWidth="1.2" strokeLinejoin="round">
      <circle cx="22.5" cy="6" r="2.5"/>
      <path d="M22.5 8.5c-3 0-5 4-7 8s-3 8-2.5 14h19c.5-6-.5-10-2.5-14s-4-8-7-8z"/>
      <path d="M16 19l13 6M16 25l13-6" fill="none" strokeWidth="0.7"/>
      <ellipse cx="22.5" cy="37" rx="11" ry="3"/>
      <path d="M13 31h19v6H13z"/>
    </g>, props),
  wN: (props) => svg(
    <g fill={props?.fill ?? W} stroke={S} strokeWidth="1.2" strokeLinejoin="round">
      {/* Base */}
      <ellipse cx="22.5" cy="37" rx="11" ry="3"/>
      <path d="M12 33h21v4H12z"/>
      {/* Elegant horse */}
      <path d="M25 10c-1 0-3 1-4 3l-3.5 6-3 2c-1.5 1-1.5 3.5 0 4h2.5c-1 4-3.5 7-5 8h20c-2-4-4-9-4-16 0-4-1-7-3-7z"/>
      {/* Mane curve */}
      <path d="M26 11c2 1.5 3 4 3 8" fill="none" strokeWidth="0.8"/>
      {/* Eye */}
      <circle cx="18" cy="17" r="1.2" fill={S}/>
      {/* Ear */}
      <path d="M22 8l-1.5 3 2.5.5z"/>
    </g>, props),
  bN: (props) => svg(
    <g fill={props?.fill ?? B} stroke={SL} strokeWidth="1.2" strokeLinejoin="round">
      <ellipse cx="22.5" cy="37" rx="11" ry="3"/>
      <path d="M12 33h21v4H12z"/>
      <path d="M25 10c-1 0-3 1-4 3l-3.5 6-3 2c-1.5 1-1.5 3.5 0 4h2.5c-1 4-3.5 7-5 8h20c-2-4-4-9-4-16 0-4-1-7-3-7z"/>
      <path d="M26 11c2 1.5 3 4 3 8" fill="none" strokeWidth="0.8"/>
      <circle cx="18" cy="17" r="1.2" fill={SL}/>
      <path d="M22 8l-1.5 3 2.5.5z"/>
    </g>, props),
  wP: (props) => svg(
    <g fill={props?.fill ?? W} stroke={S} strokeWidth="1.2" strokeLinejoin="round">
      <circle cx="22.5" cy="12" r="4.5"/>
      {/* Elegant neck */}
      <path d="M19 16c-1 3-1.5 6-1.5 9s.5 5 1.5 6h7c1-1 1.5-3 1.5-6s-.5-6-1.5-9"/>
      {/* Base */}
      <ellipse cx="22.5" cy="37" rx="9" ry="3"/>
      <path d="M14.5 31h16v6h-16z"/>
    </g>, props),
  bP: (props) => svg(
    <g fill={props?.fill ?? B} stroke={SL} strokeWidth="1.2" strokeLinejoin="round">
      <circle cx="22.5" cy="12" r="4.5"/>
      <path d="M19 16c-1 3-1.5 6-1.5 9s.5 5 1.5 6h7c1-1 1.5-3 1.5-6s-.5-6-1.5-9"/>
      <ellipse cx="22.5" cy="37" rx="9" ry="3"/>
      <path d="M14.5 31h16v6h-16z"/>
    </g>, props),
};
