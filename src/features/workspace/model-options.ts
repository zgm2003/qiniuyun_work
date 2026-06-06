import type { UiSelectOption } from "@/components/ui/select";

export function buildModelOptions(modelIds: readonly string[], currentModel: string): UiSelectOption<string>[] {
  const trimmedCurrentModel = currentModel.trim();
  const uniqueModelIds = Array.from(new Set(modelIds.map((modelId) => modelId.trim()).filter(Boolean))).sort((left, right) =>
    left.localeCompare(right)
  );

  if (trimmedCurrentModel && !uniqueModelIds.includes(trimmedCurrentModel)) {
    uniqueModelIds.unshift(trimmedCurrentModel);
  }

  return uniqueModelIds.map((modelId) => ({ value: modelId, label: modelId }));
}
