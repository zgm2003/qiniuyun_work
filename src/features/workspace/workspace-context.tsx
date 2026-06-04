"use client";

import { createContext, type ReactNode, useContext, useMemo, useState, useSyncExternalStore, useTransition } from "react";
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
import { buildModelOptions } from "./model-options";
import { fetchProviderModels } from "./model-list-client";
import { DEFAULT_PRODUCT_PROVIDER } from "./provider-options";

export type ProviderName = "mock" | "openai-compatible";

type ConvertSuccess = {
  yaml: string;
  report: ConversionReport;
};

type ConvertFailure = {
  error: string;
};

export type ModelListStatus = "idle" | "loading" | "ready" | "error";

export type WorkspaceContextValue = {
  title: string;
  setTitle: (value: string) => void;
  novelText: string;
  setNovelText: (value: string) => void;
  yamlText: string;
  setYamlText: (value: string) => void;
  report: ConversionReport | null;
  error: string;
  setErrorMessage: (value: string) => void;
  sourceMessage: string;
  draftMessage: string;
  provider: ProviderName;
  setProvider: (value: ProviderName) => void;
  baseUrl: string;
  setBaseUrl: (value: string) => void;
  model: string;
  setModel: (value: string) => void;
  temperature: number;
  setTemperature: (value: number) => void;
  apiKey: string;
  setApiKey: (value: string) => void;
  modelIds: string[];
  modelOptions: ReturnType<typeof buildModelOptions>;
  modelListStatus: ModelListStatus;
  modelListMessage: string;
  canFetchModels: boolean;
  isModelListPending: boolean;
  isPending: boolean;
  drafts: LocalProjectDraft[];
  chapters: ReturnType<typeof parseNovelChapters>;
  chapterOutline: ReturnType<typeof buildChapterOutline>;
  yamlValidation: ReturnType<typeof validateScriptYaml> | null;
  scriptQuality: ReturnType<typeof buildScriptQualityChecklist>;
  canConvert: boolean;
  validationText: string;
  activeProviderText: string;
  activeDraft: LocalProjectDraft | undefined;
  outlineStatusText: string;
  loadSample: () => void;
  importNovelFile: (file: File) => Promise<void>;
  saveDraft: () => void;
  loadDraft: (draft: LocalProjectDraft) => void;
  deleteDraft: (draftId: string) => void;
  fetchModels: () => Promise<void>;
  convert: () => void;
  downloadYaml: () => void;
  formatQualityStatus: (status: ScriptQualityStatus) => string;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

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

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState(SAMPLE_TITLE);
  const [novelText, setNovelText] = useState(SAMPLE_NOVEL);
  const [yamlText, setYamlText] = useState("");
  const [report, setReport] = useState<ConversionReport | null>(null);
  const [error, setError] = useState("");
  const [sourceMessage, setSourceMessage] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [provider, setProvider] = useState<ProviderName>(DEFAULT_PRODUCT_PROVIDER);
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [model, setModel] = useState("gpt-4.1-mini");
  const [temperature, setTemperature] = useState(0.2);
  const [apiKey, setApiKey] = useState("");
  const [modelIds, setModelIds] = useState<string[]>([]);
  const [modelListStatus, setModelListStatus] = useState<ModelListStatus>("idle");
  const [modelListMessage, setModelListMessage] = useState("填写 API Key 后可从供应商实时获取模型列表。");
  const [isModelListPending, setIsModelListPending] = useState(false);
  const [isPending, startTransition] = useTransition();
  const drafts = useSyncExternalStore(subscribeLocalDrafts, getLocalDraftsSnapshot, getServerDraftsSnapshot);

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
    setModelIds([]);
    setModelListStatus("idle");
    setModelListMessage("填写 API Key 后可从供应商实时获取模型列表。");
    setDraftMessage("已加载样例，当前不绑定任何草稿。");
    setActiveDraftId(null);
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
    setModelIds([]);
    setModelListStatus("idle");
    setModelListMessage("填写 API Key 后可从供应商实时获取模型列表。");
    setDraftMessage("已导入本地文本，当前不绑定任何草稿。");
    setActiveDraftId(null);
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

  async function fetchModels() {
    setError("");
    setIsModelListPending(true);
    setModelListStatus("loading");
    setModelListMessage("正在从供应商获取模型列表...");

    try {
      const models = await fetchProviderModels({
        provider,
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim()
      });

      setModelIds(models);
      if (models.length > 0 && !model.trim()) {
        setModel(models[0]);
      }
      setModelListStatus("ready");
      setModelListMessage(`已获取 ${models.length} 个模型。`);
    } catch (modelsError) {
      const message = modelsError instanceof Error ? modelsError.message : "获取模型列表失败";
      setModelIds([]);
      setModelListStatus("error");
      setModelListMessage(message);
    } finally {
      setIsModelListPending(false);
    }
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
  const canFetchModels = provider === "openai-compatible" && Boolean(apiKey.trim());
  const modelOptions = useMemo(() => buildModelOptions(modelIds, model), [modelIds, model]);
  const validationText = yamlValidation
    ? yamlValidation.ok
      ? "Schema 校验通过，可以导出。"
      : formatValidationErrors(yamlValidation.errors)
    : "转换后会在这里显示 YAML Schema 校验结果。";
  const activeProviderText = provider;
  const activeDraft = drafts.find((draft) => draft.id === activeDraftId);
  const outlineStatusText = chapterOutline.ready
    ? `已达到最低 ${chapterOutline.minimumChapters} 章要求`
    : `还差 ${chapterOutline.missingChapterCount} 章`;

  const value: WorkspaceContextValue = {
    title,
    setTitle,
    novelText,
    setNovelText,
    yamlText,
    setYamlText,
    report,
    error,
    setErrorMessage: setError,
    sourceMessage,
    draftMessage,
    provider,
    setProvider,
    baseUrl,
    setBaseUrl,
    model,
    setModel,
    temperature,
    setTemperature,
    apiKey,
    setApiKey,
    modelIds,
    modelOptions,
    modelListStatus,
    modelListMessage,
    canFetchModels,
    isModelListPending,
    isPending,
    drafts,
    chapters,
    chapterOutline,
    yamlValidation,
    scriptQuality,
    canConvert,
    validationText,
    activeProviderText,
    activeDraft,
    outlineStatusText,
    loadSample,
    importNovelFile,
    saveDraft,
    loadDraft,
    deleteDraft,
    fetchModels,
    convert,
    downloadYaml,
    formatQualityStatus
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) {
    throw new Error("useWorkspace must be used inside WorkspaceProvider");
  }

  return value;
}
