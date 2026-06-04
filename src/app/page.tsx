"use client";

import { type ChangeEvent, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { buildChapterOutline } from "@/lib/chapter-outline";
import { parseNovelChapters } from "@/lib/chapters";
import { SAMPLE_NOVEL, SAMPLE_TITLE } from "@/lib/demo-sample";
import { MAX_NOVEL_TEXT_IMPORT_BYTES, prepareNovelTextImport } from "@/lib/file-import";
import {
  deleteLocalProjectDraft,
  LOCAL_PROJECT_DRAFTS_STORAGE_KEY,
  readLocalProjectDrafts,
  type LocalProjectDraft,
  upsertLocalProjectDraft
} from "@/lib/local-drafts";
import { buildScriptQualityChecklist, type ScriptQualityStatus } from "@/lib/script-quality";
import { validateScriptYaml, type ScriptValidationError } from "@/lib/script-schema";
import type { ConversionReport } from "@/lib/mock-converter";

type ProviderName = "mock" | "openai-compatible";

type ConvertSuccess = {
  yaml: string;
  report: ConversionReport;
};

type ConvertFailure = {
  error: string;
};

function isConvertFailure(value: ConvertSuccess | ConvertFailure): value is ConvertFailure {
  return "error" in value;
}

function formatValidationErrors(errors: ScriptValidationError[]): string {
  return errors.map((error) => `${error.path}: ${error.message}`).join("\n");
}

function formatQualityStatus(status: ScriptQualityStatus): string {
  if (status === "pass") {
    return "通过";
  }

  if (status === "fail") {
    return "需修复";
  }

  return "等待生成";
}

function createDraftId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `draft-${Date.now()}`;
}

const EMPTY_DRAFTS: LocalProjectDraft[] = [];
const LOCAL_DRAFTS_CHANGED_EVENT = "novel-to-script-ai:local-drafts-changed";
let cachedDraftsRaw: string | null | undefined;
let cachedDrafts: LocalProjectDraft[] = EMPTY_DRAFTS;

function getLocalDraftsSnapshot(): LocalProjectDraft[] {
  if (typeof window === "undefined") {
    return EMPTY_DRAFTS;
  }

  const raw = window.localStorage.getItem(LOCAL_PROJECT_DRAFTS_STORAGE_KEY);
  if (raw === cachedDraftsRaw) {
    return cachedDrafts;
  }

  cachedDraftsRaw = raw;
  cachedDrafts = readLocalProjectDrafts(window.localStorage);
  return cachedDrafts;
}

function getServerDraftsSnapshot(): LocalProjectDraft[] {
  return EMPTY_DRAFTS;
}

function subscribeLocalDrafts(onStoreChange: () => void): () => void {
  function handleLocalChange() {
    onStoreChange();
  }

  function handleStorageChange(event: StorageEvent) {
    if (event.key === LOCAL_PROJECT_DRAFTS_STORAGE_KEY || event.key === null) {
      onStoreChange();
    }
  }

  window.addEventListener(LOCAL_DRAFTS_CHANGED_EVENT, handleLocalChange);
  window.addEventListener("storage", handleStorageChange);

  return () => {
    window.removeEventListener(LOCAL_DRAFTS_CHANGED_EVENT, handleLocalChange);
    window.removeEventListener("storage", handleStorageChange);
  };
}

function notifyLocalDraftsChanged() {
  cachedDraftsRaw = undefined;
  window.dispatchEvent(new Event(LOCAL_DRAFTS_CHANGED_EVENT));
}

