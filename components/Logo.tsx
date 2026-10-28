// Логотип LinkBro: знак + надпись. sm — меню, lg — страницы входа и главная.
/* eslint-disable @next/next/no-img-element */
export default function Logo({ size = "sm", word = true }: { size?: "sm" | "lg"; word?: boolean }) {
  const px = size === "lg" ? 44 : 28;
  return (
    <span className="inline-flex items-center gap-2.5">
      <img src={size === "lg" ? "/logo.png" : "/logo-64.png"} width={px} height={px} alt={word ? "" : "LinkBro"} className="shrink-0" />
      {word && (
        <span className={`font-logo font-bold tracking-tight text-ink ${size === "lg" ? "text-2xl" : "text-[17px]"}`}>
          Link<span className="text-accent">Bro</span>
        </span>
      )}
    </span>
  );
}
