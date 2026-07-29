import { useState, useMemo, type ReactNode } from "react";
import { ControlPopover } from "../LibraryControls/ControlPopover";
import { FilterCheckboxGroup } from "../LibraryControls/FilterCheckboxGroup";
import type { MediaGroup } from "../FranchiseCard/FranchiseCard";
import type { YoutubeLibraryEntry } from "../../types/youtubeLibrary";
import styles from "./CollectionTagBar.module.css";

interface CollectionTagBarProps {
  group: MediaGroup<YoutubeLibraryEntry>;
  renderMembers: (members: YoutubeLibraryEntry[]) => ReactNode;
}

// Filtro de tag da coleção: vive dentro da expansão e reduz SÓ os cards
// mostrados — não toca no badge `mostrados/total` nem na capa (que no YouTube é o
// card do representante e trocaria de thumbnail embaixo do dedo do usuário).
// O estado zera sozinho ao recolher/trocar de coleção: a expansão é montada com
// key por grupo, então este componente remonta.
export function CollectionTagBar({ group, renderMembers }: CollectionTagBarProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const member of group.members) if (member.tag) set.add(member.tag);
    return [...set].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
  }, [group.members]);

  const shown = useMemo(() => {
    if (selected.length === 0) return group.members;
    return group.members.filter((m) => selected.includes(m.tag ?? "none"));
  }, [group.members, selected]);

  if (tags.length === 0) return <>{renderMembers(group.members)}</>;

  const toggle = (value: string) =>
    setSelected((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));

  return (
    <>
      <div className={styles.bar}>
        <ControlPopover
          open={open}
          onOpen={() => setOpen(true)}
          onClose={() => setOpen(false)}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6h16M7 12h10M10 18h4" />
            </svg>
          }
          label={selected.length > 0 ? `Tags (${selected.length})` : "Tags"}
          panelWidth="fit"
          headerLeft={
            <button
              type="button"
              className={styles.clearButton}
              onClick={() => setSelected([])}
              disabled={selected.length === 0}
            >
              Limpar
            </button>
          }
        >
          <FilterCheckboxGroup
            layout="wrap"
            group={{
              key: "tag",
              title: "Tag",
              options: [{ value: "none", label: "Sem tag" }, ...tags.map((t) => ({ value: t, label: t }))],
              selected,
              onToggle: toggle,
            }}
          />
        </ControlPopover>
        {selected.length > 0 && (
          <span className={styles.count}>
            {shown.length} de {group.members.length}
          </span>
        )}
      </div>
      {shown.length > 0 ? (
        renderMembers(shown)
      ) : (
        <div className={styles.empty}>Nenhum vídeo com essa tag.</div>
      )}
    </>
  );
}
