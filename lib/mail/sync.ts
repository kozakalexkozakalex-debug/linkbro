// Синхронизация: письмо от посредника → в ленту одной его сделки (или контакта, если сделку не угадали), сделка → «Відповіли».
// Работает и с обычным клиентом (пользователь у себя), и с админ-клиентом (фоновая задача).
import { CORE_NEG } from "@/lib/project";
import { credsOf, fetchNew, type MailAccount } from "@/lib/mail/client";
import { pickDeal } from "@/lib/outreach";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

type LiveDeal = { id: string; project_id: string; domain: string; core_status: string; comm_status: string };

// Посредник ответил → сделка «Відповіли» (этап двигает триггер в базе)
export async function markReplied(db: Db, teamId: string, d: { id: string; comm_status: string }) {
  const patch: Record<string, unknown> = { indicator: "replied", indicator_at: new Date().toISOString() };
  if (d.comm_status === "" || d.comm_status === "Contacted") patch.comm_status = "In Discussion";
  await db.from("project_donors").update(patch).eq("id", d.id).eq("team_id", teamId);
}

export async function syncAccount(db: Db, acc: MailAccount): Promise<{ added: number; error?: string }> {
  try {
    const { items, maxUid } = await fetchNew(credsOf(acc), Number(acc.last_uid) || 0);
    let added = 0;
    if (items.length) {
      // Кому принадлежат адреса: email контакта или сам handle, если это email
      const { data: contacts } = await db.from("contacts").select("handle, email").eq("team_id", acc.team_id);
      const byEmail = new Map<string, Set<string>>();
      const addMap = (email: string, handle: string) => {
        const e = email.trim().toLowerCase();
        if (!e) return;
        if (!byEmail.has(e)) byEmail.set(e, new Set());
        byEmail.get(e)!.add(handle);
      };
      for (const c of (contacts ?? []) as { handle: string; email: string }[]) {
        addMap(c.email, c.handle);
        if (/^[^@\s]+@[^@\s]+$/.test(c.handle)) addMap(c.handle, c.handle);
      }
      for (const m of items) {
        const handles = [...(byEmail.get(m.from) ?? [])];
        if (!handles.length) continue; // письма не от посредников не трогаем
        const { data: seen } = await db.from("activities").select("id").eq("team_id", acc.team_id).eq("message_id", m.messageId).limit(1);
        if ((seen ?? []).length) continue; // уже было (повторная синхронизация)
        const { data: deals } = await db
          .from("project_donors")
          .select("id, project_id, domain, core_status, comm_status")
          .eq("team_id", acc.team_id)
          .in("med_base", handles)
          .neq("core_status", "Published")
          .limit(50);
        const live = ((deals ?? []) as LiveDeal[]).filter((d) => !CORE_NEG.includes(d.core_status));
        // Одна сделка на письмо: домен в теме/тексте → последняя, куда мы писали → единственная активная
        let deal = pickDeal(live, m.subject, m.text);
        if (!deal && live.length > 1) {
          const { data: last } = await db
            .from("activities")
            .select("donor_id")
            .eq("team_id", acc.team_id)
            .in("handle", handles)
            .eq("direction", "out")
            .not("donor_id", "is", null)
            .order("created_at", { ascending: false })
            .limit(1);
          const lastId = ((last ?? []) as { donor_id: string }[])[0]?.donor_id;
          deal = live.find((d) => d.id === lastId) ?? null;
        }
        if (!deal && live.length === 1) deal = live[0];
        const { error } = await db.from("activities").insert({
          team_id: acc.team_id,
          project_id: deal?.project_id ?? null,
          donor_id: deal?.id ?? null,
          handle: handles[0],
          channel: "email",
          direction: "in",
          subject: m.subject,
          body: m.text || m.subject,
          message_id: m.messageId,
          is_read: false,
          created_by: acc.user_id,
          created_at: m.date,
        });
        if (error) continue;
        added++;
        if (deal) await markReplied(db, acc.team_id, deal);
      }
    }
    await db.from("mail_accounts").update({ last_uid: maxUid, last_sync_at: new Date().toISOString(), last_error: "" }).eq("user_id", acc.user_id);
    return { added };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.from("mail_accounts").update({ last_sync_at: new Date().toISOString(), last_error: msg.slice(0, 500) }).eq("user_id", acc.user_id);
    return { added: 0, error: msg };
  }
}
