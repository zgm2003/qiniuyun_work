import type { UiSelectOption } from "@/components/ui/select";

export function buildModelOptions(modelIds: readonly string[], currentModel: string): UiSelectOption<string>[] {
  const normalizedCurrent = currentModel.trim();
  const uniqueModelIds = Array.from(new Set(modelIds.map((modelId) => modelId.trim()).filter(Boolean)));
  const options: UiSelectOption<string>[] = uniqueModelIds.map((modelId) => ({
    value: modelId,
    label: modelId
  }));

  if (normalizedCurrent && !uniqueModelIds.includes(normalizedCurrent)) {
    return [
      {
        value: normalizedCurrent,
        label: normalizedCurrent,
        description: "当前手动填写"
      },
      ...options
    ];
  }

  return options;
}
