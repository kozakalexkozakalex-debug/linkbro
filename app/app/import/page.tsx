import { redirect } from "next/navigation";

// Импорт теперь внутри Infero (вкладка «Файлом»)
export default function ImportPage() {
  redirect("/app/input?m=file");
}
