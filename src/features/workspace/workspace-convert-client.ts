import type { ConvertModelConfig } from "./model-request-config";
import type { ConversionReport } from "@/lib/mock-converter";

type FetchImplementation = typeof fetch;

export type ConvertWorkspaceInput = {
  projectId: string;
  title: string;
  text: string;
  modelConfig: ConvertModelConfig;
};

export type ConvertWorkspaceResult = {
  yaml: string;
  report: ConversionReport;
};

type ConvertFailure = {
  error: string;
};

function isConvertFailure(value: ConvertWorkspaceResult | ConvertFailure): value is ConvertFailure {
  return "error" in value;
}

export async function convertWorkspaceOnServer(
  input: ConvertWorkspaceInput,
  fetchImpl: FetchImplementation = fetch
): Promise<ConvertWorkspaceResult> {
  const response = await fetchImpl("/api/convert", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
  const body = (await response.json()) as ConvertWorkspaceResult | ConvertFailure;

  if (!response.ok || isConvertFailure(body)) {
    throw new Error(isConvertFailure(body) ? body.error : "转换失败");
  }

  return body;
}
