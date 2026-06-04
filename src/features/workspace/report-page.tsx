"use client";

import { useWorkspace } from "./workspace-context";

export function ReportPage() {
  const workspace = useWorkspace();

  return (
    <section className="workbench-page" aria-label="转换总结">
      <div className="workbench-page-head compact">
        <div>
          <p className="eyebrow">Conversion Report</p>
          <h1>质量报告</h1>
          <p className="lead">把生成结果转成可量化反馈：章节、角色、场景、台词，以及当前 YAML 结构是否可交付。</p>
        </div>
      </div>

      <section className="metrics-panel embedded" aria-label="转换总结指标">
        <div>
          <p className="section-kicker">Current Result</p>
          <h2>课后式总结</h2>
        </div>
        <div className="metrics-grid">
          <Metric label="章节" value={workspace.report?.chapterCount ?? workspace.chapters.length} />
          <Metric label="角色" value={workspace.report?.characterCount ?? "—"} />
          <Metric label="场景" value={workspace.report?.sceneCount ?? "—"} />
          <Metric label="台词" value={workspace.report?.dialogueLineCount ?? "—"} />
        </div>
      </section>

      <div className="report-grid">
        <article className="route-card">
          <p className="section-kicker">Provider</p>
          <h2>{workspace.activeProviderText}</h2>
          <p>当前模型：{workspace.model}</p>
        </article>
        <article className="route-card">
          <p className="section-kicker">Schema</p>
          <h2>{workspace.yamlValidation?.ok ? "可导出" : workspace.yamlValidation ? "需修复" : "等待生成"}</h2>
          <p>{workspace.validationText}</p>
        </article>
        <article className="route-card">
          <p className="section-kicker">Quality</p>
          <h2>
            {workspace.scriptQuality.passedCount}/{workspace.scriptQuality.items.length}
          </h2>
          <p>质量清单通过项。失败项请回到“剧本审查”修正 YAML。</p>
        </article>
      </div>
    </section>
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
