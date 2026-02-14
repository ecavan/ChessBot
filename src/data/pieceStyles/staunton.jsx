// Staunton piece set — traditional tournament style with weighted bases and lathe-turned look
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

export const stauntonPieces = {
  wK: (props) => svg(
    <g fill={props?.fill ?? W} stroke={S} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Cross */}
      <path d="M22.5 3v5M20 5.5h5" strokeWidth="2"/>
      {/* Crown band with pattee cross feel */}
      <path d="M13 14l1-3h17l1 3"/>
      <path d="M13 14c-2 4-3 9-2.5 15h24c.5-6-.5-11-2.5-15z"/>
      {/* Collar lines */}
      <path d="M13.5 21h18M14 25h17" fill="none" strokeWidth="0.7"/>
      {/* Neck */}
      <path d="M16 11c0-2 3-3 6.5-3s6.5 1 6.5 3v3H16z"/>
      {/* Heavy base */}
      <path d="M9 39h27v-3c0-1-2-3-4-3H13c-2 0-4 2-4 3z"/>
      <path d="M10.5 29h24v4h-24z"/>
    </g>, props),
  bK: (props) => svg(
    <g fill={props?.fill ?? B} stroke={SL} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22.5 3v5M20 5.5h5" strokeWidth="2"/>
      <path d="M13 14l1-3h17l1 3"/>
      <path d="M13 14c-2 4-3 9-2.5 15h24c.5-6-.5-11-2.5-15z"/>
      <path d="M13.5 21h18M14 25h17" fill="none" strokeWidth="0.7"/>
      <path d="M16 11c0-2 3-3 6.5-3s6.5 1 6.5 3v3H16z"/>
      <path d="M9 39h27v-3c0-1-2-3-4-3H13c-2 0-4 2-4 3z"/>
      <path d="M10.5 29h24v4h-24z"/>
    </g>, props),
  wQ: (props) => svg(
    <g fill={props?.fill ?? W} stroke={S} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Ball top */}
      <circle cx="22.5" cy="6" r="3.5"/>
      {/* Crown points */}
      <path d="M9 26l3.5-12 4 5 6-9 6 9 4-5 3.5 12z"/>
      {/* Collar */}
      <path d="M9 26c0 2 6 3.5 13.5 3.5S36 28 36 26" fill="none"/>
      {/* Body */}
      <path d="M10.5 29.5h24v3h-24z"/>
      {/* Heavy base */}
      <path d="M9 39h27v-3c0-1-2-3-4-3H13c-2 0-4 2-4 3z"/>
    </g>, props),
  bQ: (props) => svg(
    <g fill={props?.fill ?? B} stroke={SL} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="22.5" cy="6" r="3.5"/>
      <path d="M9 26l3.5-12 4 5 6-9 6 9 4-5 3.5 12z"/>
      <path d="M9 26c0 2 6 3.5 13.5 3.5S36 28 36 26" fill="none"/>
      <path d="M10.5 29.5h24v3h-24z"/>
      <path d="M9 39h27v-3c0-1-2-3-4-3H13c-2 0-4 2-4 3z"/>
    </g>, props),
  wR: (props) => svg(
    <g fill={props?.fill ?? W} stroke={S} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Battlements */}
      <path d="M10 12.5h3v-4h4v4h11v-4h4v4h3v3H10z"/>
      {/* Shaft */}
      <path d="M12 15.5v13h21v-13"/>
      {/* Ring detail */}
      <path d="M12 20h21" fill="none" strokeWidth="0.8"/>
      {/* Platform */}
      <path d="M10.5 28.5h24v4h-24z"/>
      {/* Heavy base */}
      <path d="M9 39h27v-3c0-1-2-3-4-3H13c-2 0-4 2-4 3z"/>
    </g>, props),
  bR: (props) => svg(
    <g fill={props?.fill ?? B} stroke={SL} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 12.5h3v-4h4v4h11v-4h4v4h3v3H10z"/>
      <path d="M12 15.5v13h21v-13"/>
      <path d="M12 20h21" fill="none" strokeWidth="0.8"/>
      <path d="M10.5 28.5h24v4h-24z"/>
      <path d="M9 39h27v-3c0-1-2-3-4-3H13c-2 0-4 2-4 3z"/>
    </g>, props),
  wB: (props) => svg(
    <g fill={props?.fill ?? W} stroke={S} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Finial */}
      <circle cx="22.5" cy="7" r="2.5"/>
      {/* Mitre shape */}
      <path d="M15 29c-.5-5 0-11 2-15 1.5-3 3-4 5.5-4s4 1 5.5 4c2 4 2.5 10 2 15z"/>
      {/* Slot */}
      <path d="M17 18l11 5" fill="none" strokeWidth="0.8"/>
      {/* Platform */}
      <path d="M12 29h21v4H12z"/>
      {/* Heavy base */}
      <path d="M9 39h27v-3c0-1-2-3-4-3H13c-2 0-4 2-4 3z"/>
    </g>, props),
  bB: (props) => svg(
    <g fill={props?.fill ?? B} stroke={SL} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="22.5" cy="7" r="2.5"/>
      <path d="M15 29c-.5-5 0-11 2-15 1.5-3 3-4 5.5-4s4 1 5.5 4c2 4 2.5 10 2 15z"/>
      <path d="M17 18l11 5" fill="none" strokeWidth="0.8"/>
      <path d="M12 29h21v4H12z"/>
      <path d="M9 39h27v-3c0-1-2-3-4-3H13c-2 0-4 2-4 3z"/>
    </g>, props),
  wN: (props) => svg(
    <g fill={props?.fill ?? W} stroke={S} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Horse head — Staunton proportions */}
      <path d="M24 8c-1 0-3 1.5-4 3.5l-3 6-3.5 2.5c-1.5.8-1 3 .5 3.5h2.5c-.5 3-2 6-4 9h19c-1.5-3-3-7-3-14 0-4-.5-7-1.5-9-.8-1.5-2-2-3-2z"/>
      {/* Mane */}
      <path d="M25.5 10c1.5 1.5 2.5 4 2.5 8" fill="none" strokeWidth="1"/>
      {/* Eye */}
      <circle cx="17.5" cy="16.5" r="1.3" fill={S}/>
      {/* Nostril line */}
      <path d="M14 23.5c1.5-.8 3-.8 4.5 0" fill="none" strokeWidth="0.8"/>
      {/* Platform */}
      <path d="M10.5 29h24v4h-24z"/>
      {/* Heavy base */}
      <path d="M9 39h27v-3c0-1-2-3-4-3H13c-2 0-4 2-4 3z"/>
    </g>, props),
  bN: (props) => svg(
    <g fill={props?.fill ?? B} stroke={SL} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M24 8c-1 0-3 1.5-4 3.5l-3 6-3.5 2.5c-1.5.8-1 3 .5 3.5h2.5c-.5 3-2 6-4 9h19c-1.5-3-3-7-3-14 0-4-.5-7-1.5-9-.8-1.5-2-2-3-2z"/>
      <path d="M25.5 10c1.5 1.5 2.5 4 2.5 8" fill="none" strokeWidth="1"/>
      <circle cx="17.5" cy="16.5" r="1.3" fill={SL}/>
      <path d="M14 23.5c1.5-.8 3-.8 4.5 0" fill="none" strokeWidth="0.8"/>
      <path d="M10.5 29h24v4h-24z"/>
      <path d="M9 39h27v-3c0-1-2-3-4-3H13c-2 0-4 2-4 3z"/>
    </g>, props),
  wP: (props) => svg(
    <g fill={props?.fill ?? W} stroke={S} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Ball */}
      <circle cx="22.5" cy="12" r="4.5"/>
      {/* Neck */}
      <path d="M18.5 16.5c-1 2-1.5 5-1 8h10c.5-3 0-6-1-8"/>
      {/* Collar */}
      <path d="M15 24.5h15v4H15z"/>
      {/* Heavy base */}
      <path d="M11 39h23v-3c0-1-2-3-4-3h-15c-2 0-4 2-4 3z"/>
      <path d="M13 28.5h19v4H13z"/>
    </g>, props),
  bP: (props) => svg(
    <g fill={props?.fill ?? B} stroke={SL} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="22.5" cy="12" r="4.5"/>
      <path d="M18.5 16.5c-1 2-1.5 5-1 8h10c.5-3 0-6-1-8"/>
      <path d="M15 24.5h15v4H15z"/>
      <path d="M11 39h23v-3c0-1-2-3-4-3h-15c-2 0-4 2-4 3z"/>
      <path d="M13 28.5h19v4H13z"/>
    </g>, props),
};
