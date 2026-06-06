"use client";

import { type ChangeEvent, useRef } from "react";
import Link from "next/link";
import { ModelSettingsDialog } from "./model-settings-dialog";
import { useWorkspace } from "./workspace-context";

export function WorkspacePage() {
  const workspace = useWorkspace();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sourceCharacterCount = workspace.novelText.replace(/\s/g, "").length;
  const chapterCount = workspace.chapterOutline.chapterCount;
  const minimumChapterText = `${workspace.chapterOutline.minimumChapters} 章`;
  const hasGeneratedYaml = workspace.yamlText.trim().length > 0;
  const conversionStatusText = hasGeneratedYaml
    ? "已生成 YAML"
    : workspace.chapterOutline.ready
      ? "准备生成"
      : `还差 ${workspace.chapterOutline.missingChapterCount} 章`;
  const conversionButtonText = workspace.isPending
    ? "正在生成 YAML..."
    : workspace.canConvert
      ? "生成 YAML 剧本"
      : `至少需要 ${minimumChapterText}`;

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
        <div className="workbench-hero-copy">
          <p className="eyebrow">Novel · YAML · Script</p>
          <h1>把小说变成 YAML 剧本</h1>
          <p className="lead">导入 3 章以上小说正文，预览章节是否达标，然后一键生成可编辑、可校验、可导出的 YAML 剧本初稿。</p>
          <div
            className="mt-7 flex flex-wrap gap-2.5"
            aria-label="使用步骤"
          >
            <StepPill index="01" label="导入小说" tone="dark" />
            <StepPill index="02" label="检查章节" />
            <StepPill index="03" label="生成 YAML" />
          </div>
        </div>
        <div className="flex items-start justify-end">
          <ModelSettingsDialog />
        </div>
      </div>

      <div className="workspace-grid single-output" aria-label="小说输入与章节预览">
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

          <div className="source-stats" aria-label="小说状态">
            <StatChip label="已识别" value={`${chapterCount} 章`} tone={workspace.chapterOutline.ready ? "ok" : "bad"} />
            <StatChip label="最低要求" value={minimumChapterText} />
            <StatChip label="正文" value={`${sourceCharacterCount} 字`} />
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

        <div className="panel route-side-panel conversion-panel">
          <div className="conversion-card" aria-label="生成准备">
            <div className="chapter-outline-head">
              <div>
                <p className="section-kicker">Generate</p>
                <h3>生成准备</h3>
              </div>
              <span className={workspace.chapterOutline.ready || hasGeneratedYaml ? "outline-pill ok" : "outline-pill bad"}>
                {conversionStatusText}
              </span>
            </div>

            <div className="conversion-stats">
              <ReadinessStat label="小说章节" value={`${chapterCount}/${workspace.chapterOutline.minimumChapters}`} />
              <ReadinessStat label="输出格式" value="YAML" />
              <ReadinessStat label="下一步" value="编辑导出" />
            </div>

            <p className="conversion-copy">先让章节数达标，再生成结构化剧本。生成后到编辑页检查 Schema、继续打磨并导出。</p>

            <button
              className="primary-button conversion-button"
              type="button"
              disabled={!workspace.canConvert || workspace.isPending}
              onClick={workspace.convert}
            >
              {conversionButtonText}
            </button>

            {hasGeneratedYaml ? (
              <div className="generated-next-step">
                <div>
                  <strong>YAML 剧本已生成</strong>
                  <p>现在去编辑页校验、修改和导出。</p>
                </div>
                <Link className="secondary-button next-step-button" href="/script">
                  去编辑 YAML
                </Link>
              </div>
            ) : null}
          </div>

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
          {workspace.error ? <p className="error-box">{workspace.error}</p> : null}
        </div>
      </div>
    </section>
  );
}

function StepPill({ index, label, tone = "light" }: { index: string; label: string; tone?: "dark" | "light" }) {
  const className =
    tone === "dark"
      ? "inline-flex items-center gap-2 rounded-full bg-neutral-950 px-4 py-2.5 text-sm font-black text-white shadow-[0_14px_34px_rgba(23,23,23,0.22)]"
      : "inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/85 px-4 py-2.5 text-sm font-black text-neutral-900 shadow-[0_12px_30px_rgba(15,23,42,0.07)]";

  return (
    <span className={className}>
      <span className={tone === "dark" ? "text-white/45" : "text-neutral-400"}>{index}</span>
      {label}
    </span>
  );
}

function StatChip({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "ok" | "bad" }) {
  return (
    <span className={`source-stat ${tone}`}>
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function ReadinessStat({ label, value }: { label: string; value: string }) {
  return (
    <span className="conversion-stat">
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}
