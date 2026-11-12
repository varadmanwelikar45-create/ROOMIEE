import React from 'react';

interface CityBuildingsProps {
  className?: string;
}

export const CityBuildings: React.FC<CityBuildingsProps> = ({ className = '' }) => {
  return (
    <div className={`pointer-events-none select-none fixed inset-x-0 bottom-0 z-0 overflow-hidden ${className}`}>
      
      {/* ===================== BOTTOM LEFT BUILDINGS ===================== */}
      <div className="absolute bottom-0 left-0 w-48 sm:w-72 md:w-88 lg:w-96 transition-all duration-300 opacity-35 sm:opacity-55 lg:opacity-75">
        <svg
          viewBox="0 0 380 320"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)]"
          preserveAspectRatio="xMinYMax meet"
        >
          <defs>
            {/* Ambient gradients */}
            <linearGradient id="bl-tower-dark" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2c2c2c" />
              <stop offset="100%" stopColor="#1a1a1a" />
            </linearGradient>
            <linearGradient id="bl-tower-mid" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#383838" />
              <stop offset="100%" stopColor="#1e1e1e" />
            </linearGradient>
            <linearGradient id="bl-tower-front" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#444444" />
              <stop offset="100%" stopColor="#222222" />
            </linearGradient>
            <linearGradient id="bl-window-glow" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFD43B" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#FFA000" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="bl-window-dim" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#757575" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#424242" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="bl-fade-bottom" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="70%" stopColor="transparent" />
              <stop offset="100%" stopColor="#242424" />
            </linearGradient>
          </defs>

          {/* 1. BACKGROUND SILHOUETTE TOWERS */}
          {/* Far background tall slim tower */}
          <rect x="50" y="30" width="55" height="290" rx="2" fill="#1d1d1d" />
          {/* Antenna mast */}
          <line x1="77" y1="5" x2="77" y2="30" stroke="#FFD43B" strokeWidth="1.5" strokeOpacity="0.8" />
          <circle cx="77" cy="5" r="2.5" fill="#FFD43B" />
          {/* Background rooftop tank */}
          <rect x="62" y="22" width="30" height="8" rx="1" fill="#2d2d2d" />
          {/* Background tower lit windows */}
          <g fill="#FFD43B" fillOpacity="0.35">
            <rect x="58" y="45" width="5" height="4" rx="0.5" />
            <rect x="70" y="45" width="5" height="4" rx="0.5" />
            <rect x="82" y="45" width="5" height="4" rx="0.5" />
            <rect x="94" y="45" width="5" height="4" rx="0.5" />
            <rect x="70" y="65" width="5" height="4" rx="0.5" />
            <rect x="82" y="65" width="5" height="4" rx="0.5" />
            <rect x="58" y="85" width="5" height="4" rx="0.5" />
            <rect x="94" y="85" width="5" height="4" rx="0.5" />
            <rect x="70" y="105" width="5" height="4" rx="0.5" />
            <rect x="82" y="105" width="5" height="4" rx="0.5" />
          </g>

          {/* Far left modern block */}
          <path d="M0 120 L35 105 L35 320 L0 320 Z" fill="#202020" />
          <g fill="#B8B8B8" fillOpacity="0.2">
            <rect x="6" y="130" width="8" height="6" rx="0.5" />
            <rect x="18" y="130" width="8" height="6" rx="0.5" />
            <rect x="6" y="150" width="8" height="6" rx="0.5" />
            <rect x="18" y="150" width="8" height="6" rx="0.5" />
            <rect x="6" y="170" width="8" height="6" rx="0.5" />
            <rect x="18" y="170" width="8" height="6" rx="0.5" />
          </g>

          {/* 2. MIDGROUND RESIDENTIAL APARTMENTS */}
          {/* Main Mid-Rise Apartment Tower (Koramangala/Indiranagar style) */}
          <rect x="110" y="70" width="85" height="250" rx="3" fill="url(#bl-tower-mid)" stroke="#3a3a3a" strokeWidth="1" />
          
          {/* Rooftop pergola / terrace garden */}
          <line x1="115" y1="65" x2="190" y2="65" stroke="#FFD43B" strokeWidth="2" strokeOpacity="0.7" />
          <line x1="120" y1="65" x2="120" y2="70" stroke="#FFD43B" strokeWidth="1.5" strokeOpacity="0.7" />
          <line x1="135" y1="65" x2="135" y2="70" stroke="#FFD43B" strokeWidth="1.5" strokeOpacity="0.7" />
          <line x1="150" y1="65" x2="150" y2="70" stroke="#FFD43B" strokeWidth="1.5" strokeOpacity="0.7" />
          <line x1="165" y1="65" x2="165" y2="70" stroke="#FFD43B" strokeWidth="1.5" strokeOpacity="0.7" />
          <line x1="180" y1="65" x2="180" y2="70" stroke="#FFD43B" strokeWidth="1.5" strokeOpacity="0.7" />

          {/* Vertical facade architectural groove */}
          <line x1="152" y1="70" x2="152" y2="320" stroke="#252525" strokeWidth="2" />

          {/* Balconies & Windows with warm Roomie lights */}
          {/* Floor 7 */}
          <rect x="118" y="85" width="28" height="12" rx="1" fill="url(#bl-window-glow)" />
          <rect x="158" y="85" width="28" height="12" rx="1" fill="url(#bl-window-dim)" />
          {/* Floor 6 */}
          <rect x="118" y="110" width="28" height="12" rx="1" fill="url(#bl-window-dim)" />
          <rect x="158" y="110" width="28" height="12" rx="1" fill="url(#bl-window-glow)" />
          <line x1="156" y1="120" x2="188" y2="120" stroke="#FFD43B" strokeWidth="1.5" />
          {/* Floor 5 */}
          <rect x="118" y="135" width="28" height="12" rx="1" fill="url(#bl-window-glow)" />
          <line x1="116" y1="145" x2="148" y2="145" stroke="#FFD43B" strokeWidth="1.5" />
          <rect x="158" y="135" width="28" height="12" rx="1" fill="url(#bl-window-glow)" />
          {/* Floor 4 */}
          <rect x="118" y="160" width="28" height="12" rx="1" fill="url(#bl-window-dim)" />
          <rect x="158" y="160" width="28" height="12" rx="1" fill="url(#bl-window-dim)" />
          {/* Floor 3 */}
          <rect x="118" y="185" width="28" height="12" rx="1" fill="url(#bl-window-glow)" />
          <rect x="158" y="185" width="28" height="12" rx="1" fill="url(#bl-window-glow)" />

          {/* Stepped Condominium Tower */}
          <path d="M200 130 L260 130 L260 160 L285 160 L285 320 L200 320 Z" fill="url(#bl-tower-dark)" stroke="#333333" strokeWidth="1" />
          <rect x="210" y="122" width="35" height="8" rx="1" fill="#444444" />
          {/* Stepped condo windows */}
          <g fill="#FFD43B" fillOpacity="0.8">
            <rect x="212" y="142" width="10" height="8" rx="1" />
            <rect x="230" y="142" width="10" height="8" rx="1" />
            <rect x="212" y="172" width="10" height="8" rx="1" />
            <rect x="245" y="172" width="10" height="8" rx="1" />
            <rect x="265" y="172" width="10" height="8" rx="1" />
          </g>
          <g fill="#616161" fillOpacity="0.4">
            <rect x="212" y="200" width="10" height="8" rx="1" />
            <rect x="230" y="200" width="10" height="8" rx="1" />
            <rect x="248" y="200" width="10" height="8" rx="1" />
            <rect x="265" y="200" width="10" height="8" rx="1" />
          </g>

          {/* 3. FOREGROUND MODERN RESIDENTIAL APARTMENTS */}
          {/* Front urban apartment block with prominent balconies */}
          <rect x="20" y="150" width="85" height="170" rx="3" fill="url(#bl-tower-front)" stroke="#4d4d4d" strokeWidth="1" />
          {/* Architectural roof cap */}
          <rect x="15" y="145" width="95" height="5" rx="1.5" fill="#FFD43B" fillOpacity="0.85" />
          
          {/* Balcony cantilevers */}
          <rect x="28" y="165" width="32" height="15" rx="1" fill="url(#bl-window-glow)" />
          <line x1="26" y1="178" x2="62" y2="178" stroke="#F5F5F5" strokeWidth="1.5" />
          <rect x="66" y="165" width="30" height="15" rx="1" fill="url(#bl-window-dim)" />

          <rect x="28" y="195" width="32" height="15" rx="1" fill="url(#bl-window-dim)" />
          <rect x="66" y="195" width="30" height="15" rx="1" fill="url(#bl-window-glow)" />
          <line x1="64" y1="208" x2="98" y2="208" stroke="#F5F5F5" strokeWidth="1.5" />

          <rect x="28" y="225" width="32" height="15" rx="1" fill="url(#bl-window-glow)" />
          <rect x="66" y="225" width="30" height="15" rx="1" fill="url(#bl-window-glow)" />

          {/* Front Corner Building (low-rise townhouse / society clubhouse) */}
          <rect x="90" y="210" width="90" height="110" rx="3" fill="#2d2d2d" stroke="#444444" strokeWidth="1" />
          <line x1="88" y1="207" x2="182" y2="207" stroke="#FFD43B" strokeWidth="2" />
          {/* Glass entrance lobby with warm glow */}
          <rect x="100" y="225" width="70" height="24" rx="2" fill="url(#bl-window-glow)" fillOpacity="0.85" />
          <line x1="135" y1="225" x2="135" y2="249" stroke="#333333" strokeWidth="1.5" />

          {/* Ground trees / foliage silhouettes */}
          <circle cx="15" cy="305" r="14" fill="#1b2a1e" stroke="#2e4233" strokeWidth="1" />
          <circle cx="95" cy="310" r="12" fill="#1b2a1e" stroke="#2e4233" strokeWidth="1" />
          <circle cx="185" cy="308" r="16" fill="#1b2a1e" stroke="#2e4233" strokeWidth="1" />
          <circle cx="280" cy="312" r="11" fill="#1b2a1e" />

          {/* Bottom subtle blending gradient */}
          <rect x="0" y="270" width="380" height="50" fill="url(#bl-fade-bottom)" />
        </svg>
      </div>


      {/* ===================== BOTTOM RIGHT BUILDINGS ===================== */}
      <div className="absolute bottom-0 right-0 w-48 sm:w-72 md:w-88 lg:w-96 transition-all duration-300 opacity-35 sm:opacity-55 lg:opacity-75">
        <svg
          viewBox="0 0 380 320"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto drop-shadow-[0_10px_25px_rgba(0,0,0,0.8)]"
          preserveAspectRatio="xMaxYMax meet"
        >
          <defs>
            {/* Ambient gradients */}
            <linearGradient id="br-tower-dark" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2c2c2c" />
              <stop offset="100%" stopColor="#1a1a1a" />
            </linearGradient>
            <linearGradient id="br-tower-mid" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#383838" />
              <stop offset="100%" stopColor="#1e1e1e" />
            </linearGradient>
            <linearGradient id="br-tower-front" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#444444" />
              <stop offset="100%" stopColor="#222222" />
            </linearGradient>
            <linearGradient id="br-window-glow" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFD43B" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#FFA000" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="br-window-dim" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#757575" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#424242" stopOpacity="0.2" />
            </linearGradient>
            <linearGradient id="br-fade-bottom" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="70%" stopColor="transparent" />
              <stop offset="100%" stopColor="#242424" />
            </linearGradient>
          </defs>

          {/* 1. BACKGROUND METRO SKYSCRAPER (High-tech / Modern High-Rise) */}
          {/* Angled geometric roof tower */}
          <path d="M225 35 L280 15 L280 320 L225 320 Z" fill="#1b1b1b" />
          {/* Tower Antenna spire with flashing beacon */}
          <line x1="280" y1="0" x2="280" y2="15" stroke="#FFD43B" strokeWidth="2" />
          <circle cx="280" cy="2" r="3" fill="#FFD43B" />
          <circle cx="280" cy="2" r="6" fill="#FFD43B" fillOpacity="0.3" className="animate-pulse" />

          {/* High-rise vertical window strips */}
          <g fill="#FFD43B" fillOpacity="0.4">
            <rect x="235" y="45" width="6" height="5" rx="0.5" />
            <rect x="246" y="45" width="6" height="5" rx="0.5" />
            <rect x="257" y="45" width="6" height="5" rx="0.5" />
            <rect x="268" y="45" width="6" height="5" rx="0.5" />
            <rect x="235" y="65" width="6" height="5" rx="0.5" />
            <rect x="257" y="65" width="6" height="5" rx="0.5" />
            <rect x="246" y="85" width="6" height="5" rx="0.5" />
            <rect x="268" y="85" width="6" height="5" rx="0.5" />
            <rect x="235" y="105" width="6" height="5" rx="0.5" />
            <rect x="246" y="105" width="6" height="5" rx="0.5" />
          </g>

          {/* Far right tower */}
          <rect x="330" y="80" width="50" height="240" fill="#202020" />
          <line x1="355" y1="65" x2="355" y2="80" stroke="#FFD43B" strokeWidth="1.5" strokeOpacity="0.7" />
          <circle cx="355" cy="65" r="2" fill="#FFD43B" />
          <g fill="#757575" fillOpacity="0.3">
            <rect x="340" y="95" width="8" height="6" rx="0.5" />
            <rect x="355" y="95" width="8" height="6" rx="0.5" />
            <rect x="340" y="115" width="8" height="6" rx="0.5" />
            <rect x="355" y="115" width="8" height="6" rx="0.5" />
            <rect x="340" y="135" width="8" height="6" rx="0.5" />
            <rect x="355" y="135" width="8" height="6" rx="0.5" />
          </g>

          {/* 2. MIDGROUND LUXURY RESIDENTIAL HIGH-RISE */}
          {/* Main residential apartment building with cantilevered glass balconies */}
          <rect x="135" y="60" width="85" height="260" rx="3" fill="url(#br-tower-mid)" stroke="#3b3b3b" strokeWidth="1" />
          
          {/* Crown & Solar Panels */}
          <rect x="145" y="52" width="65" height="8" rx="1.5" fill="#2d2d2d" stroke="#FFD43B" strokeWidth="1" strokeOpacity="0.8" />
          
          {/* Balconies & Windows */}
          {/* Floor 7 */}
          <rect x="145" y="75" width="30" height="13" rx="1" fill="url(#br-window-glow)" />
          <rect x="182" y="75" width="30" height="13" rx="1" fill="url(#br-window-dim)" />
          <line x1="143" y1="88" x2="177" y2="88" stroke="#FFD43B" strokeWidth="1.5" />
          {/* Floor 6 */}
          <rect x="145" y="100" width="30" height="13" rx="1" fill="url(#br-window-dim)" />
          <rect x="182" y="100" width="30" height="13" rx="1" fill="url(#br-window-glow)" />
          <line x1="180" y1="113" x2="214" y2="113" stroke="#FFD43B" strokeWidth="1.5" />
          {/* Floor 5 */}
          <rect x="145" y="125" width="30" height="13" rx="1" fill="url(#br-window-glow)" />
          <rect x="182" y="125" width="30" height="13" rx="1" fill="url(#br-window-glow)" />
          {/* Floor 4 */}
          <rect x="145" y="150" width="30" height="13" rx="1" fill="url(#br-window-glow)" />
          <line x1="143" y1="163" x2="177" y2="163" stroke="#FFD43B" strokeWidth="1.5" />
          <rect x="182" y="150" width="30" height="13" rx="1" fill="url(#br-window-dim)" />
          {/* Floor 3 */}
          <rect x="145" y="175" width="30" height="13" rx="1" fill="url(#br-window-dim)" />
          <rect x="182" y="175" width="30" height="13" rx="1" fill="url(#br-window-glow)" />
          <line x1="180" y1="188" x2="214" y2="188" stroke="#FFD43B" strokeWidth="1.5" />

          {/* Stepped Urban Tower */}
          <path d="M75 160 L105 160 L105 130 L135 130 L135 320 L75 320 Z" fill="url(#br-tower-dark)" stroke="#383838" strokeWidth="1" />
          <g fill="#FFD43B" fillOpacity="0.75">
            <rect x="110" y="142" width="18" height="10" rx="1" />
            <rect x="85" y="175" width="16" height="10" rx="1" />
            <rect x="110" y="175" width="18" height="10" rx="1" />
          </g>
          <g fill="#757575" fillOpacity="0.3">
            <rect x="85" y="200" width="16" height="10" rx="1" />
            <rect x="110" y="200" width="18" height="10" rx="1" />
          </g>

          {/* 3. FOREGROUND APARTMENT BLOCKS */}
          {/* Modern co-living apartment block right */}
          <rect x="250" y="140" width="95" height="180" rx="3" fill="url(#br-tower-front)" stroke="#4d4d4d" strokeWidth="1" />
          {/* Roof yellow accent trim */}
          <rect x="245" y="135" width="105" height="5" rx="1.5" fill="#FFD43B" fillOpacity="0.9" />

          {/* Balcony rows */}
          <rect x="260" y="155" width="35" height="16" rx="1" fill="url(#br-window-glow)" />
          <line x1="258" y1="170" x2="297" y2="170" stroke="#F5F5F5" strokeWidth="1.5" />
          <rect x="302" y="155" width="35" height="16" rx="1" fill="url(#br-window-dim)" />

          <rect x="260" y="185" width="35" height="16" rx="1" fill="url(#br-window-dim)" />
          <rect x="302" y="185" width="35" height="16" rx="1" fill="url(#br-window-glow)" />
          <line x1="300" y1="200" x2="339" y2="200" stroke="#F5F5F5" strokeWidth="1.5" />

          <rect x="260" y="215" width="35" height="16" rx="1" fill="url(#br-window-glow)" />
          <rect x="302" y="215" width="35" height="16" rx="1" fill="url(#br-window-glow)" />

          {/* Foreground townhouse / security gatehouse */}
          <rect x="180" y="220" width="90" height="100" rx="3" fill="#2c2c2c" stroke="#444444" strokeWidth="1" />
          <line x1="178" y1="217" x2="272" y2="217" stroke="#FFD43B" strokeWidth="2" />
          <rect x="195" y="235" width="60" height="24" rx="2" fill="url(#br-window-glow)" fillOpacity="0.85" />
          <line x1="225" y1="235" x2="225" y2="259" stroke="#333333" strokeWidth="1.5" />

          {/* Ground trees / landscaping */}
          <circle cx="360" cy="305" r="15" fill="#1b2a1e" stroke="#2e4233" strokeWidth="1" />
          <circle cx="275" cy="310" r="13" fill="#1b2a1e" stroke="#2e4233" strokeWidth="1" />
          <circle cx="180" cy="308" r="14" fill="#1b2a1e" stroke="#2e4233" strokeWidth="1" />
          <circle cx="95" cy="312" r="10" fill="#1b2a1e" />

          {/* Bottom subtle blending gradient */}
          <rect x="0" y="270" width="380" height="50" fill="url(#br-fade-bottom)" />
        </svg>
      </div>

    </div>
  );
};
