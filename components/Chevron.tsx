// Ровная стрелка-иконка вместо символов «›» и «▾» (символы шрифта прыгают по высоте)
export default function Chevron({ dir = "right", className = "" }: { dir?: "right" | "down"; className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      className={`chev shrink-0 ${dir === "down" ? "rotate-90" : ""} ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 3.5 10.5 8 6 12.5" />
    </svg>
  );
}
