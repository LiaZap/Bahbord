interface IllustrationProps {
  className?: string;
}

/**
 * Stacked ticket sheets with a subtle "all clear" sparkle.
 */
export default function TicketsEmpty({ className }: IllustrationProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 240 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden="true"
      className={className}
    >
      {/* back sheet */}
      <rect
        x="74"
        y="46"
        width="108"
        height="76"
        rx="8"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.3"
      />
      {/* mid sheet */}
      <rect
        x="66"
        y="56"
        width="108"
        height="76"
        rx="8"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.55"
      />
      {/* front sheet */}
      <rect
        x="58"
        y="66"
        width="124"
        height="84"
        rx="9"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* ticket lines */}
      <line
        x1="72"
        y1="86"
        x2="142"
        y2="86"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.7"
      />
      <line
        x1="72"
        y1="100"
        x2="168"
        y2="100"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.45"
      />
      <line
        x1="72"
        y1="114"
        x2="124"
        y2="114"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.45"
      />
      {/* status dot */}
      <circle
        cx="160"
        cy="86"
        r="4"
        fill="var(--accent)"
        opacity="0.85"
      />
      {/* sparkle accent */}
      <path
        d="M196 56 L196 68 M190 62 L202 62"
        stroke="var(--accent)"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="196" cy="62" r="2" fill="var(--accent)" />
    </svg>
  );
}
