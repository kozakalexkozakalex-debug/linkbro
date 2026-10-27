// Иконки LinkBro: тонкие линейные SVG 16×16, цвет — от текста (currentColor).
// Одна библиотека на весь продукт вместо эмодзи.
const PATHS: Record<string, string> = {
  dash: "M2 2h5v5H2zM9 2h5v3H9zM9 7h5v7H9zM2 9h5v5H2z",
  folder: "M2 4.5h4l1.5 1.5H14v7H2z",
  filter: "M2 3h12l-4.5 5.5V13l-3-1.5v-3z",
  arrow: "M3 8h10M9 4l4 4-4 4",
  globe:"M8 2a6 6 0 100 12A6 6 0 008 2zM2 8h12M8 2c2 2 2 10 0 12M8 2c-2 2-2 10 0 12",
  chat: "M2 3h12v8H6l-4 3z",
  shield: "M8 2l5 2v4c0 3-2.2 5-5 6-2.8-1-5-3-5-6V4z",
  gear: "M8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4",
  mail: "M2 4h12v8H2zM2 4l6 5 6-5",
  users: "M6 3.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM1.5 13c.5-2.5 2.3-3.5 4.5-3.5s4 1 4.5 3.5M11 4.5a2 2 0 010 4M12.5 13c-.2-1.4-.8-2.3-1.7-2.9",
  logout: "M6 2.5H3v11h3M10 5l3 3-3 3M13 8H6",
  menu: "M2.5 4h11M2.5 8h11M2.5 12h11",
  more: "M3 8h.01M8 8h.01M13 8h.01",
  search: "M7 2.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9zM10.5 10.5L14 14",
  chevron: "M4 6l4 4 4-4",
  plus: "M8 3v10M3 8h10",
  check: "M3 8.5l3 3 7-7",
  x: "M4 4l8 8M12 4l-8 8",
  alert: "M8 4.5v4M8 11v.1M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13z",
  lang: "M2 3.5h7M5.5 2v1.5M3.5 3.5c.5 2.5 2 4.5 4.5 5.5M7.5 3.5C7 6 5.5 8 3 9.5M8.5 14l2.5-6 2.5 6M9.3 12h3.4",
};

export type IconName = keyof typeof PATHS;

export default function Icon({ name, size = 16, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <path d={PATHS[name] ?? ""} />
    </svg>
  );
}
