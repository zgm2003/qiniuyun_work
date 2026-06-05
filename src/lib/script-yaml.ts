import { stringify } from "yaml";
import { validateScriptYaml, type ScriptDocument, type ScriptValidationError } from "./script-schema";

function joinValidationErrors(errors: ScriptValidationError[]): string {
  return errors.map((error) => `${error.path}: ${error.message}`).join("; ");
}

export function scriptDocumentToValidatedYaml(document: ScriptDocument): string {
  const yaml = stringify(document, { lineWidth: 0 });
  const validation = validateScriptYaml(yaml);

  if (!validation.ok) {
    throw new Error(`程序生成的 YAML 未通过 Schema 校验：${joinValidationErrors(validation.errors)}`);
  }

  return yaml;
}
