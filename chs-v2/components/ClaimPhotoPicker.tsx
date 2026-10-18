"use client";

import { useEffect, useMemo, useRef } from "react";

// Pick photos from the gallery or camera and show small previews. Files are uploaded by the parent on submit.
export default function ClaimPhotoPicker({ files, onChange, max = 8, label = "Add photos" }: { files: File[]; onChange: (f: File[]) => void; max?: number; label?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const urls = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => urls.forEach((x) => URL.revokeObjectURL(x)), [urls]);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <div key={u} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" className="w-full h-full object-cover" />
            <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))} className="absolute top-0 right-0 bg-black/60 text-white text-[10px] w-5 h-5 leading-5 text-center rounded-bl">✕</button>
          </div>
        ))}
        {files.length < max && (
          <button type="button" onClick={() => ref.current?.click()} className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 text-[10px] text-gray-500 font-semibold">＋ {label}</button>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const add = Array.from(e.target.files || []); onChange([...files, ...add].slice(0, max)); e.target.value = ""; }} />
    </div>
  );
}
