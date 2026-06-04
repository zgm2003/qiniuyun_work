import type { ScriptValidationError, ScriptValidationResult } from "./script-schema";

export type ScriptQualityStatus = "pending" | "pass" | "fail";

export type ScriptQualityCheckId =
  | "schema"
  | "metadata"
  | "characters"
  | "scenes"
  | "scene-dialogue"
  | "dialogue-references"
  | "summary";

export type ScriptQualityCheck = {
  id: ScriptQualityCheckId;
  label: string;
  description: string;
  status: ScriptQualityStatus;
  detail: string;
};

export type ScriptQualityChecklist = {
  status: ScriptQualityStatus;
  passedCount: number;
  failedCount: number;
  pendingCount: number;
  items: ScriptQualityCheck[];
};

type CheckDefinition = Omit<ScriptQualityCheck, "status" | "detail"> & {
  passDetail: string;
  pendingDetail: string;
};

const CHECK_DEFINITIONS: CheckDefinition[] = [
  {
    id: "schema",
    label: "YAML Schema",
    description: "YAML 必须能解析，并符合剧本 Schema。",
    passDetail: "YAML 已通过 Schema 校验。",
    pendingDetail: "生成 YAML 后开始校验。"
  },
  {
    id: "metadata",
    label: "元信息完整",
    description: "metadata 需要包含 title、source_chapters、language、format_version。",
    passDetail: "metadata 必填字段完整。",
    pendingDetail: "等待 Schema 校验定位 metadata。"
  },
  {
    id: "characters",
    label: "角色可用于改编",
    description: "每个角色需要稳定 id、姓名、角色类型和 traits。",
    passDetail: "角色字段完整，traits 可用于后续打磨。",
    pendingDetail: "等待 Schema 校验定位 characters。"
  },
  {
    id: "scenes",
    label: "场景结构完整",
    description: "每个场景需要章节、地点、时间、动作和镜头提示。",
    passDetail: "场景结构完整。",
    pendingDetail: "等待 Schema 校验定位 scenes。"
  },
  {
    id: "scene-dialogue",
    label: "场景包含台词",
    description: "每个场景至少要有一条 dialogue。",
    passDetail: "每个场景都有台词。",
    pendingDetail: "等待 Schema 校验定位 dialogue。"
  },
  {
    id: "dialogue-references",
    label: "台词角色引用有效",
    description: "dialogue.character 必须引用 characters 中存在的 id。",
    passDetail: "台词角色引用均有效。",
    pendingDetail: "Schema 通过后检查角色引用。"
  },
  {
    id: "summary",
    label: "总结可交付",
    description: "summary 需要包含 logline、themes、adaptation_notes。",
    passDetail: "summary 字段完整。",
    pendingDetail: "等待 Schema 校验定位 summary。"
  }
];

function buildPendingChecklist(): ScriptQualityChecklist {
  return buildChecklist(
    CHECK_DEFINITIONS.map((definition) => ({
      ...definition,
      status: "pending",
      detail: definition.pendingDetail
    }))
  );
}

function buildChecklist(items: ScriptQualityCheck[]): ScriptQualityChecklist {
  const passedCount = items.filter((item) => item.status === "pass").length;
  const failedCount = items.filter((item) => item.status === "fail").length;
  const pendingCount = items.filter((item) => item.status === "pending").length;
  const status: ScriptQualityStatus = failedCount > 0 ? "fail" : pendingCount > 0 ? "pending" : "pass";

  return {
    status,
    passedCount,
    failedCount,
    pendingCount,
    items
  };
}

function hasPath(errors: ScriptValidationError[], predicate: (path: string) => boolean): boolean {
  return errors.some((error) => predicate(error.path));
}

function joinErrorDetails(errors: ScriptValidationError[], predicate: (path: string) => boolean): string {
  return errors
    .filter((error) => predicate(error.path))
    .map((error) => `${error.path}: ${error.message}`)
    .join("; ");
}

function statusFromErrors(
  errors: ScriptValidationError[],
  predicate: (path: string) => boolean
): Pick<ScriptQualityCheck, "status" | "detail"> {
  if (!hasPath(errors, predicate)) {
    return {
      status: "pending",
      detail: "Schema 未通过；该项暂不能确认。"
    };
  }

  return {
    status: "fail",
    detail: joinErrorDetails(errors, predicate)
  };
}

function metadataPath(path: string): boolean {
  return path === "metadata" || path.startsWith("metadata.");
}

function charactersPath(path: string): boolean {
  return path === "characters" || path.startsWith("characters.");
}

function scenesPath(path: string): boolean {
  return path === "scenes" || (path.startsWith("scenes.") && !path.includes(".dialogue"));
}

function sceneDialoguePath(path: string): boolean {
  return path === "dialogue" || path.includes(".dialogue");
}

function summaryPath(path: string): boolean {
  return path === "summary" || path.startsWith("summary.");
}

function hasInvalidDialogueReference(validation: Extract<ScriptValidationResult, { ok: true }>): boolean {
  const characterIds = new Set(validation.document.characters.map((character) => character.id));
  return validation.document.scenes.some((scene) =>
    scene.dialogue.some((line) => !characterIds.has(line.character))
  );
}

export function buildScriptQualityChecklist(validation: ScriptValidationResult | null): ScriptQualityChecklist {
  if (validation === null) {
    return buildPendingChecklist();
  }

  if (!validation.ok) {
    const failedSchemaDetail = validation.errors.map((error) => `${error.path}: ${error.message}`).join("; ");
    const checksById = new Map<ScriptQualityCheckId, Pick<ScriptQualityCheck, "status" | "detail">>([
      ["schema", { status: "fail", detail: failedSchemaDetail }],
      ["metadata", statusFromErrors(validation.errors, metadataPath)],
      ["characters", statusFromErrors(validation.errors, charactersPath)],
      ["scenes", statusFromErrors(validation.errors, scenesPath)],
      ["scene-dialogue", statusFromErrors(validation.errors, sceneDialoguePath)],
      ["dialogue-references", { status: "pending", detail: "Schema 通过后检查角色引用。" }],
      ["summary", statusFromErrors(validation.errors, summaryPath)]
    ]);

    return buildChecklist(
      CHECK_DEFINITIONS.map((definition) => {
        const check = checksById.get(definition.id);
        if (!check) {
          throw new Error(`未配置质量检查项：${definition.id}`);
        }

        return {
          ...definition,
          status: check.status,
          detail: check.detail
        };
      })
    );
  }

  const dialogueReferencesFail = hasInvalidDialogueReference(validation);

  return buildChecklist(
    CHECK_DEFINITIONS.map((definition) => ({
      ...definition,
      status: definition.id === "dialogue-references" && dialogueReferencesFail ? "fail" : "pass",
      detail:
        definition.id === "dialogue-references" && dialogueReferencesFail
          ? "存在 dialogue.character 未引用 characters 中的角色 id。"
          : definition.passDetail
    }))
  );
}
