import ImportForm from "./ImportForm";

export default function ImportPage() {
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="font-display text-xl font-medium">Імпорт CSV</h1>
        <p className="mt-1 max-w-2xl text-mute">
          Завантажте таблицю з Google Sheets (Файл → Завантажити → CSV), Excel або вивантаження Ahrefs / Majestic. Вкажіть, яка колонка
          що означає, і донори потраплять у Глобальну базу. Дублі відсіюються так само, як в Інпуті.
        </p>
      </div>
      <ImportForm />
    </div>
  );
}
