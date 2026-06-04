"use client";

import { useWorkspace } from "./workspace-context";

export function ScriptPage() {
  const workspace = useWorkspace();

  return (
    <section className="workbench-page" aria-label="剧本审查">
      <div className="workbench-page-head compact">
        <div>
          <p className="eyebrow">Generated Script · Schema · Quality</p>
          <h1>剧本审查</h1>
          <p className="lead">在这里编辑 YAML、查看 Schema 校验结果和剧本质量清单。坏 YAML 不导出，不靠默认值糊弄。</p>
        </div>
        <button className="primary-button" type="button" onClick={workspace.downloadYaml} disabled={!workspace.yamlValidation?.ok}>
          导出 YAML
        </button>
      </div>

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
            placeholder="先在工作台生成剧本，这里会出现可编辑 YAML。你也可以故意删除 metadata.title 来演示 Schema 校验失败。"
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
