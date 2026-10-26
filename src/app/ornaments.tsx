const FLAGS = ["var(--marigold)", "var(--rose)", "var(--jade)", "var(--violet)", "var(--marigold)", "var(--rose)", "var(--jade)"];

/** A string of papel picado. Each flag is cut with a few simple shapes, the way the paper is punched. */
export function PapelPicado({ className = "" }: { className?: string }) {
  const w = 64;
  const gap = 10;
  const total = FLAGS.length * w + (FLAGS.length - 1) * gap;
  return (
    <svg viewBox={`0 0 ${total} 78`} className={className} aria-hidden="true" preserveAspectRatio="xMidYMin meet">
      <defs>
        {FLAGS.map((_, i) => (
          <mask id={`cut-${i}`} key={i}>
            <rect x="0" y="0" width={w} height="78" fill="white" />
            <circle cx={w / 2} cy="30" r="9" fill="black" />
            <path d={`M${w / 2} 14 l3 5 -3 5 -3 -5z`} fill="black" />
            <circle cx="14" cy="24" r="3" fill="black" />
            <circle cx={w - 14} cy="24" r="3" fill="black" />
            <path d={`M10 48 q${w / 4 - 10} -8 ${w / 2 - 10} 0 q${w / 4} 8 ${w / 2 - 10} 0`} stroke="black" strokeWidth="3" fill="none" />
            {[0, 1, 2, 3, 4].map((k) => (
              <circle key={k} cx={10 + k * ((w - 20) / 4)} cy="60" r="2" fill="black" />
            ))}
          </mask>
        ))}
      </defs>
      <path d={`M0 4 Q${total / 2} 12 ${total} 4`} stroke="rgba(243,233,220,0.35)" strokeWidth="1" fill="none" />
      {FLAGS.map((color, i) => {
        const x = i * (w + gap);
        const sag = 4 + 8 * Math.sin((Math.PI * (x + w / 2)) / total);
        return (
          <g key={i} transform={`translate(${x} ${sag})`}>
            <path
              d={`M0 0 H${w} V70 Q${w - w / 12} 76 ${w - w / 6} 70 Q${w - w / 4} 76 ${w - w / 3} 70 Q${w - (5 * w) / 12} 76 ${w / 2} 70 Q${w / 2 - w / 12} 76 ${w / 3} 70 Q${w / 4} 76 ${w / 6} 70 Q${w / 12} 76 0 70 Z`}
              fill={color}
              opacity="0.82"
              mask={`url(#cut-${i})`}
            />
          </g>
        );
      })}
    </svg>
  );
}

/** A marigold, cempasuchil, drawn as rings of petals. */
export function Marigold({ size = 28, className = "" }: { size?: number; className?: string }) {
  const rings = [
    { r: 11, n: 14, len: 5, color: "var(--marigold-deep)" },
    { r: 8, n: 12, len: 4.5, color: "var(--marigold)" },
    { r: 4.5, n: 9, len: 3.5, color: "#f7c25e" },
  ];
  return (
    <svg width={size} height={size} viewBox="-16 -16 32 32" className={className} aria-hidden="true">
      {rings.map((ring, ri) =>
        Array.from({ length: ring.n }, (_, k) => {
          const a = (360 / ring.n) * k + ri * 11;
          return (
            <ellipse key={`${ri}-${k}`} cx="0" cy={-ring.r + ring.len / 2} rx={ring.len / 2.1} ry={ring.len} fill={ring.color} transform={`rotate(${a})`} />
          );
        })
      )}
      <circle r="2.2" fill="#9a4b12" />
    </svg>
  );
}

export function Candle({ lit = true, className = "" }: { lit?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 48" className={className} aria-hidden="true">
      {lit && (
        <>
          <ellipse cx="12" cy="12" rx="9" ry="11" fill="rgba(240,161,54,0.18)" />
          <path className="flame" d="M12 3 C15 8 16 11 15.2 14 C14.5 16.6 13.3 18 12 18 C10.7 18 9.5 16.6 8.8 14 C8 11 9 8 12 3 Z" fill="#f7c25e" />
          <path className="flame" d="M12 9 C13.4 11.5 13.8 13.2 13.3 14.8 C12.9 16 12.5 16.6 12 16.6 C11.5 16.6 11.1 16 10.7 14.8 C10.2 13.2 10.6 11.5 12 9 Z" fill="#fff1cf" />
        </>
      )}
      <line x1="12" y1="17" x2="12" y2="21" stroke="#3a2a22" strokeWidth="1" />
      <rect x="7" y="21" width="10" height="25" rx="1.5" fill="#efe2cf" />
      <path d="M7 24 q2 3 3 0 q1 4 2.5 0" fill="none" stroke="#d9c7ad" strokeWidth="1" />
    </svg>
  );
}
