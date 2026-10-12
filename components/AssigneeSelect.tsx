"use client";

import { useState, useTransition } from "react";
import { setAssignee } from "@/app/app/projects/actions";
import type { Member } from "@/lib/project";

export default function AssigneeSelect({
  id,
  projectId,
  value,
  members,
}: {
  id: string;
  projectId: string;
  value: string | null;
  members: Member[];
}) {
  const [v, setV] = useState(value ?? "");
  const [pending, start] = useTransition();

  return (
    <select
      id={`as-${id}`}
      aria-label="Відповідальний"
      className={`stsel ${pending ? "opacity-60" : ""}`}
      value={v}
      onChange={(e) => {
        const next = e.target.value;
        const prev = v;
        setV(next);
        start(async () => {
          const r = await setAssignee(id, projectId, next);
          if (!r.ok) setV(prev);
        });
      }}
    >
      <option value="">—</option>
      {members.map((m) => (
        <option key={m.id} value={m.id}>{m.name}</option>
      ))}
    </select>
  );
}
