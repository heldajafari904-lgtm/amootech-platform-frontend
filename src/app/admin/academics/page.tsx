"use client";

import { useCallback, useEffect, useState } from "react";
import { api, Page } from "@/lib/api";

type Item = { id: number; name: string; ordering: number; is_active: boolean };
const levels = ["grades", "fields", "subjects", "chapters", "topics"] as const;
const parents = ["", "grade", "field", "subject", "chapter"];

export default function Academics() {
  const token = typeof window === "undefined" ? "" : sessionStorage.getItem("amootech_access") || "";
  const [selected, setSelected] = useState<(number | null)[]>([null, null, null, null]);
  const [lists, setLists] = useState<Item[][]>([[], [], [], [], []]);
  const [editing, setEditing] = useState<{ level: number; id: number | null } | null>(null);
  const [name, setName] = useState("");
  const [ordering, setOrdering] = useState(0);
  const [active, setActive] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (level: number, parent: number | null) => {
    if (level > 0 && !parent) return;
    const query = level ? `?${parents[level]}=${parent}` : "";
    try {
      const first = await api<Page<Item>>(`/academics/${levels[level]}/${query}`, token);
      const all = [...first.results]; let next = first.next;
      while (next) { const page: Page<Item> = await api<Page<Item>>(next, token); all.push(...page.results); next = page.next; }
      setLists((old) => old.map((items, index) => index === level ? all : items));
    } catch (reason) { setError(String(reason)); }
  }, [token]);
  useEffect(() => { if (token) Promise.resolve().then(() => load(0, null)); }, [token, load]);
  useEffect(() => { for (let level = 1; level < levels.length; level++) { if (selected[level - 1]) Promise.resolve().then(() => load(level, selected[level - 1])); } }, [selected, load]);

  function choose(level: number, id: number) {
    setSelected((old) => old.map((value, index) => index === level ? id : index > level ? null : value));
    setLists((old) => old.map((items, index) => index > level ? [] : items));
    setEditing(null);
  }
  function begin(level: number, item?: Item) { setEditing({ level, id: item?.id || null }); setName(item?.name || ""); setOrdering(item?.ordering || 0); setActive(item?.is_active ?? true); setError(""); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!editing) return;
    const { level, id } = editing;
    const payload: Record<string, string | number | boolean> = { name, ordering, is_active: active };
    if (level) payload[parents[level]] = selected[level - 1]!;
    try { await api(`/academics/${levels[level]}/${id ? `${id}/` : ""}`, token, id ? "PATCH" : "POST", payload); setEditing(null); load(level, level ? selected[level - 1] : null); } catch (reason) { setError(String(reason)); }
  }
  return <main><h1>Academic structure</h1><p>Select each level to manage its children.</p><div className="academic-grid">{levels.map((level, index) => <section key={level}><h2>{level[0].toUpperCase() + level.slice(1)}</h2>{(index === 0 || selected[index - 1]) && <><button onClick={() => begin(index)}>Add {level.slice(0, -1)}</button><ul>{lists[index].map((item) => <li key={item.id}><button className={selected[index] === item.id ? "selected" : ""} onClick={() => index < 4 ? choose(index, item.id) : begin(index, item)}>{item.name}{!item.is_active ? " (inactive)" : ""}</button><button onClick={() => begin(index, item)}>Edit</button></li>)}</ul></>}</section>)}</div>{editing && <form onSubmit={save}><h2>{editing.id ? "Edit" : "Add"} {levels[editing.level].slice(0, -1)}</h2><input aria-label="Name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required/><label>Order <input type="number" min="0" value={ordering} onChange={(e) => setOrdering(Number(e.target.value))}/></label><label><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)}/> Active</label><button>Save</button><button type="button" onClick={() => setEditing(null)}>Cancel</button></form>}<p role="alert">{error}</p></main>;
}
