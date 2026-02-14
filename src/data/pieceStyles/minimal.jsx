// Minimal piece set — ultra-simple flat silhouettes, no stroke
const W = '#f0f0f0';
const B = '#2a2a3a';

function svg(children, props) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
      {children}
    </svg>
  );
}

export const minimalPieces = {
  wK: (props) => svg(
    <g fill={props?.fill ?? W}>
      <rect x="20" y="3" width="5" height="8" rx="1"/>
      <rect x="17" y="5.5" width="11" height="3" rx="1"/>
      <path d="M10 38h25L32 18H13z"/>
      <rect x="8" y="36" width="29" height="4" rx="1.5"/>
    </g>, props),
  bK: (props) => svg(
    <g fill={props?.fill ?? B}>
      <rect x="20" y="3" width="5" height="8" rx="1"/>
      <rect x="17" y="5.5" width="11" height="3" rx="1"/>
      <path d="M10 38h25L32 18H13z"/>
      <rect x="8" y="36" width="29" height="4" rx="1.5"/>
    </g>, props),
  wQ: (props) => svg(
    <g fill={props?.fill ?? W}>
      <circle cx="22.5" cy="6" r="4"/>
      <path d="M10 38h25L32 16H13z"/>
      <rect x="8" y="36" width="29" height="4" rx="1.5"/>
    </g>, props),
  bQ: (props) => svg(
    <g fill={props?.fill ?? B}>
      <circle cx="22.5" cy="6" r="4"/>
      <path d="M10 38h25L32 16H13z"/>
      <rect x="8" y="36" width="29" height="4" rx="1.5"/>
    </g>, props),
  wR: (props) => svg(
    <g fill={props?.fill ?? W}>
      <rect x="11" y="10" width="5" height="5"/><rect x="20" y="10" width="5" height="5"/><rect x="29" y="10" width="5" height="5"/>
      <rect x="13" y="15" width="19" height="21"/>
      <rect x="9" y="34" width="27" height="6" rx="1.5"/>
    </g>, props),
  bR: (props) => svg(
    <g fill={props?.fill ?? B}>
      <rect x="11" y="10" width="5" height="5"/><rect x="20" y="10" width="5" height="5"/><rect x="29" y="10" width="5" height="5"/>
      <rect x="13" y="15" width="19" height="21"/>
      <rect x="9" y="34" width="27" height="6" rx="1.5"/>
    </g>, props),
  wB: (props) => svg(
    <g fill={props?.fill ?? W}>
      <path d="M22.5 4l-8 20h16z"/>
      <ellipse cx="22.5" cy="30" rx="10" ry="4"/>
      <rect x="10" y="35" width="25" height="5" rx="1.5"/>
    </g>, props),
  bB: (props) => svg(
    <g fill={props?.fill ?? B}>
      <path d="M22.5 4l-8 20h16z"/>
      <ellipse cx="22.5" cy="30" rx="10" ry="4"/>
      <rect x="10" y="35" width="25" height="5" rx="1.5"/>
    </g>, props),
  wN: (props) => svg(
    <g fill={props?.fill ?? W}>
      <path d="M14 38h18c-2-6-3-14-3-20 0-5-2-8-5-10l-6 5-4 7c0 0 2 2 4 1 0 5-2 11-4 17z"/>
      <rect x="10" y="36" width="25" height="4" rx="1.5"/>
    </g>, props),
  bN: (props) => svg(
    <g fill={props?.fill ?? B}>
      <path d="M14 38h18c-2-6-3-14-3-20 0-5-2-8-5-10l-6 5-4 7c0 0 2 2 4 1 0 5-2 11-4 17z"/>
      <rect x="10" y="36" width="25" height="4" rx="1.5"/>
    </g>, props),
  wP: (props) => svg(
    <g fill={props?.fill ?? W}>
      <circle cx="22.5" cy="14" r="6"/>
      <path d="M16 38h13c0-4-2-8-3-12h-7c-1 4-3 8-3 12z"/>
      <rect x="12" y="36" width="21" height="4" rx="1.5"/>
    </g>, props),
  bP: (props) => svg(
    <g fill={props?.fill ?? B}>
      <circle cx="22.5" cy="14" r="6"/>
      <path d="M16 38h13c0-4-2-8-3-12h-7c-1 4-3 8-3 12z"/>
      <rect x="12" y="36" width="21" height="4" rx="1.5"/>
    </g>, props),
};
