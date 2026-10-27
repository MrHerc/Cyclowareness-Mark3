"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CornerDownRight, FolderTree, Merge, MoveRight, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { deleteDepartmentAction, mergeDepartmentAction, saveDepartmentAction } from "@/server/actions/workspace";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { searchFold } from "@/components/secops/search-fold";

export type Dept = { id: string; name: string; parentId: string | null; headUserId: string | null; headName: string | null; people: number };

export function DepartmentsTree({ departments, people }: { departments: Dept[]; people: { id: string; name: string }[] }) {
  const t = useTranslations("admin.departments");
  const tc = useTranslations("common");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<null | { id?: string; name: string; parentId: string | null; headUserId: string | null; mode: "add" | "rename" | "move" }>(null);
  const [del, setDel] = useState<Dept | null>(null);
  const [merge, setMerge] = useState<null | { source: Dept; targetId: string }>(null);
  const [pending, start] = useTransition();
  const children = useMemo(() => {
    const m = new Map<string | null, Dept[]>();
    for (const d of departments) m.set(d.parentId, [...(m.get(d.parentId) ?? []), d]);
    return m;
  }, [departments]);
  // A department can't be merged into itself or into one of its own sub-departments.
  const mergeTargets = useMemo(() => {
    if (!merge) return [];
    const subtree = new Set<string>([merge.source.id]);
    const stack = [merge.source.id];
    while (stack.length) {
      for (const k of children.get(stack.pop()!) ?? []) {
        if (subtree.has(k.id)) continue;
        subtree.add(k.id);
        stack.push(k.id);
      }
    }
    return departments.filter((d) => !subtree.has(d.id));
  }, [merge, departments, children]);
  const matches = (d: Dept) => !q || searchFold(d.name).includes(searchFold(q)) || searchFold(d.headName ?? "").includes(searchFold(q));

  const row = (d: Dept, depth: number): React.ReactNode => {
    const kids = children.get(d.id) ?? [];
    const visible = matches(d) || kids.some(matches);
    if (!visible) return null;
    return (
      <li key={d.id}>
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3.5 hover:bg-sunken/40" style={{ paddingInlineStart: `${1 + depth * 1.75}rem` }}>
          {depth ? <CornerDownRight className="size-4 text-ink-disabled" /> : <FolderTree className="size-4 text-brand-600" />}
          <div className="min-w-0 flex-1">
            <p className="text-body-sm font-semibold">{d.name}</p>
            <p className="text-tab text-ink-subtle">
              {t("people", { count: d.people })}
              {kids.length ? ` · ${t("subs", { count: kids.length })}` : ""} · {d.headName ? t("head", { name: d.headName }) : t("noHead")}
            </p>
          </div>
          <div className="flex gap-1">
            <Button size="icon-sm" variant="ghost" aria-label={t("addSub")} title={t("addSub")} onClick={() => setEdit({ name: "", parentId: d.id, headUserId: null, mode: "add" })}>
              <Plus />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label={t("rename")} title={t("rename")} onClick={() => setEdit({ id: d.id, name: d.name, parentId: d.parentId, headUserId: d.headUserId, mode: "rename" })}>
              <Pencil />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label={t("move")} title={t("move")} onClick={() => setEdit({ id: d.id, name: d.name, parentId: d.parentId, headUserId: d.headUserId, mode: "move" })}>
              <MoveRight />
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label={t("merge")} title={t("merge")} disabled={departments.length < 2} onClick={() => setMerge({ source: d, targetId: "" })}>
              <Merge />
            </Button>
            <Button size="icon-sm" variant="ghost" className="text-risk-600" aria-label={t("delete")} title={t("delete")} onClick={() => setDel(d)}>
              <Trash2 />
            </Button>
          </div>
        </div>
        {kids.length ? <ul>{kids.map((k) => row(k, depth + 1))}</ul> : null}
      </li>
    );
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative w-full sm:w-80">
          <span className="sr-only">{t("search")}</span>
          <Search className="pointer-events-none absolute top-1/2 start-3.5 size-4 -translate-y-1/2 text-ink-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className="ps-10" />
        </label>
        <Button className="ms-auto" icon={<Plus />} onClick={() => setEdit({ name: "", parentId: null, headUserId: null, mode: "add" })}>
          {t("add")}
        </Button>
      </div>
      <ul className="overflow-hidden rounded-xl border border-line bg-surface shadow-xs">{(children.get(null) ?? []).map((d) => row(d, 0))}</ul>

      <Dialog open={!!edit} onClose={() => setEdit(null)} title={edit?.mode === "add" ? t("add") : edit?.mode === "move" ? t("move") : t("rename")} size="sm">
        {edit ? (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                const res = await saveDepartmentAction({ id: edit.id, name: edit.name, parentId: edit.parentId, headUserId: edit.headUserId });
                if (res.ok) {
                  toast(edit.mode === "add" ? t("created") : edit.mode === "move" ? t("moved") : t("renamed"));
                  setEdit(null);
                } else toast(res.error === "cycle" ? t("cycle") : res.error === "duplicate" ? t("duplicate") : tc("errors.invalid"), "error");
              });
            }}
          >
            {edit.mode !== "move" ? (
              <Field label={t("name")} htmlFor="d-name">
                <Input id="d-name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required minLength={2} autoFocus />
              </Field>
            ) : null}
            <Field label={t("parent")} htmlFor="d-parent">
              <Select id="d-parent" value={edit.parentId ?? ""} onChange={(e) => setEdit({ ...edit, parentId: e.target.value || null })}>
                <option value="">{t("topLevel")}</option>
                {departments
                  .filter((d) => d.id !== edit.id)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </Select>
            </Field>
            {edit.mode !== "move" ? (
              <Field label={t("headLabel")} htmlFor="d-head">
                <Select id="d-head" value={edit.headUserId ?? ""} onChange={(e) => setEdit({ ...edit, headUserId: e.target.value || null })}>
                  <option value="">{t("noHead")}</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Button type="submit" disabled={pending}>
              {tc("save")}
            </Button>
          </form>
        ) : null}
      </Dialog>

      <Dialog
        open={!!del}
        onClose={() => setDel(null)}
        title={del ? t("deleteTitle", { name: del.name }) : ""}
        size="sm"
        footer={
          <Button variant="danger" disabled={pending} onClick={() => del && start(async () => void ((await deleteDepartmentAction(del.id)).ok && (toast(t("deleted")), setDel(null))))}>
            {t("delete")}
          </Button>
        }
      >
        <p className="text-body-sm text-ink-muted">{t("deleteBody")}</p>
      </Dialog>

      <Dialog
        open={!!merge}
        onClose={() => setMerge(null)}
        title={merge ? t("mergeTitle", { name: merge.source.name }) : ""}
        size="sm"
        footer={
          <Button
            variant="danger"
            disabled={pending || !merge?.targetId}
            onClick={() =>
              merge &&
              start(async () => {
                const res = await mergeDepartmentAction(merge.source.id, merge.targetId);
                if (res.ok) {
                  toast(t("merged"));
                  setMerge(null);
                } else toast(res.error === "cycle" ? t("cycle") : tc("errors.invalid"), "error");
              })
            }
          >
            {t("mergeConfirm")}
          </Button>
        }
      >
        {merge ? (
          <div className="grid gap-4">
            <p className="text-body-sm text-ink-muted">{t("mergeBody", { name: merge.source.name })}</p>
            <Field label={t("mergeTarget")} htmlFor="d-merge">
              <Select id="d-merge" value={merge.targetId} onChange={(e) => setMerge({ ...merge, targetId: e.target.value })} autoFocus>
                <option value="">{t("mergePick")}</option>
                {mergeTargets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
