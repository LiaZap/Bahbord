interface IllustrationProps {
  className?: string;
}

/**
 * Empty inbox illustration: a stylized tray with a small check mark indicating "all clear".
 * Uses currentColor for line work; accent for the check.
 */
export default function InboxEmpty({ className }: IllustrationProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 240 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-hidden="true"
      className={className}
    >
      {/* outer tray */}
      <rect
        x="48"
        y="58"
        width="144"
        height="84"
        rx="10"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.9"
      />
      {/* divider line */}
      <line
        x1="48"
        y1="104"
        x2="86"
        y2="104"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.5"
      />
      <line
        x1="154"
        y1="104"
        x2="192"
        y2="104"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.5"
      />
      {/* inbox slot curve */}
      <path
        d="M86 104 L96 116 H144 L154 104"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* faint stacked papers behind */}
      <line
        x1="78"
        y1="44"
        x2="162"
        y2="44"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.25"
        strokeLinecap="round"
      />
      <line
        x1="68"
        y1="52"
        x2="172"
        y2="52"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.4"
        strokeLinecap="round"
      />
      {/* check badge */}
      <circle
        cx="170"
        cy="56"
        r="14"
        fill="var(--accent)"
        opacity="0.12"
      />
      <path
        d="M163 56.5 L168.5 62 L177 53"
        stroke="var(--accent)"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
