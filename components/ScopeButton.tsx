// Кнопка «открыть проект в разделе»: выбирает проект на сервере и переходит в раздел
import { selectProject } from "@/app/actions/scope";

export default function ScopeButton({ p, next, className = "", label, children }: { p: string; next: string; className?: string; label?: string; children: React.ReactNode }) {
  return (
    <form action={selectProject} className="contents">
      <input type="hidden" name="p" value={p} />
      <input type="hidden" name="next" value={next} />
      <button type="submit" className={className} aria-label={label}>
        {children}
      </button>
    </form>
  );
}
