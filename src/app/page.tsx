"use client";

import { useMemo, useState, useTransition } from "react";
import { parseNovelChapters } from "@/lib/chapters";
import { SAMPLE_NOVEL, SAMPLE_TITLE } from "@/lib/demo-sample";
import { validateScriptYaml, type ScriptValidationError } from "@/lib/script-schema";
import type { ConversionReport } from "@/lib/mock-converter";

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

export default function Home() {
  const [title, setTitle] = useState(SAMPLE_TITLE);
  const [novelText, setNovelText] = useState(SAMPLE_NOVEL);
  const [yamlText, setYamlText] = useState("");
  const [report, setReport] = useState<ConversionReport | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const chapters = useMemo(() => parseNovelChapters(novelText), [novelText]);
  const yamlValidation = useMemo(() => {
    if (!yamlText.trim()) {
      return null;
    }

    return validateScriptYaml(yamlText);
  }, [yamlText]);

  function loadSample() {
    setTitle(SAMPLE_TITLE);
    setNovelText(SAMPLE_NOVEL);
    setYamlText("");
    setReport(null);
    setError("");
  }

  function convert() {
    setError("");
    startTransition(async () => {
      const response = await fetch("/api/convert", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, text: novelText })
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

  const canConvert = title.trim().length > 0 && novelText.trim().length > 0 && chapters.length >= 3;
  const validationText = yamlValidation
    ? yamlValidation.ok
      ? "Schema 校验通过，可以导出。"
      : formatValidationErrors(yamlValidation.errors)
    : "转换后会在这里显示 YAML Schema 校验结果。";

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Novel · YAML · Script</p>
          <h1>AI 小说转剧本工具</h1>
          <p className="lead">
            输入 3 个章节以上小说文本，生成结构化 YAML 剧本初稿。缺字段不兜底，坏 YAML 不导出。
          </p>
        </div>
        <div className="hero-card" aria-label="当前演示模式">
          <span>Provider</span>
          <strong>mock</strong>
          <small>无 API Key 也能稳定录屏</small>
        </div>
      </section>

      <section className="workspace-grid" aria-label="小说转剧本工作区">
        <div className="panel input-panel">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Source Novel</p>
              <h2>小说输入</h2>
            </div>
            <button className="ghost-button" type="button" onClick={loadSample}>
              加载样例
            </button>
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

          <div className="status-row">
            <span className={chapters.length >= 3 ? "status ok" : "status bad"}>
              已识别 {chapters.length} 章
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
        </div>
      </section>

      <section className="metrics-panel" aria-label="转换总结">
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
