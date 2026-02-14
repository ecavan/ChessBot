// Gothic piece set — ornate medieval-inspired with pointed crowns and crosses
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

export const gothicPieces = {
  wK: (props) => svg(
    <g fill={props?.fill ?? W} stroke={S} strokeWidth="1.5" strokeLinejoin="round">
      {/* Cross */}
      <path d="M22.5 2v8M18.5 6h8" strokeWidth="2.5"/>
      {/* Crown */}
      <path d="M13 16l2-4 3 3 4.5-6 4.5 6 3-3 2 4c1 4 1 8-1 12H14c-2-4-2-8-1-12z"/>
      {/* Base */}
      <path d="M10 38h25c0-3-3-5-12.5-5S10 35 10 38z"/>
      <path d="M14 28h17" fill="none"/>
      <path d="M12 33h21" fill="none"/>
    </g>, props),
  bK: (props) => svg(
    <g fill={props?.fill ?? B} stroke={SL} strokeWidth="1.5" strokeLinejoin="round">
      <path d="M22.5 2v8M18.5 6h8" strokeWidth="2.5"/>
      <path d="M13 16l2-4 3 3 4.5-6 4.5 6 3-3 2 4c1 4 1 8-1 12H14c-2-4-2-8-1-12z"/>
      <path d="M10 38h25c0-3-3-5-12.5-5S10 35 10 38z"/>
      <path d="M14 28h17" fill="none"/>
      <path d="M12 33h21" fill="none"/>
    </g>, props),
  wQ: (props) => svg(
    <g fill={props?.fill ?? W} stroke={S} strokeWidth="1.5" strokeLinejoin="round">
      {/* Fleur-de-lis crown points */}
      <circle cx="22.5" cy="5" r="2.5"/>
      <circle cx="13" cy="9" r="2"/><circle cx="32" cy="9" r="2"/>
      <circle cx="8" cy="15" r="2"/><circle cx="37" cy="15" r="2"/>
      {/* Body */}
      <path d="M8 17l5.5 13h18L37 17l-6 6-4-10-4.5 10-4-10-6 6z"/>
      {/* Base */}
      <path d="M10 38h25c0-3-3-5-12.5-5S10 35 10 38z"/>
      <path d="M13.5 30h18" fill="none"/>
    </g>, props),
  bQ: (props) => svg(
    <g fill={props?.fill ?? B} stroke={SL} strokeWidth="1.5" strokeLinejoin="round">
      <circle cx="22.5" cy="5" r="2.5"/>
      <circle cx="13" cy="9" r="2"/><circle cx="32" cy="9" r="2"/>
      <circle cx="8" cy="15" r="2"/><circle cx="37" cy="15" r="2"/>
      <path d="M8 17l5.5 13h18L37 17l-6 6-4-10-4.5 10-4-10-6 6z"/>
      <path d="M10 38h25c0-3-3-5-12.5-5S10 35 10 38z"/>
      <path d="M13.5 30h18" fill="none"/>
    </g>, props),
  wR: (props) => svg(
    <g fill={props?.fill ?? W} stroke={S} strokeWidth="1.5" strokeLinejoin="round">
      {/* Crenellations */}
      <path d="M10 12h4v-3h4v3h9v-3h4v3h4v4H10z"/>
      {/* Tower body */}
      <path d="M12 16v15h21V16"/>
      {/* Base */}
      <path d="M9 38h27v-4H9z"/>
      <path d="M11 34v-3h23v3"/>
      <path d="M19 16v15M26 16v15" fill="none" strokeWidth="1"/>
    </g>, props),
  bR: (props) => svg(
    <g fill={props?.fill ?? B} stroke={SL} strokeWidth="1.5" strokeLinejoin="round">
      <path d="M10 12h4v-3h4v3h9v-3h4v3h4v4H10z"/>
      <path d="M12 16v15h21V16"/>
      <path d="M9 38h27v-4H9z"/>
      <path d="M11 34v-3h23v3"/>
      <path d="M19 16v15M26 16v15" fill="none" strokeWidth="1"/>
    </g>, props),
  wB: (props) => svg(
    <g fill={props?.fill ?? W} stroke={S} strokeWidth="1.5" strokeLinejoin="round">
      {/* Pointed mitre */}
      <path d="M22.5 4l-6 14h12z"/>
      <path d="M19.5 13l3-5 3 5" fill="none"/>
      {/* Body */}
      <path d="M14 18c-2 3-3 8-2 13h21c1-5 0-10-2-13l-5.5-1h-6z"/>
      {/* Base */}
      <path d="M10 38c0-3 5-5 12.5-5S35 35 35 38H10z"/>
      <path d="M12 31h21" fill="none"/>
    </g>, props),
  bB: (props) => svg(
    <g fill={props?.fill ?? B} stroke={SL} strokeWidth="1.5" strokeLinejoin="round">
      <path d="M22.5 4l-6 14h12z"/>
      <path d="M19.5 13l3-5 3 5" fill="none"/>
      <path d="M14 18c-2 3-3 8-2 13h21c1-5 0-10-2-13l-5.5-1h-6z"/>
      <path d="M10 38c0-3 5-5 12.5-5S35 35 35 38H10z"/>
      <path d="M12 31h21" fill="none"/>
    </g>, props),
  wN: (props) => svg(
    <g fill={props?.fill ?? W} stroke={S} strokeWidth="1.5" strokeLinejoin="round">
      <path d="M10 38c0-3 5-5 12.5-5S35 35 35 38H10z"/>
      {/* Horse head with mane */}
      <path d="M24 10c0 0-3 1-4 3l-3 6-3 2c-2 1-2 4 0 4h3c-1 4-3 8-5 9h20c-2-4-4-9-4-16 0-4-1-8-4-8z"/>
      {/* Mane detail */}
      <path d="M26 12c2 2 3 5 3 9" fill="none" strokeWidth="1"/>
      {/* Eye */}
      <circle cx="17.5" cy="17" r="1.5" fill={S}/>
      {/* Nostril */}
      <path d="M14 25c1.5-1 3.5-1 5 0" fill="none" strokeWidth="1"/>
      {/* Ear */}
      <path d="M21 8l-2 3 3 1z"/>
    </g>, props),
  bN: (props) => svg(
    <g fill={props?.fill ?? B} stroke={SL} strokeWidth="1.5" strokeLinejoin="round">
      <path d="M10 38c0-3 5-5 12.5-5S35 35 35 38H10z"/>
      <path d="M24 10c0 0-3 1-4 3l-3 6-3 2c-2 1-2 4 0 4h3c-1 4-3 8-5 9h20c-2-4-4-9-4-16 0-4-1-8-4-8z"/>
      <path d="M26 12c2 2 3 5 3 9" fill="none" strokeWidth="1"/>
      <circle cx="17.5" cy="17" r="1.5" fill={SL}/>
      <path d="M14 25c1.5-1 3.5-1 5 0" fill="none" strokeWidth="1"/>
      <path d="M21 8l-2 3 3 1z"/>
    </g>, props),
  wP: (props) => svg(
    <g fill={props?.fill ?? W} stroke={S} strokeWidth="1.5" strokeLinejoin="round">
      {/* Diamond-topped pawn */}
      <path d="M22.5 8l-3 4 3 4 3-4z"/>
      <path d="M17 20c0-2 2.5-4 5.5-4s5.5 2 5.5 4c0 3-2 5-4 7h-3c-2-2-4-4-4-7z"/>
      <path d="M12 38c0-3 4.5-5 10.5-5s10.5 2 10.5 5H12z"/>
      <path d="M16 31h13" fill="none"/>
    </g>, props),
  bP: (props) => svg(
    <g fill={props?.fill ?? B} stroke={SL} strokeWidth="1.5" strokeLinejoin="round">
      <path d="M22.5 8l-3 4 3 4 3-4z"/>
      <path d="M17 20c0-2 2.5-4 5.5-4s5.5 2 5.5 4c0 3-2 5-4 7h-3c-2-2-4-4-4-7z"/>
      <path d="M12 38c0-3 4.5-5 10.5-5s10.5 2 10.5 5H12z"/>
      <path d="M16 31h13" fill="none"/>
    </g>, props),
};
