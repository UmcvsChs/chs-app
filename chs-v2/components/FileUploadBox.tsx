"use client";

import { useState, useRef, DragEvent } from "react";

// Real, new, reusable upload box per a specific, direct client
// complaint: a plain <input type="file"> looked exactly like a line
// of instruction text — nothing told anyone this was where to
// actually click. Every real place someone uploads an image or
// document across this app should use this same, unique, unmistakable
// design instead of a bare input, so people never have to guess where
// to click.
export default function FileUploadBox({
  onFileSelect,
  accept = "image/*",
  label = "Upload a photo or document",
  selectedFileName,
  id,
  highlighted,
}: {
  onFileSelect: (file: File | null) => void;
  accept?: string;
  label?: string;
  selectedFileName?: string | null;
  id?: string;
  highlighted?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFileSelect(file);
  }

  return (
    <div
      id={id}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition-colors ${
        highlighted
          ? "border-chs-red border-2 bg-chs-amber-light"
          : selectedFileName
          ? "border-green-400 bg-green-50"
          : dragging
          ? "border-chs-red bg-chs-amber-light"
          : "border-chs-red/40 bg-chs-amber-light/40 hover:bg-chs-amber-light"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFileSelect(e.target.files?.[0] || null)}
      />
      {selectedFileName ? (
        <>
          <p className="text-xl">✓</p>
          <p className="text-xs font-semibold text-green-700 mt-1">{selectedFileName}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">Tap to choose a different file</p>
        </>
      ) : (
        <>
          <p className="text-2xl">📤</p>
          <p className="text-xs font-bold text-chs-red mt-1">Click to upload{accept.startsWith("image") ? " a photo" : " a file"}</p>
          <p className="text-[10px] text-gray-500 mt-0.5">or drag and drop it here — {label}</p>
        </>
      )}
    </div>
  );
}
