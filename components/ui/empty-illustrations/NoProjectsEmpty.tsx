interface IllustrationProps {
  className?: string;
}

/**
 * Empty folder with a small sparkle — "ready for your first project".
 */
export default function NoProjectsEmpty({ className }: IllustrationProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 240 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden="true"
      className={className}
    >
      {/* folder tab */}
      <path
        d="M58 58 H102 L114 70 H182 V72 H58 Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* folder body */}
      <rect
        x="58"
        y="72"
        width="124"
        height="68"
        rx="6"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* inner "empty" guide line */}
      <line
        x1="74"
        y1="108"
        x2="166"
        y2="108"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="4 5"
        opacity="0.45"
      />
      {/* sparkle accent (top-right) */}
      <path
        d="M196 50 L196 66 M188 58 L204 58"
        stroke="var(--accent)"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="196" cy="58" r="2.25" fill="var(--accent)" />
      {/* small dot bottom-left */}
      <circle cx="46" cy="130" r="2" fill="currentColor" opacity="0.4" />
    </svg>
  );
}
