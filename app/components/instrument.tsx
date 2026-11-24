export function BrandMark({ size = 38 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 44 44" fill="none" aria-hidden="true">
      <rect x="0.5" y="0.5" width="43" height="43" rx="12" />
      <circle cx="22" cy="22" r="13" />
      <path d="M22 6.5v31M6.5 22h31M22 11l7 11-7 11-7-11 7-11Z" />
      <circle className="mark-center" cx="22" cy="22" r="2.4" />
    </svg>
  );
}

const polar = (r: number, angle: number) => [(240 + r * Math.cos(angle)).toFixed(2), (200 + r * Math.sin(angle)).toFixed(2)];

export function Instrument() {
  return (
    <svg viewBox="0 0 480 400" fill="none" className="instrument-art" aria-hidden="true">
      <g className="instrument-rings">
        {[67, 88, 113, 149, 174, 188].map((r) => <circle key={r} cx="240" cy="200" r={r} />)}
        <circle cx="240" cy="200" r="158" strokeDasharray="1 4" />
        <circle cx="240" cy="200" r="182" strokeDasharray="1 6" />
        <path d="M0 200h480M240 0v400M105 65l270 270M105 335L375 65" strokeDasharray="3 7" />
        <path d="M240 48l132 228H108L240 48ZM240 352 108 124h264L240 352Z" />
        <ellipse cx="240" cy="200" rx="47" ry="120" transform="rotate(43 240 200)" />
        <ellipse cx="240" cy="200" rx="47" ry="120" transform="rotate(-43 240 200)" />
      </g>
      <g className="instrument-ticks">
        {Array.from({ length: 72 }, (_, i) => {
          const angle = i * Math.PI / 36;
          const [x1, y1] = polar(i % 6 === 0 ? 174 : 179, angle);
          const [x2, y2] = polar(185, angle);
          return <path key={i} d={`M${x1} ${y1}L${x2} ${y2}`} />;
        })}
      </g>
      <g className="instrument-stars">
        {[[240, 51], [343, 107], [107, 200], [370, 278], [240, 349], [164, 282], [309, 149], [278, 230], [141, 94], [410, 171], [53, 146], [416, 310], [341, 38]].map(([x, y], i) =>
          i % 3 === 0 ? <path key={i} d={`M${x - 5} ${y}h10M${x} ${y - 5}v10`} /> : <circle key={i} cx={x} cy={y} r={i % 2 + 1} />)}
      </g>
      <path className="instrument-needle" d="M240 177 246 194 263 200 246 206 240 223 234 206 217 200 234 194Z" />
      <circle className="instrument-stars" cx="240" cy="200" r="5" />
    </svg>
  );
}
