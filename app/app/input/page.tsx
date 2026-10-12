import InputForm from "./InputForm";

export default function InputPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-display text-xl font-medium">Інпут</h1>
        <p className="mt-1 text-mute">
          Один донор на рядок: домен і ціна через пробіл. Обов&apos;язковий тільки домен. Домени, які вже є в глобальній базі, не передаються.
        </p>
      </div>
      <InputForm />
    </div>
  );
}
