// Деньги: валюты, комиссии бирж, реальная цена ссылки, статусы оплаты.

export const CURRENCIES = ["USD", "EUR", "UAH"] as const;
export type Currency = (typeof CURRENCIES)[number];
const SIGN: Record<Currency, string> = { USD: "$", EUR: "€", UAH: "₴" };

// Источники покупки. Комиссия и гарантия подставляются как подсказка, их можно менять в каждой строке.
export const SOURCES: { name: string; commission: number; guaranteeDays: number }[] = [
  { name: "Collaborator", commission: 10, guaranteeDays: 90 },
  { name: "PRposting", commission: 0, guaranteeDays: 0 },
  { name: "Miralinks", commission: 10, guaranteeDays: 0 },
  { name: "Посередник", commission: 0, guaranteeDays: 0 },
  { name: "Напряму", commission: 0, guaranteeDays: 0 },
];

export const PAY_STATUSES = [
  { value: "", label: "—" },
  { value: "due", label: "до оплати" },
  { value: "paid", label: "оплачено" },
  { value: "refund", label: "повернення" },
] as const;
export type PayStatus = "" | "due" | "paid" | "refund";

export type MoneyFields = {
  gp_price: number | null;
  gp_currency: string;
  gp_commission: number;
  pay_status: string;
  gp_status: string;
  in_gp: boolean;
};

// Реальная цена: цена + комиссия биржи
export function realCost(d: Pick<MoneyFields, "gp_price" | "gp_commission">): number {
  if (d.gp_price == null) return 0;
  return d.gp_price * (1 + (Number(d.gp_commission) || 0) / 100);
}

// Состояние оплаты: явное поле, а если пусто — по статусу GP
export function payState(d: Pick<MoneyFields, "pay_status" | "gp_status" | "in_gp">): PayStatus {
  if (d.pay_status === "paid" || d.pay_status === "due" || d.pay_status === "refund") return d.pay_status;
  if (d.gp_status === "Paid") return "paid";
  if (d.in_gp) return "due";
  return "";
}

export type ByCurrency = Partial<Record<Currency, number>>;

export function addTo(map: ByCurrency, currency: string, amount: number) {
  const c = (CURRENCIES as readonly string[]).includes(currency) ? (currency as Currency) : "USD";
  map[c] = (map[c] ?? 0) + amount;
}

export function fmtMoney(map: ByCurrency): string {
  const parts = CURRENCIES.filter((c) => (map[c] ?? 0) > 0).map(
    (c) => SIGN[c] + Math.round(map[c] ?? 0).toLocaleString("uk-UA"),
  );
  return parts.length ? parts.join(" · ") : SIGN.USD + "0";
}

export function fmtAmount(amount: number, currency: string): string {
  const c = (CURRENCIES as readonly string[]).includes(currency) ? (currency as Currency) : "USD";
  return SIGN[c] + (Math.round(amount * 100) / 100).toLocaleString("uk-UA");
}

export function daysLeft(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const end = new Date(dateIso + "T23:59:59");
  return Math.ceil((end.getTime() - Date.now()) / 86_400_000);
}
