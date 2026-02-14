// Gothic piece set — ornate medieval-inspired with pointed crowns, crosses, and arch details

export const gothicPieces = {
  wK: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
      <g style={{ fill: props?.fill ?? '#ffffff', stroke: '#000000', strokeWidth: '1.5', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
        {/* Tall ornate cross with flared ends */}
        <path d="M 22.5,2.5 L 22.5,10.5" style={{ fill: 'none', strokeWidth: '2.5' }} />
        <path d="M 18.5,6 L 26.5,6" style={{ fill: 'none', strokeWidth: '2.5' }} />
        {/* Crown with pointed arches */}
        <path d="M 12.5,30 L 10.5,17 L 14,21 L 17,14 L 20,21 L 22.5,12.5 L 25,21 L 28,14 L 31,21 L 34.5,17 L 32.5,30 z" />
        {/* Gothic arch detail on crown */}
        <path d="M 15,26 C 15,22 18,20 22.5,20 C 27,20 30,22 30,26" style={{ fill: 'none', strokeWidth: '1' }} />
        {/* Collar */}
        <path d="M 12.5,30 C 12.5,32 15.5,33.5 22.5,33.5 C 29.5,33.5 32.5,32 32.5,30" style={{ fill: 'none' }} />
        {/* Base with stepped platform */}
        <path d="M 10,39 L 35,39 L 35,37 C 35,35.5 31,34 22.5,34 C 14,34 10,35.5 10,37 z" />
        <path d="M 10.5,38 C 10.5,36.5 15,35 22.5,35 C 30,35 34.5,36.5 34.5,38" style={{ fill: 'none', strokeWidth: '0.8' }} />
      </g>
    </svg>
  ),
  bK: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
      <g style={{ fill: props?.fill ?? '#000000', stroke: '#000000', strokeWidth: '1.5', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
        <path d="M 22.5,2.5 L 22.5,10.5" style={{ fill: 'none', strokeWidth: '2.5' }} />
        <path d="M 18.5,6 L 26.5,6" style={{ fill: 'none', strokeWidth: '2.5' }} />
        <path d="M 12.5,30 L 10.5,17 L 14,21 L 17,14 L 20,21 L 22.5,12.5 L 25,21 L 28,14 L 31,21 L 34.5,17 L 32.5,30 z" />
        <path d="M 15,26 C 15,22 18,20 22.5,20 C 27,20 30,22 30,26" style={{ fill: 'none', stroke: '#ffffff', strokeWidth: '1' }} />
        <path d="M 12.5,30 C 12.5,32 15.5,33.5 22.5,33.5 C 29.5,33.5 32.5,32 32.5,30" style={{ fill: 'none', stroke: '#ffffff' }} />
        <path d="M 10,39 L 35,39 L 35,37 C 35,35.5 31,34 22.5,34 C 14,34 10,35.5 10,37 z" />
        <path d="M 10.5,38 C 10.5,36.5 15,35 22.5,35 C 30,35 34.5,36.5 34.5,38" style={{ fill: 'none', stroke: '#ffffff', strokeWidth: '0.8' }} />
      </g>
    </svg>
  ),
  wQ: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
      <g style={{ fill: props?.fill ?? '#ffffff', stroke: '#000000', strokeWidth: '1.5', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
        {/* Fleur-de-lis crown with spires */}
        <path d="M 22.5,4 L 20.5,8 L 22.5,6 L 24.5,8 z" />
        <path d="M 9,28 L 7,15 L 11,20 L 14.5,10 L 17.5,22 L 22.5,8 L 27.5,22 L 30.5,10 L 34,20 L 38,15 L 36,28 z" />
        {/* Crown jewel dots */}
        <circle cx="7" cy="15" r="2" />
        <circle cx="14.5" cy="10" r="1.8" />
        <circle cx="22.5" cy="4" r="2" />
        <circle cx="30.5" cy="10" r="1.8" />
        <circle cx="38" cy="15" r="2" />
        {/* Body with gothic arch detail */}
        <path d="M 9,28 C 9,30 10,31 12,32 C 12.5,33 12,35 11.5,35.5 C 14,37 18,37.5 22.5,37.5 C 27,37.5 31,37 33.5,35.5 C 33,35 32.5,33 33,32 C 35,31 36,30 36,28" />
        <path d="M 12,31 C 15,30 30,30 33,31" style={{ fill: 'none' }} />
        <path d="M 12.5,34.5 C 16,33.5 29,33.5 32.5,34.5" style={{ fill: 'none' }} />
        {/* Base */}
        <path d="M 10,39 L 35,39 C 35,37.5 30,37 22.5,37 C 15,37 10,37.5 10,39 z" />
      </g>
    </svg>
  ),
  bQ: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
      <g style={{ fill: props?.fill ?? '#000000', stroke: '#000000', strokeWidth: '1.5', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
        <path d="M 22.5,4 L 20.5,8 L 22.5,6 L 24.5,8 z" />
        <path d="M 9,28 L 7,15 L 11,20 L 14.5,10 L 17.5,22 L 22.5,8 L 27.5,22 L 30.5,10 L 34,20 L 38,15 L 36,28 z" />
        <circle cx="7" cy="15" r="2" />
        <circle cx="14.5" cy="10" r="1.8" />
        <circle cx="22.5" cy="4" r="2" />
        <circle cx="30.5" cy="10" r="1.8" />
        <circle cx="38" cy="15" r="2" />
        <path d="M 9,28 C 9,30 10,31 12,32 C 12.5,33 12,35 11.5,35.5 C 14,37 18,37.5 22.5,37.5 C 27,37.5 31,37 33.5,35.5 C 33,35 32.5,33 33,32 C 35,31 36,30 36,28" />
        <path d="M 12,31 C 15,30 30,30 33,31" style={{ fill: 'none', stroke: '#ffffff' }} />
        <path d="M 12.5,34.5 C 16,33.5 29,33.5 32.5,34.5" style={{ fill: 'none', stroke: '#ffffff' }} />
        <path d="M 11,38.5 A 35,35 1 0 0 34,38.5" style={{ fill: 'none', stroke: '#ffffff' }} />
        <path d="M 10,39 L 35,39 C 35,37.5 30,37 22.5,37 C 15,37 10,37.5 10,39 z" />
      </g>
    </svg>
  ),
  wR: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
      <g style={{ fill: props?.fill ?? '#ffffff', stroke: '#000000', strokeWidth: '1.5', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
        {/* Pointed merlons — gothic castle feel */}
        <path d="M 10,15 L 10,8 L 13.5,12 L 17,8 L 17,11 L 20.5,8 L 20.5,11 L 24.5,8 L 24.5,11 L 28,8 L 31.5,12 L 35,8 L 35,15 z" style={{ strokeLinecap: 'butt' }} />
        {/* Tower body */}
        <path d="M 12,15 L 12,30 L 33,30 L 33,15" style={{ strokeLinecap: 'butt' }} />
        {/* Arrow slit details */}
        <path d="M 19,17 L 19,23 M 26,17 L 26,23" style={{ fill: 'none', strokeWidth: '1.2' }} />
        {/* Platform */}
        <path d="M 12,30 L 10.5,32 L 34.5,32 L 33,30" />
        <path d="M 10.5,32 L 10.5,35 L 34.5,35 L 34.5,32" style={{ strokeLinecap: 'butt' }} />
        {/* Base */}
        <path d="M 9,39 L 36,39 L 36,36 L 9,36 z" style={{ strokeLinecap: 'butt' }} />
        <path d="M 9,36 L 10.5,35 M 34.5,35 L 36,36" style={{ fill: 'none' }} />
      </g>
    </svg>
  ),
  bR: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
      <g style={{ fill: props?.fill ?? '#000000', stroke: '#000000', strokeWidth: '1.5', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
        <path d="M 10,15 L 10,8 L 13.5,12 L 17,8 L 17,11 L 20.5,8 L 20.5,11 L 24.5,8 L 24.5,11 L 28,8 L 31.5,12 L 35,8 L 35,15 z" style={{ strokeLinecap: 'butt' }} />
        <path d="M 12,15 L 12,30 L 33,30 L 33,15" style={{ strokeLinecap: 'butt' }} />
        <path d="M 19,17 L 19,23 M 26,17 L 26,23" style={{ fill: 'none', stroke: '#ffffff', strokeWidth: '1.2' }} />
        <path d="M 12,30 L 10.5,32 L 34.5,32 L 33,30" />
        <path d="M 10.5,32 L 10.5,35 L 34.5,35 L 34.5,32" style={{ strokeLinecap: 'butt' }} />
        <path d="M 9,39 L 36,39 L 36,36 L 9,36 z" style={{ strokeLinecap: 'butt' }} />
        <path d="M 12,35.5 L 33,35.5" style={{ fill: 'none', stroke: '#ffffff', strokeWidth: '1' }} />
        <path d="M 11,31.5 L 34,31.5" style={{ fill: 'none', stroke: '#ffffff', strokeWidth: '1' }} />
        <path d="M 12,15 L 33,15" style={{ fill: 'none', stroke: '#ffffff', strokeWidth: '1' }} />
      </g>
    </svg>
  ),
  wB: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
      <g style={{ fill: props?.fill ?? '#ffffff', stroke: '#000000', strokeWidth: '1.5', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
        {/* Pointed mitre top with cross */}
        <path d="M 22.5,4 L 20,6 L 22.5,5 L 25,6 z" />
        <path d="M 22.5,7 L 22.5,4" style={{ fill: 'none', strokeWidth: '1' }} />
        {/* Tall pointed mitre body */}
        <path d="M 22.5,7 C 18,7 15,12 13.5,18 C 12,24 12.5,28 13,30 L 32,30 C 32.5,28 33,24 31.5,18 C 30,12 27,7 22.5,7 z" />
        {/* Gothic arch window detail */}
        <path d="M 19,15 L 22.5,11 L 26,15 M 19,15 C 19,18 20.5,20 22.5,20 C 24.5,20 26,18 26,15" style={{ fill: 'none', strokeWidth: '1' }} />
        {/* Horizontal bands */}
        <path d="M 14,25 L 31,25" style={{ fill: 'none', strokeWidth: '0.8' }} />
        {/* Collar */}
        <path d="M 13,30 L 13,32 C 13,33.5 17,34.5 22.5,34.5 C 28,34.5 32,33.5 32,32 L 32,30" />
        {/* Base */}
        <path d="M 9,39 C 9,36.5 14,35 22.5,35 C 31,35 36,36.5 36,39 z" />
        <path d="M 10,38 C 10,37 15,36 22.5,36 C 30,36 35,37 35,38" style={{ fill: 'none', strokeWidth: '0.8' }} />
      </g>
    </svg>
  ),
  bB: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
      <g style={{ fill: props?.fill ?? '#000000', stroke: '#000000', strokeWidth: '1.5', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
        <path d="M 22.5,4 L 20,6 L 22.5,5 L 25,6 z" />
        <path d="M 22.5,7 L 22.5,4" style={{ fill: 'none', strokeWidth: '1' }} />
        <path d="M 22.5,7 C 18,7 15,12 13.5,18 C 12,24 12.5,28 13,30 L 32,30 C 32.5,28 33,24 31.5,18 C 30,12 27,7 22.5,7 z" />
        <path d="M 19,15 L 22.5,11 L 26,15 M 19,15 C 19,18 20.5,20 22.5,20 C 24.5,20 26,18 26,15" style={{ fill: 'none', stroke: '#ffffff', strokeWidth: '1' }} />
        <path d="M 14,25 L 31,25" style={{ fill: 'none', stroke: '#ffffff', strokeWidth: '0.8' }} />
        <path d="M 13,30 L 13,32 C 13,33.5 17,34.5 22.5,34.5 C 28,34.5 32,33.5 32,32 L 32,30" />
        <path d="M 9,39 C 9,36.5 14,35 22.5,35 C 31,35 36,36.5 36,39 z" />
        <path d="M 10,38 C 10,37 15,36 22.5,36 C 30,36 35,37 35,38" style={{ fill: 'none', stroke: '#ffffff', strokeWidth: '0.8' }} />
      </g>
    </svg>
  ),
  wN: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
      <g style={{ fill: props?.fill ?? '#ffffff', stroke: '#000000', strokeWidth: '1.5', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
        {/* Base */}
        <path d="M 9,39 C 9,36.5 14,35 22.5,35 C 31,35 36,36.5 36,39 z" />
        <path d="M 10,38 C 10,36.5 15,35.5 22.5,35.5 C 30,35.5 35,36.5 35,38" style={{ fill: 'none', strokeWidth: '0.8' }} />
        {/* Armored horse — bold lines, strong jaw */}
        <path d="M 25,10 C 25,10 28,12 29,16 C 30,20 30,26 30,32 L 30,35 L 15,35 C 15,35 14,30 13,27 C 12,24 10,23 10,23 L 10,21 C 10,21 8.5,19 9.5,17 C 10.5,15 12.5,14 12.5,14 C 12.5,14 13.5,11.5 14.5,10 C 15,9.5 16,9 16,9 L 16,7 C 16,7 17,6 18,7 C 18.5,7.5 18,9 18,9 L 20,9 C 20,9 20.5,7 21.5,6.5 C 22.5,6 23.5,7 23.5,7 C 23.5,7 25,8 25,10 z" />
        {/* Mane spikes — gothic feel */}
        <path d="M 25,10 C 26,10.5 27.5,12 28,14" style={{ fill: 'none', strokeWidth: '1.2' }} />
        <path d="M 26.5,14 C 27.5,15 28.5,17 29,19" style={{ fill: 'none', strokeWidth: '1' }} />
        {/* Eye */}
        <circle cx="14.5" cy="17" r="1.5" style={{ fill: '#000000' }} />
        {/* Nostril */}
        <path d="M 10.5,22 C 11.5,21.5 12.5,21.5 13.5,22" style={{ fill: 'none', strokeWidth: '1' }} />
        {/* Bridle detail */}
        <path d="M 13,14 C 13,17 12,20 11,22" style={{ fill: 'none', strokeWidth: '0.8' }} />
      </g>
    </svg>
  ),
  bN: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
      <g style={{ fill: props?.fill ?? '#000000', stroke: '#000000', strokeWidth: '1.5', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
        <path d="M 9,39 C 9,36.5 14,35 22.5,35 C 31,35 36,36.5 36,39 z" />
        <path d="M 10,38 C 10,36.5 15,35.5 22.5,35.5 C 30,35.5 35,36.5 35,38" style={{ fill: 'none', stroke: '#ffffff', strokeWidth: '0.8' }} />
        <path d="M 25,10 C 25,10 28,12 29,16 C 30,20 30,26 30,32 L 30,35 L 15,35 C 15,35 14,30 13,27 C 12,24 10,23 10,23 L 10,21 C 10,21 8.5,19 9.5,17 C 10.5,15 12.5,14 12.5,14 C 12.5,14 13.5,11.5 14.5,10 C 15,9.5 16,9 16,9 L 16,7 C 16,7 17,6 18,7 C 18.5,7.5 18,9 18,9 L 20,9 C 20,9 20.5,7 21.5,6.5 C 22.5,6 23.5,7 23.5,7 C 23.5,7 25,8 25,10 z" />
        <path d="M 25,10 C 26,10.5 27.5,12 28,14" style={{ fill: 'none', stroke: '#ffffff', strokeWidth: '1.2' }} />
        <path d="M 26.5,14 C 27.5,15 28.5,17 29,19" style={{ fill: 'none', stroke: '#ffffff', strokeWidth: '1' }} />
        <circle cx="14.5" cy="17" r="1.5" style={{ fill: '#ffffff' }} />
        <path d="M 10.5,22 C 11.5,21.5 12.5,21.5 13.5,22" style={{ fill: 'none', stroke: '#ffffff', strokeWidth: '1' }} />
        <path d="M 13,14 C 13,17 12,20 11,22" style={{ fill: 'none', stroke: '#ffffff', strokeWidth: '0.8' }} />
      </g>
    </svg>
  ),
  wP: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
      <g style={{ fill: props?.fill ?? '#ffffff', stroke: '#000000', strokeWidth: '1.5', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
        {/* Pointed finial */}
        <path d="M 22.5,7 L 19.5,12 L 25.5,12 z" />
        {/* Body — tapered with gothic waist */}
        <path d="M 18,14 C 17,17 16.5,20 16.5,23 C 16.5,26 17,28 18,30 L 27,30 C 28,28 28.5,26 28.5,23 C 28.5,20 28,17 27,14 z" />
        {/* Collar detail */}
        <path d="M 18,14 L 27,14" style={{ fill: 'none', strokeWidth: '0.8' }} />
        {/* Base */}
        <path d="M 13,30 L 13,32 C 13,33.5 17,34.5 22.5,34.5 C 28,34.5 32,33.5 32,32 L 32,30 z" />
        <path d="M 10,39 C 10,36.5 15,35 22.5,35 C 30,35 35,36.5 35,39 z" />
      </g>
    </svg>
  ),
  bP: (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
      <g style={{ fill: props?.fill ?? '#000000', stroke: '#000000', strokeWidth: '1.5', strokeLinecap: 'round', strokeLinejoin: 'round' }}>
        <path d="M 22.5,7 L 19.5,12 L 25.5,12 z" />
        <path d="M 18,14 C 17,17 16.5,20 16.5,23 C 16.5,26 17,28 18,30 L 27,30 C 28,28 28.5,26 28.5,23 C 28.5,20 28,17 27,14 z" />
        <path d="M 18,14 L 27,14" style={{ fill: 'none', stroke: '#ffffff', strokeWidth: '0.8' }} />
        <path d="M 13,30 L 13,32 C 13,33.5 17,34.5 22.5,34.5 C 28,34.5 32,33.5 32,32 L 32,30 z" />
        <path d="M 10,39 C 10,36.5 15,35 22.5,35 C 30,35 35,36.5 35,39 z" />
        <path d="M 10.5,38 C 11,37 15.5,36 22.5,36 C 29.5,36 34,37 34.5,38" style={{ fill: 'none', stroke: '#ffffff', strokeWidth: '0.8' }} />
      </g>
    </svg>
  ),
};
