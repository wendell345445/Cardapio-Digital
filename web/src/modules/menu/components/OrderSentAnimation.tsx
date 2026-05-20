// SVG do chef segurando uma comanda — animação de entrada usada quando o
// cliente acabou de enviar o pedido (OrderTrackingPage). Adaptado do protótipo
// MenuPanda. Auto-contém os keyframes via <style>.

export function OrderSentAnimation() {
  return (
    <div className="relative flex h-[220px] w-[220px] items-center justify-center sm:h-[234px] sm:w-[234px]">
      <style>{`
        @keyframes orderSceneEnter {
          0% { opacity: 0; transform: translateY(24px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes chefRise {
          0% { opacity: 0; transform: translateY(18px) scale(0.94); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes clipboardSlide {
          0% { opacity: 0; transform: translateX(18px) translateY(8px) rotate(3deg); }
          100% { opacity: 1; transform: translateX(0) translateY(0) rotate(0deg); }
        }
        @keyframes handWriting {
          0%, 100% { transform: translate(0px, 0px) rotate(-6deg); }
          30% { transform: translate(4px, 1px) rotate(-2deg); }
          60% { transform: translate(8px, -1px) rotate(-7deg); }
        }
        @keyframes lineWrite {
          0% { stroke-dashoffset: 44; opacity: 0.15; }
          35% { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes checkBadgeIn {
          0%, 45% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes checkStrokeIn {
          0%, 55% { stroke-dashoffset: 18; opacity: 0; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes subtleFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        @keyframes softDot {
          0%, 100% { opacity: 0.35; transform: translateY(0); }
          50% { opacity: 0.9; transform: translateY(-7px); }
        }
      `}</style>

      <svg
        className="h-full w-full overflow-visible"
        viewBox="0 0 240 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ animation: 'orderSceneEnter 0.72s cubic-bezier(0.22, 1, 0.36, 1) both' }}
      >
        <defs>
          <filter
            id="chefSoftShadow"
            x="28"
            y="44"
            width="190"
            height="156"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feDropShadow dx="0" dy="10" stdDeviation="10" floodColor="#403939" floodOpacity="0.10" />
          </filter>
          <linearGradient id="chefRed" x1="72" y1="80" x2="168" y2="170" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--menu-gradient-from)" />
            <stop offset="1" stopColor="var(--menu-gradient-to)" />
          </linearGradient>
          <linearGradient id="paperGradient" x1="137" y1="61" x2="196" y2="170" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" />
            <stop offset="1" stopColor="#fbf7f7" />
          </linearGradient>
        </defs>

        <circle cx="120" cy="118" r="88" fill="#fff0f0" />
        <circle cx="120" cy="118" r="69" stroke="#f7cfcf" strokeWidth="1" />
        <circle cx="56" cy="72" r="4" fill="#f8bcbc" style={{ animation: 'softDot 2.4s ease-in-out infinite 0.15s' }} />
        <circle cx="190" cy="78" r="5" fill="#e4f4ea" style={{ animation: 'softDot 2.7s ease-in-out infinite 0.4s' }} />
        <circle cx="183" cy="177" r="3.5" fill="#ffd6d6" style={{ animation: 'softDot 2.1s ease-in-out infinite 0.3s' }} />

        <g filter="url(#chefSoftShadow)" style={{ animation: 'subtleFloat 3.4s ease-in-out infinite 0.9s' }}>
          <g style={{ animation: 'chefRise 0.78s cubic-bezier(0.22, 1, 0.36, 1) both' }}>
            <path d="M70 151C70 121.7 88.2 101 112 101C135.8 101 154 121.7 154 151V172H70V151Z" fill="#ffffff" stroke="rgba(65,57,57,0.10)" strokeWidth="1" />
            <path d="M86 127H138" stroke="var(--menu-primary)" strokeOpacity="0.22" strokeWidth="2" strokeLinecap="round" />
            <path d="M94 139H130" stroke="var(--menu-primary)" strokeOpacity="0.14" strokeWidth="2" strokeLinecap="round" />
            <circle cx="112" cy="84" r="27" fill="#f1c4ad" />
            <path d="M90 75C95 58 128 57 134 75C124 68 102 68 90 75Z" fill="#403939" fillOpacity="0.16" />
            <path d="M101 84H101.5" stroke="#403939" strokeWidth="3.4" strokeLinecap="round" />
            <path d="M123 84H123.5" stroke="#403939" strokeWidth="3.4" strokeLinecap="round" />
            <path d="M104 96C109 100 116 100 121 96" stroke="#9d6a56" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M82 65C84 47 141 47 143 65V75H82V65Z" fill="#ffffff" />
            <circle cx="91" cy="59" r="13" fill="#ffffff" />
            <circle cx="111" cy="52" r="16" fill="#ffffff" />
            <circle cx="132" cy="59" r="13" fill="#ffffff" />
            <rect x="88" y="68" width="48" height="12" rx="6" fill="#f4eeee" />
          </g>

          <g style={{ animation: 'clipboardSlide 0.78s cubic-bezier(0.22, 1, 0.36, 1) both 0.16s' }}>
            <rect x="139" y="70" width="62" height="93" rx="15" fill="url(#paperGradient)" stroke="rgba(65,57,57,0.12)" />
            <rect x="158" y="80" width="24" height="9" rx="4.5" fill="#f0e8e8" />
            <path d="M153 106H187" stroke="#e8d2d2" strokeWidth="3" strokeLinecap="round" strokeDasharray="44" strokeDashoffset="44" style={{ animation: 'lineWrite 0.8s ease forwards 0.84s' }} />
            <path d="M153 121H181" stroke="#e8d2d2" strokeWidth="3" strokeLinecap="round" strokeDasharray="44" strokeDashoffset="44" style={{ animation: 'lineWrite 0.8s ease forwards 1.12s' }} />
            <path d="M153 136H190" stroke="#e8d2d2" strokeWidth="3" strokeLinecap="round" strokeDasharray="44" strokeDashoffset="44" style={{ animation: 'lineWrite 0.8s ease forwards 1.4s' }} />
          </g>

          <g style={{ animation: 'handWriting 1.85s ease-in-out infinite 1.28s', transformOrigin: '138px 128px' }}>
            <path d="M128 130C136 126 143 126 150 130" stroke="#f1c4ad" strokeWidth="14" strokeLinecap="round" />
            <path d="M143 125L178 145" stroke="url(#chefRed)" strokeWidth="4" strokeLinecap="round" />
            <path d="M176 144L184 149" stroke="#403939" strokeWidth="4" strokeLinecap="round" />
          </g>
        </g>

        <g style={{ animation: 'checkBadgeIn 0.45s ease-out both 1.02s' }}>
          <rect x="173" y="44" width="34" height="34" rx="11" fill="#35b65a" />
          <rect x="178.5" y="50" width="23" height="20" rx="5" fill="white" fillOpacity="0.16" />
          <path d="M182.5 61.4L188.4 67L198.4 55.2" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="19" strokeDashoffset="19" style={{ animation: 'checkStrokeIn 0.55s ease-out forwards 1.12s' }} />
        </g>
      </svg>
    </div>
  )
}
