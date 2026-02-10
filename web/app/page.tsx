import { ConfigEditor } from "@/components/config-editor";

export default function Home() {
  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">swiss 設定</h1>
          <p className="text-sm text-slate-300">
            .swiss/flows と .swiss/prompts を編集できます。
          </p>
        </header>
        <ConfigEditor />
      </div>
    </main>
  );
}