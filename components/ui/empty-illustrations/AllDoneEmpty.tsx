interface IllustrationProps {
  className?: string;
}

/**
 * Celebratory large check inside a soft circle — "all done!".
 */
export default function AllDoneEmpty({ className }: IllustrationProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 240 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden="true"
      className={className}
    >
      {/* ring backdrop */}
      <circle
        cx="120"
        cy="90"
        r="58"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.25"
      />
      {/* solid accent ring */}
      <circle
        cx="120"
        cy="90"
        r="46"
        fill="var(--accent)"
        opacity="0.12"
      />
      <circle
        cx="120"
        cy="90"
        r="46"
        stroke="var(--accent)"
        strokeWidth="1.75"
      />
      {/* big check */}
      <path
        d="M98 91 L114 107 L144 75"
        stroke="var(--accent)"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* confetti accents */}
      <line
        x1="60"
        y1="46"
        x2="68"
        y2="54"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.55"
      />
      <line
        x1="178"
        y1="42"
        x2="178"
        y2="52"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="50" cy="110" r="2" fill="currentColor" opacity="0.5" />
      <circle cx="194" cy="128" r="2" fill="currentColor" opacity="0.5" />
      <circle cx="200" cy="76" r="2" fill="var(--accent)" opacity="0.7" />
    </svg>
  );
}
