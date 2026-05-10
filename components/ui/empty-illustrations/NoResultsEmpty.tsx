interface IllustrationProps {
  className?: string;
}

/**
 * Magnifier with a small subtle X mark inside the lens — "no results".
 */
export default function NoResultsEmpty({ className }: IllustrationProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 240 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden="true"
      className={className}
    >
      {/* faint horizon lines */}
      <line
        x1="36"
        y1="148"
        x2="92"
        y2="148"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.2"
      />
      <line
        x1="158"
        y1="148"
        x2="204"
        y2="148"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.2"
      />
      {/* lens */}
      <circle
        cx="106"
        cy="80"
        r="42"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* lens highlight */}
      <path
        d="M82 60 A30 30 0 0 1 102 50"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.35"
      />
      {/* handle */}
      <line
        x1="138"
        y1="112"
        x2="172"
        y2="146"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* subtle X inside */}
      <path
        d="M94 68 L118 92 M118 68 L94 92"
        stroke="var(--accent)"
        strokeWidth="1.75"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}
