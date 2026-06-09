"use client";

import classNames from "classnames";
import { cldThumb } from "lib/cloudinary";
import type { ImageSet } from "lib/imageSets";

function Preview({ urls }: { urls: string[] }) {
  return (
    <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-slate-700">
      {Array.from({ length: 4 }).map((_, i) =>
        urls[i] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={cldThumb(urls[i], 120)} alt="" className="h-full w-full object-cover" />
        ) : (
          <div key={i} className="bg-slate-800" />
        )
      )}
    </div>
  );
}

function Tile({
  selected,
  label,
  onClick,
  children,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className="flex w-20 shrink-0 flex-col items-center gap-1">
      <div
        className={classNames(
          "relative h-16 w-20 overflow-hidden rounded-lg ring-2 transition",
          selected ? "ring-indigo-400" : "ring-transparent hover:ring-slate-600"
        )}
      >
        {children}
        {selected && (
          <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-indigo-500 text-[0.6rem] font-bold text-white">
            ✓
          </span>
        )}
      </div>
      <span
        className={classNames(
          "w-full truncate text-center text-xs",
          selected ? "font-semibold text-indigo-300" : "text-slate-400"
        )}
      >
        {label}
      </span>
    </button>
  );
}

/**
 * Selectable tiles for choosing image sets. Multiple sets can be picked (their
 * images are combined); the "Emojis" tile clears the selection. `selectedIds`
 * empty = emojis only.
 */
export default function TileSetPicker({
  sets,
  selectedIds,
  onChange,
}: {
  sets: ImageSet[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  if (!sets.length) return null;
  const toggle = (id: string) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);

  return (
    <div className="flex flex-wrap justify-center gap-3">
      <Tile selected={selectedIds.length === 0} label="Emojis" onClick={() => onChange([])}>
        <div className="grid h-full w-full grid-cols-2 grid-rows-2 place-items-center bg-slate-800 text-base">
          <span>🙂</span>
          <span>⚽</span>
          <span>🍕</span>
          <span>🐶</span>
        </div>
      </Tile>
      {sets.map((s) => (
        <Tile key={s.id} selected={selectedIds.includes(s.id)} label={s.name} onClick={() => toggle(s.id)}>
          <Preview urls={s.images.map((i) => i.url)} />
        </Tile>
      ))}
    </div>
  );
}
