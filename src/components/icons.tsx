import type { SVGProps } from "react";

// Icone inline in stile industriale: tratto 2px, terminazioni squadrate,
// currentColor. aria-hidden: il significato lo dà il testo/aria-label del contenitore.
const base = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "square",
  strokeLinejoin: "miter",
  "aria-hidden": true,
} as const;

type IconProps = SVGProps<SVGSVGElement>;

export function XIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 5l10 10M15 5L5 15" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M16 10H4M9 5l-5 5 5 5" />
    </svg>
  );
}

// Freccia "torna su di un livello": scende dall'alto, angolo a 90° e vira a sinistra.
export function CornerDownLeftIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M16 4v6a3 3 0 0 1-3 3H4M8 9l-4 4 4 4" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M7 4l6 6-6 6" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M4 10.5 8.5 15 16 5.5" />
    </svg>
  );
}

export function NoEntryIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3" y="3" width="14" height="14" />
      <path d="M5 5l10 10" />
    </svg>
  );
}

export function WarningIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M10 3 18 17H2Z M10 8v4M10 14.5v.5" />
    </svg>
  );
}
