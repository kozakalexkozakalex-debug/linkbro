// Синхронизация: письма от посредников из базы → в ленту их активных сделок, сделка → «Відповіли».
// Работает и с обычным клиентом (пользователь у себя), и с админ-клиентом (фоновая задача).
import { CORE_NEG } from "@/lib/project";
import { credsOf, fetchNew, type MailAccount } from "@/lib/mail/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

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
        const { data: deals } = await db
          .from("project_donors")
          .select("id, project_id, core_status, comm_status")
          .eq("team_id", acc.team_id)
          .in("med_base", handles)
          .neq("core_status", "Published")
          .limit(10);
        const live = ((deals ?? []) as { id: string; project_id: string; core_status: string; comm_status: string }[]).filter(
          (d) => !CORE_NEG.includes(d.core_status),
        );
        for (const d of live) {
          const { error } = await db.from("activities").insert({
            team_id: acc.team_id,
            project_id: d.project_id,
            donor_id: d.id,
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
          if (error) continue; // уже было (повторная синхронизация)
          added++;
          const patch: Record<string, unknown> = { indicator: "replied", indicator_at: new Date().toISOString() };
          if (d.comm_status === "" || d.comm_status === "Contacted") patch.comm_status = "In Discussion";
          await db.from("project_donors").update(patch).eq("id", d.id).eq("team_id", acc.team_id);
        }
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
