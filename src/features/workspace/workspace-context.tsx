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
import { buildConvertModelConfig, type RuntimeEnvironment } from "./model-request-config";
import { DEFAULT_PRODUCT_MODEL, DEFAULT_PRODUCT_PROVIDER } from "./provider-options";
import {
  createServerProject,
  saveServerScriptVersion,
  type ServerProjectDetail,
  updateServerProject
} from "./server-projects-client";

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
  serverProjectId: string | null;
  serverProjectMessage: string;
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
  isProductionRuntime: boolean;
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
  loadServerProjectIntoWorkspace: (project: ServerProjectDetail) => void;
  saveCurrentWorkspaceToServer: () => Promise<void>;
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
const MODEL_LIST_DEVELOPMENT_MESSAGE = "填写 API Key 后可从供应商实时获取模型列表。";
const MODEL_LIST_PRODUCTION_MESSAGE = "生产环境使用服务端 AI 配置，不从浏览器获取模型列表。";
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
  const isProductionRuntime = process.env.NODE_ENV === "production";
  const [title, setTitle] = useState(SAMPLE_TITLE);
  const [novelText, setNovelText] = useState(SAMPLE_NOVEL);
  const [yamlText, setYamlText] = useState("");
  const [report, setReport] = useState<ConversionReport | null>(null);
  const [error, setError] = useState("");
  const [sourceMessage, setSourceMessage] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [serverProjectId, setServerProjectId] = useState<string | null>(null);
  const [serverProjectMessage, setServerProjectMessage] = useState("");
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [provider, setProvider] = useState<ProviderName>(DEFAULT_PRODUCT_PROVIDER);
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [model, setModel] = useState(DEFAULT_PRODUCT_MODEL);
  const [temperature, setTemperature] = useState(0.2);
  const [apiKey, setApiKey] = useState("");
  const [modelIds, setModelIds] = useState<string[]>([]);
  const [modelListStatus, setModelListStatus] = useState<ModelListStatus>("idle");
  const [modelListMessage, setModelListMessage] = useState(
    isProductionRuntime ? MODEL_LIST_PRODUCTION_MESSAGE : MODEL_LIST_DEVELOPMENT_MESSAGE
  );
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
    setModelListMessage(isProductionRuntime ? MODEL_LIST_PRODUCTION_MESSAGE : MODEL_LIST_DEVELOPMENT_MESSAGE);
    setDraftMessage("已加载样例，当前不绑定任何草稿。");
    setActiveDraftId(null);
    setServerProjectId(null);
    setServerProjectMessage("");
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
    setModelListMessage(isProductionRuntime ? MODEL_LIST_PRODUCTION_MESSAGE : MODEL_LIST_DEVELOPMENT_MESSAGE);
    setDraftMessage("已导入本地文本，当前不绑定任何草稿。");
    setActiveDraftId(null);
    setServerProjectId(null);
    setServerProjectMessage("");
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
    setServerProjectId(null);
    setServerProjectMessage("已加载本地草稿，当前不绑定服务端项目。");
  }

  function deleteDraft(draftId: string) {
    deleteLocalProjectDraft(window.localStorage, draftId);
    notifyLocalDraftsChanged();
    if (activeDraftId === draftId) {
      setActiveDraftId(null);
    }
    setDraftMessage("已删除草稿。当前编辑区不会被清空。");
  }

  function loadServerProjectIntoWorkspace(project: ServerProjectDetail) {
    setTitle(project.title);
    setNovelText(project.sourceText);
    setYamlText(project.latestVersion?.yaml ?? "");
    setReport(project.latestVersion?.report ?? null);
    setError("");
    setSourceMessage(`已加载服务端项目：${project.title}`);
    setDraftMessage("已加载服务端项目，localStorage 草稿未被修改。");
    setServerProjectId(project.id);
    setServerProjectMessage(`当前绑定服务端项目：${project.title}`);
    setActiveDraftId(null);
  }

  async function saveCurrentWorkspaceToServer() {
    setError("");
    setServerProjectMessage("正在保存到服务端...");

    try {
      const savedProject = serverProjectId
        ? await updateServerProject(serverProjectId, title, novelText)
        : await createServerProject(title, novelText);
      setServerProjectId(savedProject.id);

      if (yamlValidation?.ok && report) {
        await saveServerScriptVersion(savedProject.id, yamlText, report);
        setServerProjectMessage(`已保存服务端项目和 YAML 版本：${savedProject.title}`);
        return;
      }

      setServerProjectMessage(`已保存服务端项目：${savedProject.title}。YAML 通过校验并有转换报告后才会保存版本。`);
    } catch (serverError) {
      const message = serverError instanceof Error ? serverError.message : "服务端项目保存失败";
      setError(message);
      setServerProjectMessage(message);
    }
  }

  async function fetchModels() {
    if (isProductionRuntime) {
      setModelIds([]);
      setModelListStatus("idle");
      setModelListMessage(MODEL_LIST_PRODUCTION_MESSAGE);
      return;
    }

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
      const modelConfig = buildConvertModelConfig({
        provider,
        baseUrl,
        model,
        temperature,
        apiKey,
        nodeEnv: process.env.NODE_ENV as RuntimeEnvironment
      });
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
  const canFetchModels = !isProductionRuntime && provider === "openai-compatible" && Boolean(apiKey.trim());
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
    serverProjectId,
    serverProjectMessage,
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
    isProductionRuntime,
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
    loadServerProjectIntoWorkspace,
    saveCurrentWorkspaceToServer,
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
