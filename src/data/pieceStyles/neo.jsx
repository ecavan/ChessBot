// Neo piece set — modern, geometric, clean shapes with rounded forms
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

export const neoPieces = {
  wK: (props) => svg(
    <g fill={props?.fill ?? W} stroke={S} strokeWidth="1.5" strokeLinejoin="round">
      <path d="M22.5 5v6M19.5 8h6" strokeWidth="2"/>
      <path d="M22.5 13c-4 0-7 3-10 6-3 3-4 7-4 10 0 3 2 6 5 8h18c3-2 5-5 5-8 0-3-1-7-4-10-3-3-6-6-10-6z"/>
      <path d="M12.5 37c0-4 4-6 10-6s10 2 10 6" fill="none"/>
    </g>, props),
  bK: (props) => svg(
    <g fill={props?.fill ?? B} stroke={SL} strokeWidth="1.5" strokeLinejoin="round">
      <path d="M22.5 5v6M19.5 8h6" strokeWidth="2"/>
      <path d="M22.5 13c-4 0-7 3-10 6-3 3-4 7-4 10 0 3 2 6 5 8h18c3-2 5-5 5-8 0-3-1-7-4-10-3-3-6-6-10-6z"/>
      <path d="M12.5 37c0-4 4-6 10-6s10 2 10 6" fill="none"/>
    </g>, props),
  wQ: (props) => svg(
    <g fill={props?.fill ?? W} stroke={S} strokeWidth="1.5" strokeLinejoin="round">
      <circle cx="22.5" cy="7" r="3"/>
      <path d="M9 37h27L33 17l-5 8-5.5-10L17 25l-5-8z"/>
      <path d="M9 37c0-2 4-4 13.5-4S36 35 36 37" fill="none"/>
      <circle cx="9" cy="17" r="2"/><circle cx="36" cy="17" r="2"/>
      <circle cx="17" cy="10" r="2"/><circle cx="28" cy="10" r="2"/>
    </g>, props),
  bQ: (props) => svg(
    <g fill={props?.fill ?? B} stroke={SL} strokeWidth="1.5" strokeLinejoin="round">
      <circle cx="22.5" cy="7" r="3"/>
      <path d="M9 37h27L33 17l-5 8-5.5-10L17 25l-5-8z"/>
      <path d="M9 37c0-2 4-4 13.5-4S36 35 36 37" fill="none"/>
      <circle cx="9" cy="17" r="2"/><circle cx="36" cy="17" r="2"/>
      <circle cx="17" cy="10" r="2"/><circle cx="28" cy="10" r="2"/>
    </g>, props),
  wR: (props) => svg(
    <g fill={props?.fill ?? W} stroke={S} strokeWidth="1.5" strokeLinejoin="round">
      <path d="M10 39h25v-4H10zM11 35v-5h23v5M13 30V16h3v3h4v-3h5v3h4v-3h3v14"/>
      <path d="M13 16h19v-3H13z"/>
    </g>, props),
  bR: (props) => svg(
    <g fill={props?.fill ?? B} stroke={SL} strokeWidth="1.5" strokeLinejoin="round">
      <path d="M10 39h25v-4H10zM11 35v-5h23v5M13 30V16h3v3h4v-3h5v3h4v-3h3v14"/>
      <path d="M13 16h19v-3H13z"/>
    </g>, props),
  wB: (props) => svg(
    <g fill={props?.fill ?? W} stroke={S} strokeWidth="1.5" strokeLinejoin="round">
      <path d="M10 38c0-2 5-4 12.5-4S35 36 35 38H10z"/>
      <path d="M15 32c-1-3 0-7 3-11 2-3 5-5 5-9 0-1-.5-2-.5-2 3 0 5 2 5 5 0 4-3 6-5 9-3 4-4 8-3 11"/>
      <circle cx="22.5" cy="8" r="3"/>
      <path d="M15 32h15" fill="none"/>
    </g>, props),
  bB: (props) => svg(
    <g fill={props?.fill ?? B} stroke={SL} strokeWidth="1.5" strokeLinejoin="round">
      <path d="M10 38c0-2 5-4 12.5-4S35 36 35 38H10z"/>
      <path d="M15 32c-1-3 0-7 3-11 2-3 5-5 5-9 0-1-.5-2-.5-2 3 0 5 2 5 5 0 4-3 6-5 9-3 4-4 8-3 11"/>
      <circle cx="22.5" cy="8" r="3"/>
      <path d="M15 32h15" fill="none"/>
    </g>, props),
  wN: (props) => svg(
    <g fill={props?.fill ?? W} stroke={S} strokeWidth="1.5" strokeLinejoin="round">
      <path d="M10 38c0-2 4-4 12.5-4S35 36 35 38H10z"/>
      <path d="M22 10c-2 0-3 3-3 3l-4 7c-1 2 0 4 2 4h3c0 4-2 8-4 10h16c-3-3-5-7-5-14 0-5-2-10-5-10z"/>
      <circle cx="18" cy="16" r="1.5" fill={S}/>
      <path d="M16 22c1-1 3-1 4 0" fill="none"/>
    </g>, props),
  bN: (props) => svg(
    <g fill={props?.fill ?? B} stroke={SL} strokeWidth="1.5" strokeLinejoin="round">
      <path d="M10 38c0-2 4-4 12.5-4S35 36 35 38H10z"/>
      <path d="M22 10c-2 0-3 3-3 3l-4 7c-1 2 0 4 2 4h3c0 4-2 8-4 10h16c-3-3-5-7-5-14 0-5-2-10-5-10z"/>
      <circle cx="18" cy="16" r="1.5" fill={SL}/>
      <path d="M16 22c1-1 3-1 4 0" fill="none"/>
    </g>, props),
  wP: (props) => svg(
    <g fill={props?.fill ?? W} stroke={S} strokeWidth="1.5" strokeLinejoin="round">
      <circle cx="22.5" cy="13" r="5"/>
      <path d="M14 38c0-3 4-5 8.5-5s8.5 2 8.5 5H14z"/>
      <path d="M17.5 26c0-3 2-5 5-5s5 2 5 5c0 2-1.5 4-3 5h-4c-1.5-1-3-3-3-5z"/>
    </g>, props),
  bP: (props) => svg(
    <g fill={props?.fill ?? B} stroke={SL} strokeWidth="1.5" strokeLinejoin="round">
      <circle cx="22.5" cy="13" r="5"/>
      <path d="M14 38c0-3 4-5 8.5-5s8.5 2 8.5 5H14z"/>
      <path d="M17.5 26c0-3 2-5 5-5s5 2 5 5c0 2-1.5 4-3 5h-4c-1.5-1-3-3-3-5z"/>
    </g>, props),
};