export default function Home() {
  const [title, setTitle] = useState(SAMPLE_TITLE);
  const [novelText, setNovelText] = useState(SAMPLE_NOVEL);
  const [yamlText, setYamlText] = useState("");
  const [report, setReport] = useState<ConversionReport | null>(null);
  const [error, setError] = useState("");
  const [sourceMessage, setSourceMessage] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [provider, setProvider] = useState<ProviderName>("mock");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [model, setModel] = useState("gpt-4.1-mini");
  const [temperature, setTemperature] = useState(0.2);
  const [apiKey, setApiKey] = useState("");
  const [isPending, startTransition] = useTransition();
  const drafts = useSyncExternalStore(subscribeLocalDrafts, getLocalDraftsSnapshot, getServerDraftsSnapshot);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const chapters = useMemo(() => parseNovelChapters(novelText), [novelText]);
  const chapterOutline = useMemo(() => buildChapterOutline(chapters), [chapters]);
  const yamlValidation = useMemo(() => {
    if (!yamlText.trim()) {
      return null;
    }

    return validateScriptYaml(yamlText);
  }, [yamlText]);
  const scriptQuality = useMemo(() => buildScriptQualityChecklist(yamlValidation), [yamlValidation]);

  function loadSample() {
    setTitle(SAMPLE_TITLE);
    setNovelText(SAMPLE_NOVEL);
    setYamlText("");
    setReport(null);
    setError("");
    setSourceMessage("已加载样例文本，当前不绑定任何草稿。");
    setDraftMessage("已加载样例，当前不绑定任何草稿。");
    setActiveDraftId(null);
  }

  function openFileImport() {
    fileInputRef.current?.click();
  }

  async function importNovelFile(file: File) {
    if (file.size > MAX_NOVEL_TEXT_IMPORT_BYTES) {
      throw new Error("文件不能超过 512KB");
    }

    const text = await file.text();
    const imported = prepareNovelTextImport({
      fileName: file.name,
      size: file.size,
      text
    });

    setTitle(imported.title);
    setNovelText(imported.text);
    setYamlText("");
    setReport(null);
    setError("");
    setSourceMessage(`已导入 ${imported.fileName}，标题已设为“${imported.title}”。`);
    setDraftMessage("已导入本地文本，当前不绑定任何草稿。");
    setActiveDraftId(null);
  }

  async function handleNovelFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) {
      return;
    }

    try {
      await importNovelFile(file);
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : "导入文本失败";
      setError(message);
    }
  }

  function saveDraft() {
    const id = activeDraftId ?? createDraftId();
    const draft: LocalProjectDraft = {
      version: 1,
      id,
      title: title.trim() || "未命名草稿",
      novelText,
      yamlText,
      report,
      updatedAt: new Date().toISOString()
    };

    upsertLocalProjectDraft(window.localStorage, draft);
    notifyLocalDraftsChanged();
    setActiveDraftId(id);
    setDraftMessage(`已保存草稿：${draft.title}`);
  }

  function loadDraft(draft: LocalProjectDraft) {
    setTitle(draft.title);
    setNovelText(draft.novelText);
    setYamlText(draft.yamlText);
    setReport(draft.report);
    setError("");
    setDraftMessage(`已加载草稿：${draft.title}`);
    setActiveDraftId(draft.id);
  }

  function deleteDraft(draftId: string) {
    deleteLocalProjectDraft(window.localStorage, draftId);
    notifyLocalDraftsChanged();
    if (activeDraftId === draftId) {
      setActiveDraftId(null);
    }
    setDraftMessage("已删除草稿。当前编辑区不会被清空。");
  }

  function convert() {
    setError("");
    startTransition(async () => {
      const modelConfig =
        provider === "mock"
          ? { provider }
          : {
              provider,
              baseUrl: baseUrl.trim() || undefined,
              model: model.trim() || undefined,
              temperature,
              apiKey: apiKey.trim() || undefined
            };
      const response = await fetch("/api/convert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, text: novelText, modelConfig })
      });
      const body = (await response.json()) as ConvertSuccess | ConvertFailure;

      if (!response.ok || isConvertFailure(body)) {
        setError(isConvertFailure(body) ? body.error : "转换失败");
        return;
      }

      setYamlText(body.yaml);
      setReport(body.report);
    });
  }

  function downloadYaml() {
    if (!yamlValidation?.ok) {
      setError("YAML 未通过 Schema 校验，不能导出");
      return;
    }

    const blob = new Blob([yamlText], { type: "text/yaml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title || "script"}.yaml`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const canConvert = title.trim().length > 0 && novelText.trim().length > 0 && chapterOutline.ready;
  const validationText = yamlValidation
    ? yamlValidation.ok
      ? "Schema 校验通过，可以导出。"
      : formatValidationErrors(yamlValidation.errors)
    : "转换后会在这里显示 YAML Schema 校验结果。";
  const activeProviderText = report?.provider ?? provider;
  const activeDraft = drafts.find((draft) => draft.id === activeDraftId);
  const outlineStatusText = chapterOutline.ready
    ? `已达到最低 ${chapterOutline.minimumChapters} 章要求`
    : `还差 ${chapterOutline.missingChapterCount} 章`;

  return (
    <>
      <header className="top-nav">
        <div className="top-nav-inner">
          <a className="brand-mark" href="#workspace" aria-label="AI 小说转剧本工作台首页">
            <span className="brand-icon">剧</span>
            <span>
              <strong>ScriptForge</strong>
              <small>AI 小说转剧本</small>
            </span>
          </a>
          <nav aria-label="产品导航">
            <a href="#workspace">工作台</a>
            <a href="#model-config">AI 设置</a>
            <a href="#drafts">项目草稿</a>
            <a href="#report">质量报告</a>
          </nav>
          <span className="nav-status">MVP · Productizing</span>
        </div>
      </header>

      <main id="workspace" className="app-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Novel · YAML · Script</p>
          <h1>小说转剧本工作台</h1>
          <p className="lead">
            为作者准备的 AI 改编工作区：导入小说、识别章节、生成结构化 YAML 剧本，并用 Schema 与质量清单兜住交付质量。
          </p>
        </div>
        <div className="hero-card" aria-label="当前模型配置">
          <span>Provider</span>
          <strong>{activeProviderText}</strong>
          <small>{provider === "mock" ? "无 API Key 也能稳定录屏" : model}</small>
        </div>
      </section>

      <section className="workspace-grid" aria-label="小说转剧本工作区">
        <div className="panel input-panel">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Source Novel</p>
              <h2>小说输入</h2>
            </div>
            <div className="source-actions">
              <button className="ghost-button" type="button" onClick={openFileImport}>
                导入文本
              </button>
              <button className="ghost-button" type="button" onClick={loadSample}>
                加载样例
              </button>
              <input
                ref={fileInputRef}
                className="visually-hidden"
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                onChange={handleNovelFileChange}
              />
            </div>
          </div>

          <label className="field-label" htmlFor="title">
            标题
          </label>
          <input
            id="title"
            className="title-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="请输入作品标题"
          />

          <div id="model-config" className="model-config-card" aria-label="模型配置">
            <div className="model-config-head">
              <div>
                <p className="section-kicker">Model Config</p>
                <h3>模型配置</h3>
              </div>
              <span className={provider === "mock" ? "provider-pill mock" : "provider-pill live"}>
                {provider === "mock" ? "稳定演示" : "真实模型"}
              </span>
            </div>

            <div className="model-grid">
              <label>
                <span>Provider</span>
                <select
                  className="provider-select"
                  value={provider}
                  onChange={(event) => setProvider(event.target.value as ProviderName)}
                >
                  <option value="mock">mock</option>
                  <option value="openai-compatible">openai-compatible</option>
                </select>
              </label>

              <label>
                <span>Temperature</span>
                <input
                  className="compact-input"
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={temperature}
                  onChange={(event) => setTemperature(Number(event.target.value))}
                />
              </label>
            </div>

            {provider === "openai-compatible" ? (
              <div className="model-live-fields">
                <label>
                  <span>Base URL</span>
                  <input
                    className="compact-input"
                    value={baseUrl}
                    onChange={(event) => setBaseUrl(event.target.value)}
                    placeholder="https://api.openai.com/v1"
                  />
                </label>
                <label>
                  <span>Model</span>
                  <input
                    className="compact-input"
                    value={model}
                    onChange={(event) => setModel(event.target.value)}
                    placeholder="gpt-4.1-mini"
                  />
                </label>
                <label>
                  <span>API Key（仅本次请求）</span>
                  <input
                    className="compact-input sensitive-input"
                    type="password"
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    placeholder="不会保存到本地草稿或仓库"
                  />
                </label>
              </div>
            ) : (
              <p className="config-hint">mock provider 会忽略真实模型参数，用于无密钥稳定录屏。</p>
            )}
          </div>

          <label className="field-label" htmlFor="novel">
            小说正文
          </label>
          <textarea
            id="novel"
            className="novel-input"
            value={novelText}
            onChange={(event) => setNovelText(event.target.value)}
            spellCheck={false}
          />
          {sourceMessage ? <p className="source-message">{sourceMessage}</p> : null}

          <div className="chapter-outline-card" aria-label="章节大纲预览">
            <div className="chapter-outline-head">
              <div>
                <p className="section-kicker">Chapter Outline</p>
                <h3>章节大纲预览</h3>
              </div>
              <span className={chapterOutline.ready ? "outline-pill ok" : "outline-pill bad"}>
                {outlineStatusText}
              </span>
            </div>

            {chapterOutline.items.length > 0 ? (
              <ol className="chapter-outline-list">
                {chapterOutline.items.map((item) => (
                  <li className={item.isEmpty ? "chapter-outline-item empty" : "chapter-outline-item"} key={item.index}>
                    <div className="chapter-outline-meta">
                      <strong>
                        第 {item.index} 章 · {item.title}
                      </strong>
                      <span>{item.bodyCharacterCount} 字</span>
                    </div>
                    <p>{item.isEmpty ? "章节正文为空，转换前需要补正文。" : item.preview}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="empty-outline">还没有识别到章节。支持“第1章”“第一章”“Chapter 1”等标题格式。</p>
            )}
          </div>

          <div className="status-row">
            <span className={chapterOutline.ready ? "status ok" : "status bad"}>
              已识别 {chapterOutline.chapterCount} 章 · {outlineStatusText}
            </span>
            <button className="primary-button" type="button" disabled={!canConvert || isPending} onClick={convert}>
              {isPending ? "转换中..." : "转换为 YAML 剧本"}
            </button>
          </div>
          {error ? <p className="error-box">{error}</p> : null}
        </div>

        <div className="panel output-panel">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Generated Script</p>
              <h2>YAML 剧本</h2>
            </div>
            <button className="ghost-button" type="button" onClick={downloadYaml} disabled={!yamlValidation?.ok}>
              导出 YAML
            </button>
          </div>

          <textarea
            className="yaml-editor"
            value={yamlText}
            onChange={(event) => setYamlText(event.target.value)}
            placeholder="点击转换后，这里会出现可编辑 YAML。你可以故意删除 metadata.title 来演示 Schema 校验失败。"
            spellCheck={false}
          />

          <div className={yamlValidation?.ok ? "validation ok" : yamlValidation ? "validation bad" : "validation"}>
            <strong>{yamlValidation?.ok ? "校验通过" : yamlValidation ? "校验失败" : "等待校验"}</strong>
            <pre>{validationText}</pre>
          </div>

          <div className={`quality-card ${scriptQuality.status}`} aria-label="剧本质量清单">
            <div className="quality-head">
              <div>
                <p className="section-kicker">Quality Checklist</p>
                <h3>剧本质量清单</h3>
              </div>
              <span className={`quality-score ${scriptQuality.status}`}>
                {scriptQuality.passedCount}/{scriptQuality.items.length} 通过
              </span>
            </div>

            <ul className="quality-list">
              {scriptQuality.items.map((item) => (
                <li className={`quality-item ${item.status}`} key={item.id}>
                  <div className="quality-item-head">
                    <strong>{item.label}</strong>
                    <span>{formatQualityStatus(item.status)}</span>
                  </div>
                  <p>{item.description}</p>
                  <small>{item.detail}</small>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section id="drafts" className="drafts-panel" aria-label="本地项目草稿">
        <div className="drafts-head">
          <div>
            <p className="section-kicker">Local Drafts</p>
            <h2>本地项目草稿</h2>
            <p>
              草稿只保存在当前浏览器 localStorage。保存小说、YAML 和转换报告，不保存 API Key 或模型配置。
            </p>
          </div>
          <div className="draft-actions">
            <button className="primary-button" type="button" onClick={saveDraft}>
              {activeDraft ? "更新当前草稿" : "保存为新草稿"}
            </button>
            <span>{activeDraft ? `当前：${activeDraft.title}` : "当前未绑定草稿"}</span>
          </div>
        </div>

        {draftMessage ? <p className="draft-message">{draftMessage}</p> : null}

        {drafts.length > 0 ? (
          <div className="draft-list">
            {drafts.map((draft) => (
              <article className={draft.id === activeDraftId ? "draft-card active" : "draft-card"} key={draft.id}>
                <div>
                  <h3>{draft.title}</h3>
                  <p>
                    {new Date(draft.updatedAt).toLocaleString("zh-CN")} · {draft.report?.sceneCount ?? 0} 场 ·{" "}
                    {draft.yamlText.trim() ? "含 YAML" : "仅小说"}
                  </p>
                </div>
                <div className="draft-card-actions">
                  <button className="ghost-button" type="button" onClick={() => loadDraft(draft)}>
                    加载
                  </button>
                  <button className="ghost-button danger-button" type="button" onClick={() => deleteDraft(draft.id)}>
                    删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-drafts">还没有草稿。先转换或编辑内容，再点击“保存为新草稿”。</p>
        )}
      </section>

      <section id="report" className="metrics-panel" aria-label="转换总结">
        <div>
          <p className="section-kicker">Conversion Report</p>
          <h2>课后式总结</h2>
        </div>
        <div className="metrics-grid">
          <Metric label="章节" value={report?.chapterCount ?? chapters.length} />
          <Metric label="角色" value={report?.characterCount ?? "—"} />
          <Metric label="场景" value={report?.sceneCount ?? "—"} />
          <Metric label="台词" value={report?.dialogueLineCount ?? "—"} />
        </div>
      </section>
      </main>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
