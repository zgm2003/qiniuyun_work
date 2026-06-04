"use client";

import { type ChangeEvent, useRef } from "react";
import type { ProviderName } from "./workspace-context";
import { useWorkspace } from "./workspace-context";
import { PRODUCT_PROVIDER_OPTIONS } from "./provider-options";

export function WorkspacePage() {
  const workspace = useWorkspace();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function openFileImport() {
    fileInputRef.current?.click();
  }

  async function handleNovelFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) {
      return;
    }

    try {
      await workspace.importNovelFile(file);
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : "导入文本失败";
      workspace.setErrorMessage(message);
    }
  }

  return (
    <section className="workbench-page" aria-label="小说转剧本工作台">
      <div className="workbench-page-head">
        <div>
          <p className="eyebrow">Source · Model · Outline</p>
          <h1>工作台</h1>
          <p className="lead">先把小说正文、模型配置和章节大纲整理好。生成结果会进入“剧本审查”页面继续校验和导出。</p>
        </div>
        <div className="hero-card" aria-label="当前模型配置">
          <span>Provider</span>
          <strong>{workspace.activeProviderText}</strong>
          <small>{workspace.model}</small>
        </div>
      </div>

      <div className="workspace-grid single-output" aria-label="小说输入与模型配置">
        <div className="panel input-panel">
          <div className="panel-head">
            <div>
              <p className="section-kicker">Source Novel</p>
              <h2>小说输入</h2>
            </div>
            <div className="source-actions">
              <button className="ghost-button" type="button" onClick={openFileImport}>
                导入文本
              </button>
              <button className="ghost-button" type="button" onClick={workspace.loadSample}>
                加载样例
              </button>
              <input
                ref={fileInputRef}
                className="visually-hidden"
                type="file"
                accept=".txt,.md,text/plain,text/markdown"
                onChange={handleNovelFileChange}
              />
            </div>
          </div>

          <label className="field-label" htmlFor="title">
            标题
          </label>
          <input
            id="title"
            className="title-input"
            value={workspace.title}
            onChange={(event) => workspace.setTitle(event.target.value)}
            placeholder="请输入作品标题"
          />

          <div id="model-config" className="model-config-card" aria-label="模型配置">
            <div className="model-config-head">
              <div>
                <p className="section-kicker">Model Config</p>
                <h3>模型配置</h3>
              </div>
              <span className="provider-pill live">
                真实模型
              </span>
            </div>

            <div className="model-grid">
              <label>
                <span>Provider</span>
                <select
                  className="provider-select"
                  value={workspace.provider}
                  onChange={(event) => workspace.setProvider(event.target.value as ProviderName)}
                >
                  {PRODUCT_PROVIDER_OPTIONS.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Temperature</span>
                <input
                  className="compact-input"
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={workspace.temperature}
                  onChange={(event) => workspace.setTemperature(Number(event.target.value))}
                />
              </label>
            </div>

            <div className="model-live-fields">
              <label>
                <span>Base URL</span>
                <input
                  className="compact-input"
                  value={workspace.baseUrl}
                  onChange={(event) => workspace.setBaseUrl(event.target.value)}
                  placeholder="https://api.openai.com/v1"
                />
              </label>
              <label>
                <span>Model</span>
                <input
                  className="compact-input"
                  value={workspace.model}
                  onChange={(event) => workspace.setModel(event.target.value)}
                  placeholder="gpt-4.1-mini"
                />
              </label>
              <label>
                <span>API Key（仅本次请求）</span>
                <input
                  className="compact-input sensitive-input"
                  type="password"
                  value={workspace.apiKey}
                  onChange={(event) => workspace.setApiKey(event.target.value)}
                  placeholder="不会保存到本地草稿或仓库"
                />
              </label>
            </div>
          </div>

          <label className="field-label" htmlFor="novel">
            小说正文
          </label>
          <textarea
            id="novel"
            className="novel-input"
            value={workspace.novelText}
            onChange={(event) => workspace.setNovelText(event.target.value)}
            spellCheck={false}
          />
          {workspace.sourceMessage ? <p className="source-message">{workspace.sourceMessage}</p> : null}
        </div>

        <div className="panel route-side-panel">
          <div className="chapter-outline-card" aria-label="章节大纲预览">
            <div className="chapter-outline-head">
              <div>
                <p className="section-kicker">Chapter Outline</p>
                <h3>章节大纲预览</h3>
              </div>
              <span className={workspace.chapterOutline.ready ? "outline-pill ok" : "outline-pill bad"}>
                {workspace.outlineStatusText}
              </span>
            </div>

            {workspace.chapterOutline.items.length > 0 ? (
              <ol className="chapter-outline-list">
                {workspace.chapterOutline.items.map((item) => (
                  <li className={item.isEmpty ? "chapter-outline-item empty" : "chapter-outline-item"} key={item.index}>
                    <div className="chapter-outline-meta">
                      <strong>
                        第 {item.index} 章 · {item.title}
                      </strong>
                      <span>{item.bodyCharacterCount} 字</span>
                    </div>
                    <p>{item.isEmpty ? "章节正文为空，转换前需要补正文。" : item.preview}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="empty-outline">还没有识别到章节。支持“第1章”“第一章”“Chapter 1”等标题格式。</p>
            )}
          </div>

          <div className="status-row stacked-actions">
            <span className={workspace.chapterOutline.ready ? "status ok" : "status bad"}>
              已识别 {workspace.chapterOutline.chapterCount} 章 · {workspace.outlineStatusText}
            </span>
            <button className="primary-button" type="button" disabled={!workspace.canConvert || workspace.isPending} onClick={workspace.convert}>
              {workspace.isPending ? "转换中..." : "转换为 YAML 剧本"}
            </button>
          </div>
          {workspace.error ? <p className="error-box">{workspace.error}</p> : null}
        </div>
      </div>
    </section>
  );
}


