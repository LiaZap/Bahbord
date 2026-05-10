interface IllustrationProps {
  className?: string;
}

/**
 * Clock with an empty timeline beneath — "no recent activity".
 */
export default function NoActivityEmpty({ className }: IllustrationProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 240 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden="true"
      className={className}
    >
      {/* clock face */}
      <circle
        cx="120"
        cy="76"
        r="38"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* tick marks */}
      <line x1="120" y1="42" x2="120" y2="48" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="120" y1="104" x2="120" y2="110" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="86" y1="76" x2="92" y2="76" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      <line x1="148" y1="76" x2="154" y2="76" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
      {/* hands */}
      <path
        d="M120 76 L120 56"
        stroke="var(--accent)"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M120 76 L138 84"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="120" cy="76" r="2" fill="var(--accent)" />
      {/* timeline below */}
      <line
        x1="48"
        y1="142"
        x2="192"
        y2="142"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.45"
      />
      <circle cx="60" cy="142" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.55" />
      <circle cx="120" cy="142" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.55" />
      <circle cx="180" cy="142" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.55" />
    </svg>
  );
}
