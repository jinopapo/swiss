"use client";

import { useEffect, useMemo, useState } from "react";

type ReviewConfig = {
  uid: string;
  name: string;
  description: string;
  model: string;
  parallel: boolean;
};

type SwissConfig = {
  model: string;
  reviews: ReviewConfig[];
};

type PromptMap = Record<string, string>;

const MODEL_OPTIONS = [
  "gpt-5.2",
  "gpt-5.1-codex-max",
  "gpt-5.2-codex",
  "gpt-5.1-codex-mini",
];
const WORKFLOW_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

const createReviewId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const emptyReview = (): ReviewConfig => ({
  uid: createReviewId(),
  name: "",
  description: "",
  model: "",
  parallel: false,
});

const EMPTY_CONFIG: SwissConfig = {
  model: "",
  reviews: [],
};

export function ConfigEditor() {
  const [workflows, setWorkflows] = useState<string[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState("");
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [renameWorkflowName, setRenameWorkflowName] = useState("");
  const [config, setConfig] = useState<SwissConfig>(EMPTY_CONFIG);
  const [prompts, setPrompts] = useState<PromptMap>({});
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;
    const load = async () => {
      try {
        const [workflowsRes, promptsRes] = await Promise.all([
          fetch("/api/workflows"),
          fetch("/api/prompts"),
        ]);
        const workflowData = (await workflowsRes.json()) as {
          workflows?: string[];
        };
        const promptData = (await promptsRes.json()) as {
          prompts?: { name: string; content: string }[];
        };
        if (canceled) return;
        const loadedWorkflows = workflowData.workflows ?? [];
        const loadedPrompts = Object.fromEntries(
          (promptData.prompts ?? []).map((prompt) => [prompt.name, prompt.content])
        );

        setWorkflows(loadedWorkflows);
        setSelectedWorkflow("");
        setPrompts(loadedPrompts);
      } catch {
        if (!canceled) {
          setConfig(EMPTY_CONFIG);
          setPrompts({});
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    };

    void load();
    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedWorkflow) return;

    let canceled = false;
    const load = async () => {
      setLoadingConfig(true);
      try {
        const configRes = await fetch(
          `/api/config?workflow=${encodeURIComponent(selectedWorkflow)}`
        );
        const configData = (await configRes.json()) as {
          config?: SwissConfig;
        };
        if (canceled) return;
        const loadedConfig = configData.config ?? EMPTY_CONFIG;
        const contextRes = await fetch(
          `/api/context?workflow=${encodeURIComponent(selectedWorkflow)}`
        );
        const contextData = (await contextRes.json()) as { content?: string };
        setConfig({
          model: loadedConfig.model ?? "",
          reviews: (loadedConfig.reviews ?? []).map((review) => ({
            uid: createReviewId(),
            name: review.name ?? "",
            description: review.description ?? "",
            model: review.model ?? "",
            parallel: review.parallel ?? false,
          })),
        });
        setContext(contextData.content ?? "");
      } catch {
        if (!canceled) {
          setConfig(EMPTY_CONFIG);
          setContext("");
        }
      } finally {
        if (!canceled) {
          setLoadingConfig(false);
        }
      }
    };

    void load();
    return () => {
      canceled = true;
    };
  }, [selectedWorkflow]);

  const reviewCount = config.reviews.length;

  const hasInvalid = useMemo(() => {
    if (!config.model.trim()) return true;
    if (config.reviews.length === 0) return true;
    return config.reviews.some((review) => !review.name.trim());
  }, [config]);

  const save = async () => {
    if (hasInvalid) {
      setMessage(
        "モデル名とレビュー名を入力し、レビューを1つ以上追加してください。"
      );
      return;
    }
    if (!selectedWorkflow) {
      setMessage("workflow を選択してください");
      return;
    }
    setSaving(true);
    setMessage(null);
    const configToSave = {
      model: config.model,
      reviews: config.reviews.map((review) => ({
        name: review.name,
        description: review.description,
        model: review.model,
        parallel: review.parallel,
      })),
    };
    const res = await fetch(`/api/config?workflow=${encodeURIComponent(selectedWorkflow)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: configToSave }),
    });
    if (res.ok) {
      const promptRequests = config.reviews.map((review) =>
        fetch(`/api/prompts/${review.name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: prompts[review.name] ?? "" }),
        })
      );
      const contextRequest = fetch(
        `/api/context?workflow=${encodeURIComponent(selectedWorkflow)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: context }),
        }
      );
      await Promise.all([...promptRequests, contextRequest]);
    }
    setSaving(false);
    setMessage(res.ok ? "保存しました" : "保存に失敗しました");
  };

  const createWorkflow = async () => {
    const workflow = newWorkflowName.trim();
    if (!workflow) {
      setMessage("新規 workflow 名を入力してください");
      return;
    }
    if (workflows.includes(workflow)) {
      setMessage("同名の workflow がすでに存在します");
      return;
    }
    if (!WORKFLOW_NAME_PATTERN.test(workflow)) {
      setMessage("workflow名は英数字・ハイフン・アンダースコアのみ使用できます");
      return;
    }

    setSaving(true);
    setMessage(null);
    const res = await fetch(`/api/config?workflow=${encodeURIComponent(workflow)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config: EMPTY_CONFIG }),
    });
    setSaving(false);

    if (!res.ok) {
      setMessage("workflow の作成に失敗しました");
      return;
    }

    setWorkflows((prev) => [...prev, workflow].sort((a, b) => a.localeCompare(b)));
    setSelectedWorkflow(workflow);
    setNewWorkflowName("");
    setContext("");
    setMessage(`workflow '${workflow}' を作成しました`);
  };

  const renameWorkflow = async () => {
    const from = selectedWorkflow.trim();
    const to = renameWorkflowName.trim();

    if (!from) {
      setMessage("workflow を選択してください");
      return;
    }
    if (!to) {
      setMessage("変更後 workflow 名を入力してください");
      return;
    }
    if (from === to) {
      setMessage("変更前と変更後の workflow 名が同じです");
      return;
    }
    if (workflows.includes(to)) {
      setMessage("同名の workflow がすでに存在します");
      return;
    }
    if (!WORKFLOW_NAME_PATTERN.test(to)) {
      setMessage("workflow名は英数字・ハイフン・アンダースコアのみ使用できます");
      return;
    }

    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/workflows/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from, to }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setSaving(false);
      setMessage(data.error ?? "workflow 名の変更に失敗しました");
      return;
    }

    setWorkflows((prev) =>
      prev
        .map((workflow) => (workflow === from ? to : workflow))
        .sort((a, b) => a.localeCompare(b))
    );
    setSelectedWorkflow(to);
    setRenameWorkflowName("");
    setSaving(false);
    setMessage(`workflow 名を '${from}' から '${to}' に変更しました`);
  };

  const updateModel = (value: string) => {
    setConfig((prev) => ({ ...prev, model: value }));
  };

  const addReview = () => {
    setConfig((prev) => ({ ...prev, reviews: [...prev.reviews, emptyReview()] }));
  };

  const removeReview = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      reviews: prev.reviews.filter((_, idx) => idx !== index),
    }));
  };

  const moveReview = (from: number, to: number) => {
    setConfig((prev) => {
      if (to < 0 || to >= prev.reviews.length) return prev;
      const next = [...prev.reviews];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return { ...prev, reviews: next };
    });
  };

  const updateReview = (index: number, patch: Partial<ReviewConfig>) => {
    setConfig((prev) => ({
      ...prev,
      reviews: prev.reviews.map((review, idx) =>
        idx === index ? { ...review, ...patch } : review
      ),
    }));
  };

  const updateReviewName = (
    index: number,
    currentName: string,
    nextName: string
  ) => {
    setConfig((prev) => {
      const current = prev.reviews[index];
      if (!current) return prev;
      return {
        ...prev,
        reviews: prev.reviews.map((review, idx) =>
          idx === index ? { ...review, name: nextName } : review
        ),
      };
    });
    setPrompts((prev) => {
      if (!currentName || currentName === nextName) return prev;
      if (prev[nextName]) return prev;
      return { ...prev, [nextName]: prev[currentName] ?? "" };
    });
  };

  const updatePrompt = (name: string, content: string) => {
    setPrompts((prev) => ({ ...prev, [name]: content }));
  };

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">設定フォーム</h2>
          <p className="text-sm text-slate-300">
            workflow ごとのステップと共有プロンプトを編集できます。
          </p>
        </div>
        <button
          className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          onClick={save}
          disabled={saving || loading || loadingConfig || !selectedWorkflow}
        >
          {saving ? "保存中..." : "保存"}
        </button>
      </header>

      {loading ? (
        <p className="text-sm text-slate-300">読み込み中...</p>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <h3 className="text-sm font-semibold text-slate-200">workflow</h3>
            {workflows.length === 0 && (
              <p className="mt-2 text-xs text-slate-400">
                workflow がまだありません。新規作成してから設定を編集してください。
              </p>
            )}
            <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]">
              <select
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
                value={selectedWorkflow}
                onChange={(event) => {
                  setSelectedWorkflow(event.target.value);
                  setMessage(null);
                }}
                disabled={workflows.length === 0}
              >
                {workflows.length === 0 ? (
                  <option value="">workflow がありません</option>
                ) : (
                  <option value="">workflow を選択してください</option>
                )}
                {workflows.map((workflow) => (
                  <option key={workflow} value={workflow}>
                    {workflow}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
                  placeholder="new-workflow"
                  value={newWorkflowName}
                  onChange={(event) => setNewWorkflowName(event.target.value)}
                />
                <button
                  className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 disabled:opacity-50"
                  onClick={createWorkflow}
                  type="button"
                  disabled={saving}
                >
                  新規作成
                </button>
              </div>
            </div>
            <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_auto]">
              <input
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
                placeholder="rename-workflow"
                value={renameWorkflowName}
                onChange={(event) => setRenameWorkflowName(event.target.value)}
              />
              <button
                className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 disabled:opacity-50"
                onClick={renameWorkflow}
                type="button"
                disabled={saving || !selectedWorkflow}
              >
                名前変更
              </button>
            </div>
          </div>

          {selectedWorkflow && loadingConfig ? (
            <p className="text-sm text-slate-300">workflow 設定を読み込み中...</p>
          ) : !selectedWorkflow ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
              編集する workflow を選択するか、新規作成してください。
            </div>
          ) : (
            <>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <h3 className="text-sm font-semibold text-slate-200">グローバル設定</h3>
            <div className="mt-3 space-y-2">
              <label className="text-xs text-slate-400">デフォルトモデル</label>
              <select
                className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
                value={config.model}
                onChange={(event) => updateModel(event.target.value)}
              >
                <option value="" disabled>
                  モデルを選択してください
                </option>
                {MODEL_OPTIONS.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <h3 className="text-sm font-semibold text-slate-200">共有コンテキスト</h3>
            <p className="mt-1 text-xs text-slate-400">
              workflow 内の全レビューに共通で差し込むコンテキストです（プロンプト最上部）。
            </p>
            <div className="mt-3 space-y-2">
              <label className="text-xs text-slate-400">内容</label>
              <textarea
                className="min-h-[140px] w-full resize-y rounded-lg border border-slate-800 bg-slate-900 p-3 font-mono text-sm"
                placeholder="この workflow 全体で共有したい前提・ルールを入力"
                value={context}
                onChange={(event) => setContext(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-200">ワークフロー</h3>
                <p className="text-xs text-slate-400">
                  レビュー順と並列設定がそのままワークフローになります。
                </p>
              </div>
              <button
                className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200"
                onClick={addReview}
                type="button"
              >
                + レビュー追加
              </button>
            </div>

            {reviewCount === 0 && (
              <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">
                レビューを追加するとワークフローが表示されます。
              </div>
            )}

            <div className="space-y-4">
              {config.reviews.map((review, index) => (
                <div
                  key={review.uid}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <span>ステップ {index + 1}</span>
                        {review.parallel && (
                          <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] text-emerald-200">
                            並列
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">
                        {review.description || "説明が未入力です"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-200 disabled:opacity-50"
                        onClick={() => moveReview(index, index - 1)}
                        disabled={index === 0}
                        type="button"
                      >
                        ↑
                      </button>
                      <button
                        className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-200 disabled:opacity-50"
                        onClick={() => moveReview(index, index + 1)}
                        disabled={index === reviewCount - 1}
                        type="button"
                      >
                        ↓
                      </button>
                      <button
                        className="rounded-full border border-rose-500/40 px-2 py-1 text-xs text-rose-200"
                        onClick={() => removeReview(index)}
                        type="button"
                      >
                        削除
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400">レビュー名</label>
                      <input
                        className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
                        placeholder="review-1"
                        value={review.name}
                        onChange={(event) =>
                          updateReviewName(index, review.name, event.target.value)
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400">モデル（任意）</label>
                      <select
                        className="w-full rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
                        value={review.model}
                        onChange={(event) =>
                          updateReview(index, { model: event.target.value })
                        }
                      >
                        <option value="">未指定（デフォルトを使用）</option>
                        {MODEL_OPTIONS.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2 lg:col-span-2">
                      <label className="text-xs text-slate-400">説明</label>
                      <textarea
                        className="min-h-[80px] w-full resize-y rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm"
                        placeholder="このレビューの目的や観点を入力"
                        value={review.description}
                        onChange={(event) =>
                          updateReview(index, { description: event.target.value })
                        }
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-700 bg-slate-900"
                        checked={review.parallel}
                        onChange={(event) =>
                          updateReview(index, { parallel: event.target.checked })
                        }
                      />
                      このレビューを他のステップと並列で実行する
                    </label>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs text-slate-400">プロンプト</label>
                      <span className="text-[11px] text-slate-500">
                        {review.name ? `${review.name}.md` : "レビュー名を入力してください"}
                      </span>
                    </div>
                    <textarea
                      className="min-h-[160px] w-full resize-y rounded-lg border border-slate-800 bg-slate-900 p-3 font-mono text-sm"
                      placeholder="レビュー用プロンプトを入力"
                      value={review.name ? prompts[review.name] ?? "" : ""}
                      onChange={(event) =>
                        updatePrompt(review.name, event.target.value)
                      }
                      disabled={!review.name}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
            </>
          )}
        </div>
      )}

      {message && <p className="mt-4 text-sm text-slate-300">{message}</p>}
    </section>
  );
}