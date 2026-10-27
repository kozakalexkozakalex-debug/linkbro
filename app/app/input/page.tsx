import BaseTabs from "@/components/BaseTabs";
import InferoPanel from "@/components/InferoPanel";

// Infero на всю страницу (та же панель, что выезжает справа по кнопке «+ Infero»)
export default async function InputPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <BaseTabs />
      <h1 className="page-title">Infero</h1>
      <InferoPanel initial={m === "file" ? "file" : "list"} />
    </div>
  );
}
