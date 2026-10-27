// Пустое состояние: что здесь будет и что сделать дальше
import Icon from "@/components/Icon";

export default function EmptyState({ icon = "folder", title, text, action }: { icon?: string; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} size={24} className="text-mute" />
      <p className="text-[15px] font-semibold">{title}</p>
      {text && <p className="text-sm text-mute">{text}</p>}
      {action && <div className="mt-1 flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}
