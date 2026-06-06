"use client";

import Link from "next/link";
import { useWorkspace } from "./workspace-context";

export function ScriptPage() {
  const workspace = useWorkspace();
  const hasYaml = workspace.yamlText.trim().length > 0;

  return (
    <section className="workbench-page" aria-label="编辑 YAML 剧本">
      <div className="workbench-page-head compact">
        <div>
          <p className="eyebrow">YAML Script · Schema</p>
          <h1>编辑 YAML 剧本</h1>
          <p className="lead">检查生成的剧本结构，修正 Schema 报错，通过后再导出给作者继续打磨。</p>
        </div>
        <div className="page-actions">
          <Link className="ghost-button" href="/workspace">
            回工作台
          </Link>
          <button className="primary-button" type="button" onClick={workspace.downloadYaml} disabled={!workspace.yamlValidation?.ok}>
            导出 YAML
          </button>
        </div>
      </div>

      {!hasYaml ? (
        <div className="script-empty-state">
          <div>
            <strong>还没有 YAML 剧本</strong>
            <p>先回工作台导入 3 章以上小说，生成后再来这里编辑和导出。</p>
          </div>
          <Link className="secondary-button" href="/workspace">
            去生成 YAML
          </Link>
        </div>
      ) : null}

      <div className="script-grid">
        <div className="panel output-panel">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Generated Script</p>
              <h2>YAML 剧本</h2>
            </div>
          </div>

          <textarea
            className="yaml-editor"
            value={workspace.yamlText}
            onChange={(event) => workspace.setYamlText(event.target.value)}
            placeholder="先在工作台生成剧本，这里会出现可编辑 YAML。"
            spellCheck={false}
          />

          <div className={workspace.yamlValidation?.ok ? "validation ok" : workspace.yamlValidation ? "validation bad" : "validation"}>
            <strong>{workspace.yamlValidation?.ok ? "校验通过" : workspace.yamlValidation ? "校验失败" : "等待校验"}</strong>
            <pre>{workspace.validationText}</pre>
          </div>
          {workspace.error ? <p className="error-box">{workspace.error}</p> : null}
        </div>

        <div className={`quality-card ${workspace.scriptQuality.status}`} aria-label="剧本质量清单">
          <div className="quality-head">
            <div>
              <p className="section-kicker">Quality Checklist</p>
              <h3>剧本质量清单</h3>
            </div>
            <span className={`quality-score ${workspace.scriptQuality.status}`}>
              {workspace.scriptQuality.passedCount}/{workspace.scriptQuality.items.length} 通过
            </span>
          </div>

          <ul className="quality-list">
            {workspace.scriptQuality.items.map((item) => (
              <li className={`quality-item ${item.status}`} key={item.id}>
                <div className="quality-item-head">
                  <strong>{item.label}</strong>
                  <span>{workspace.formatQualityStatus(item.status)}</span>
                </div>
                <p>{item.description}</p>
                <small>{item.detail}</small>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
