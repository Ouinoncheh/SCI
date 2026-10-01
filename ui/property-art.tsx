export function PropertyArt({
  variant = 'terracotta',
  large = false,
  synthetic = true,
}: {
  variant?: string;
  large?: boolean;
  synthetic?: boolean;
}) {
  return (
    <div
      className={`property-art ${variant} ${large ? 'large' : ''}`}
      aria-label="Illustration architecturale, pas une photographie du bien"
      role="img"
    >
      <svg viewBox="0 0 500 290" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="500" height="290" fill="var(--sky)" />
        <circle cx="408" cy="62" r="38" fill="var(--sun)" />
        <path d="M0 245L500 216V290H0Z" fill="var(--ground)" />
        <path d="M54 84L221 52L396 96L238 124Z" fill="var(--roof)" />
        <path d="M54 84L238 124V274L54 231Z" fill="var(--wall)" />
        <path d="M238 124L396 96V245L238 274Z" fill="var(--side)" />
        <path d="M48 84L220 43L405 94L397 104L220 60L54 95Z" fill="var(--trim)" />
        {[0, 1, 2].map((col) =>
          [0, 1].map((row) => (
            <g
              key={`${col}${row}`}
              transform={`translate(${79 + col * 51},${110 + col * 11 + row * 65})`}
            >
              <path d="M0 0L26 6V44L0 38Z" fill="var(--window)" />
              <path d="M13 3V41M0 20L26 26" stroke="var(--trim)" strokeWidth="3" />
              <path d="M-4 36L30 44V49L-4 41Z" fill="var(--trim)" />
            </g>
          )),
        )}
        {[0, 1].map((col) =>
          [0, 1].map((row) => (
            <g
              key={`${col}${row}`}
              transform={`translate(${266 + col * 63},${141 - col * 12 + row * 62})`}
            >
              <path d="M0 0L32 -6V33L0 39Z" fill="var(--window)" />
              <path d="M16 -3V36M0 17L32 11" stroke="var(--trim)" strokeWidth="3" />
            </g>
          )),
        )}
        <path d="M169 216L200 223V265L169 258Z" fill="var(--window)" />
        <path d="M263 193L383 172V185L263 207Z" fill="var(--trim)" />
        <path
          d="M267 179V200M285 176V197M305 172V193M325 169V190M345 165V186M365 161V182M381 158V179M265 179L383 158"
          stroke="var(--roof)"
          strokeWidth="3"
        />
        <path d="M26 265V195M442 263V161" stroke="var(--roof)" strokeWidth="6" />
        <ellipse cx="26" cy="183" rx="27" ry="42" fill="var(--leaf)" />
        <ellipse cx="442" cy="147" rx="37" ry="57" fill="var(--leaf)" />
        <ellipse cx="467" cy="174" rx="27" ry="37" fill="var(--leaf)" />
      </svg>
      <span className="art-label">
        {synthetic ? 'ILLUSTRATION · BIEN FICTIF' : 'ILLUSTRATION · NON CONTRACTUELLE'}
      </span>
    </div>
  );
}
