// Minimal piece set — ultra-clean flat silhouettes, no strokes
// Inspired by modern icon design. Instantly recognizable solid shapes.

const W = '#e8e8e8';
const B = '#1a1a2e';

export const minimalPieces = {
  wK: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
      <g fill={props?.fill ?? W} fillRule="evenodd">
        {/* Cross */}
        <rect x="20.5" y="3" width="4" height="9" rx="1" />
        <rect x="17.5" y="5" width="10" height="4" rx="1" />
        {/* Crown dome */}
        <path d="M 22.5,13 C 17.5,13 14,16 12.5,20 C 11,24 11,28 11,30 L 34,30 C 34,28 34,24 32.5,20 C 31,16 27.5,13 22.5,13 z" />
        {/* Base */}
        <rect x="9" y="32" width="27" height="3" rx="1" />
        <path d="M 10,36 L 35,36 L 35,39.5 C 35,40.3 34.3,41 33.5,41 L 11.5,41 C 10.7,41 10,40.3 10,39.5 z" />
      </g>
    </svg>
  ),
  bK: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
      <g fill={props?.fill ?? B} fillRule="evenodd">
        <rect x="20.5" y="3" width="4" height="9" rx="1" />
        <rect x="17.5" y="5" width="10" height="4" rx="1" />
        <path d="M 22.5,13 C 17.5,13 14,16 12.5,20 C 11,24 11,28 11,30 L 34,30 C 34,28 34,24 32.5,20 C 31,16 27.5,13 22.5,13 z" />
        <rect x="9" y="32" width="27" height="3" rx="1" />
        <path d="M 10,36 L 35,36 L 35,39.5 C 35,40.3 34.3,41 33.5,41 L 11.5,41 C 10.7,41 10,40.3 10,39.5 z" />
      </g>
    </svg>
  ),
  wQ: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
      <g fill={props?.fill ?? W} fillRule="evenodd">
        {/* Crown ball */}
        <circle cx="22.5" cy="7" r="3.5" />
        {/* Crown body with smooth points */}
        <path d="M 9,28 L 7.5,14 L 13,23 L 14.5,11 L 19,23 L 22.5,10 L 26,23 L 30.5,11 L 32,23 L 37.5,14 L 36,28 C 36,28 30,27 22.5,27 C 15,27 9,28 9,28 z" />
        {/* Body */}
        <path d="M 9,28 C 9,31 10,33 11,34 L 34,34 C 35,33 36,31 36,28" />
        {/* Base */}
        <rect x="9" y="35" width="27" height="2.5" rx="1" />
        <path d="M 10,38 L 35,38 L 35,40.5 C 35,41.3 34.3,42 33.5,42 L 11.5,42 C 10.7,42 10,41.3 10,40.5 z" />
      </g>
    </svg>
  ),
  bQ: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
      <g fill={props?.fill ?? B} fillRule="evenodd">
        <circle cx="22.5" cy="7" r="3.5" />
        <path d="M 9,28 L 7.5,14 L 13,23 L 14.5,11 L 19,23 L 22.5,10 L 26,23 L 30.5,11 L 32,23 L 37.5,14 L 36,28 C 36,28 30,27 22.5,27 C 15,27 9,28 9,28 z" />
        <path d="M 9,28 C 9,31 10,33 11,34 L 34,34 C 35,33 36,31 36,28" />
        <rect x="9" y="35" width="27" height="2.5" rx="1" />
        <path d="M 10,38 L 35,38 L 35,40.5 C 35,41.3 34.3,42 33.5,42 L 11.5,42 C 10.7,42 10,41.3 10,40.5 z" />
      </g>
    </svg>
  ),
  wR: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
      <g fill={props?.fill ?? W} fillRule="evenodd">
        {/* Crenellations */}
        <path d="M 11,9 L 11,14 L 15,14 L 15,11 L 20,11 L 20,14 L 25,14 L 25,11 L 30,11 L 30,14 L 34,14 L 34,9 z" />
        {/* Tower body */}
        <rect x="13" y="14" width="19" height="16" />
        {/* Platform */}
        <rect x="11" y="30" width="23" height="3" rx="0.5" />
        {/* Base */}
        <rect x="9" y="34" width="27" height="3" rx="1" />
        <path d="M 10,38 L 35,38 L 35,40 C 35,40.5 34.5,41 34,41 L 11,41 C 10.5,41 10,40.5 10,40 z" />
      </g>
    </svg>
  ),
  bR: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
      <g fill={props?.fill ?? B} fillRule="evenodd">
        <path d="M 11,9 L 11,14 L 15,14 L 15,11 L 20,11 L 20,14 L 25,14 L 25,11 L 30,11 L 30,14 L 34,14 L 34,9 z" />
        <rect x="13" y="14" width="19" height="16" />
        <rect x="11" y="30" width="23" height="3" rx="0.5" />
        <rect x="9" y="34" width="27" height="3" rx="1" />
        <path d="M 10,38 L 35,38 L 35,40 C 35,40.5 34.5,41 34,41 L 11,41 C 10.5,41 10,40.5 10,40 z" />
      </g>
    </svg>
  ),
  wB: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
      <g fill={props?.fill ?? W} fillRule="evenodd">
        {/* Top ball */}
        <circle cx="22.5" cy="8" r="3" />
        {/* Mitre body — smooth teardrop */}
        <path d="M 22.5,11 C 18.5,11 15.5,16 14,22 C 12.5,28 13,31 13,31 L 32,31 C 32,31 32.5,28 31,22 C 29.5,16 26.5,11 22.5,11 z" />
        {/* Collar */}
        <rect x="12" y="31" width="21" height="3" rx="1" />
        {/* Base */}
        <path d="M 9,39 C 9,36 14,34.5 22.5,34.5 C 31,34.5 36,36 36,39 L 36,40 C 36,40.5 35.5,41 35,41 L 10,41 C 9.5,41 9,40.5 9,40 z" />
      </g>
    </svg>
  ),
  bB: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
      <g fill={props?.fill ?? B} fillRule="evenodd">
        <circle cx="22.5" cy="8" r="3" />
        <path d="M 22.5,11 C 18.5,11 15.5,16 14,22 C 12.5,28 13,31 13,31 L 32,31 C 32,31 32.5,28 31,22 C 29.5,16 26.5,11 22.5,11 z" />
        <rect x="12" y="31" width="21" height="3" rx="1" />
        <path d="M 9,39 C 9,36 14,34.5 22.5,34.5 C 31,34.5 36,36 36,39 L 36,40 C 36,40.5 35.5,41 35,41 L 10,41 C 9.5,41 9,40.5 9,40 z" />
      </g>
    </svg>
  ),
  wN: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
      <g fill={props?.fill ?? W} fillRule="evenodd">
        {/* Horse silhouette */}
        <path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18 L 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10 z" />
        {/* Eye */}
        <circle cx="10" cy="25.5" r="1" fill="#1a1a2e" />
      </g>
    </svg>
  ),
  bN: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
      <g fill={props?.fill ?? B} fillRule="evenodd">
        <path d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18 L 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10 z" />
        <circle cx="10" cy="25.5" r="1" fill="#e8e8e8" />
      </g>
    </svg>
  ),
  wP: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
      <path d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 L 34,39.5 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z" fill={props?.fill ?? W} />
    </svg>
  ),
  bP: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
      <path d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 L 34,39.5 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z" fill={props?.fill ?? B} />
    </svg>
  ),
};
