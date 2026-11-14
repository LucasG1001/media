interface IconProps {
  className?: string;
}

function Icon({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function AnimeIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="2" y="2" width="20" height="20" rx="2.5" />
      <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 7h5M17 17h5" />
    </Icon>
  );
}

export function MovieIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M2 7h20v13a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7Z" />
      <path d="m4 7 2.5-4M9 7l2.5-4M14 7l2.5-4M19 7l2.5-4" />
    </Icon>
  );
}

export function SeriesIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="2" y="6" width="20" height="13" rx="2" />
      <path d="m8 3 4 3 4-3M9 22h6" />
    </Icon>
  );
}

export function BookIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M12 6.5C10.5 5 8 4.5 4 5v13c4-.5 6.5 0 8 1.5" />
      <path d="M12 6.5C13.5 5 16 4.5 20 5v13c-4-.5-6.5 0-8 1.5" />
      <path d="M12 6.5v13" />
    </Icon>
  );
}

export function GameIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M6 11h4M8 9v4M15 11h.01M18 13h.01" />
      <path d="M17.5 6a4.5 4.5 0 0 1 4.43 3.7l1.04 5.78a2.5 2.5 0 0 1-4.4 2.07L17 15H7l-1.57 2.55a2.5 2.5 0 0 1-4.4-2.07l1.04-5.78A4.5 4.5 0 0 1 6.5 6h11Z" />
    </Icon>
  );
}

export function YoutubeIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M22 8.2a3 3 0 0 0-2.1-2.1C18 5.5 12 5.5 12 5.5s-6 0-7.9.6A3 3 0 0 0 2 8.2 31 31 0 0 0 1.5 12 31 31 0 0 0 2 15.8a3 3 0 0 0 2.1 2.1c1.9.6 7.9.6 7.9.6s6 0 7.9-.6a3 3 0 0 0 2.1-2.1c.4-1.9.5-3.8.5-3.8s0-1.9-.5-3.8Z" />
      <path d="m10 15 5-3-5-3v6Z" />
    </Icon>
  );
}

export function LogoIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="m12 3 9 4.5-9 4.5-9-4.5L12 3Z" />
      <path d="m3 12 9 4.5 9-4.5M3 16.5 12 21l9-4.5" />
    </Icon>
  );
}

export function HomeIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5M9.5 21v-6h5v6" />
    </Icon>
  );
}

export function TierIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M3 5h18M3 12h13M3 19h8" />
    </Icon>
  );
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </Icon>
  );
}

export function ChevronIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="m15 18-6-6 6-6" />
    </Icon>
  );
}

export function MediaIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Icon>
  );
}
