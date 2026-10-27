"use server";

// Данные для панели Nexo (выезжает справа в Outreach)
import { getTeamContext } from "@/lib/team";
import { loadPeople } from "@/lib/people";
import type { PersonRow } from "./PeopleTable";

export async function getNexoPeople(): Promise<PersonRow[]> {
  const { supabase, team } = await getTeamContext();
  return (await loadPeople(supabase, team.id)).people;
}
