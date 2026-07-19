/**
 * Tek bir çizim ızgarasından türetilmiş ikon seti: 24×24 kutu, 1.6 kalınlık,
 * yuvarlatılmış uç. İkon kütüphanesi eklemek yerine elle çizilir; böylece
 * kalınlık ve optik boyut arayüzün geri kalanıyla birebir uyuşur.
 */

type IconProps = { size?: number; className?: string };

function base(size: number, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
    className,
  };
}

export function ArrowUpRight({ size = 16, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M7 17 17 7" />
      <path d="M8.5 7H17v8.5" />
    </svg>
  );
}

export function ArrowUp({ size = 18, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 19V5" />
      <path d="m5.5 11.5 6.5-6.5 6.5 6.5" />
    </svg>
  );
}

export function Sun({ size = 17, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v1.8M12 19.2V21M4.2 4.2l1.3 1.3M18.5 18.5l1.3 1.3M3 12h1.8M19.2 12H21M4.2 19.8l1.3-1.3M18.5 5.5l1.3-1.3" />
    </svg>
  );
}

export function Moon({ size = 17, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M20 13.4A8.2 8.2 0 0 1 10.6 4a8.2 8.2 0 1 0 9.4 9.4Z" />
    </svg>
  );
}

export function Chevron({ size = 15, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="m7 10 5 5 5-5" />
    </svg>
  );
}

export function External({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4.5" />
    </svg>
  );
}

export function Copy({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <rect x="9" y="9" width="11" height="11" rx="1.5" />
      <path d="M15 6V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h1" />
    </svg>
  );
}

export function Check({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function Document({ size = 14, className }: IconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8Z" />
      <path d="M14 3v5h5" />
      <path d="M8.5 13h7M8.5 16.5h4.5" />
    </svg>
  );
}
