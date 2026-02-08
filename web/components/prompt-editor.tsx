"use client";

import { useEffect, useState } from "react";

type PromptFile = {
  name: string;
  content: string;
};

export function PromptEditor() {
  const [prompts, setPrompts] = useState<PromptFile[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [content, setContent] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/prompts")
      .then((res) => res.json())
      .then((data) => {
        setPrompts(data.prompts ?? []);
        if (data.prompts?.length) {
          setSelected(data.prompts[0].name);
          setContent(data.prompts[0].content);
        }
      })
      .catch(() => setPrompts([]));
  }, []);

  const onSelect = (name: string) => {
    setSelected(name);
    const prompt = prompts.find((item) => item.name === name);
    setContent(prompt?.content ?? "");
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch(`/api/prompts/${selected}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setSaving(false);
    setMessage(res.ok ? "保存しました" : "保存に失敗しました");
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <header className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">prompts</h2>
        <button
          className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          onClick={save}
          disabled={saving || !selected}
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </header>
      <div className="mb-3 flex gap-2">
        <select
          className="w-full rounded-xl border border-slate-800 bg-slate-950 p-2 text-sm"
          value={selected}
          onChange={(event) => onSelect(event.target.value)}
        >
          {prompts.map((prompt) => (
            <option key={prompt.name} value={prompt.name}>
              {prompt.name}
            </option>
          ))}
        </select>
      </div>
      <textarea
        className="min-h-[320px] w-full resize-y rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-sm"
        value={content}
        onChange={(event) => setContent(event.target.value)}
      />
      {message && <p className="mt-3 text-sm text-slate-300">{message}</p>}
    </section>
  );
}