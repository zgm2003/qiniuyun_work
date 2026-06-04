"use client";

import { useWorkspace } from "./workspace-context";

export function DraftsPage() {
  const workspace = useWorkspace();

  return (
    <section className="workbench-page" aria-label="本地项目草稿">
      <div className="workbench-page-head compact">
        <div>
          <p className="eyebrow">Local Drafts</p>
          <h1>项目草稿</h1>
          <p className="lead">草稿只保存在当前浏览器 localStorage。保存小说、YAML 和转换报告，不保存 API Key 或模型配置。</p>
        </div>
        <div className="draft-actions">
          <button className="primary-button" type="button" onClick={workspace.saveDraft}>
            {workspace.activeDraft ? "更新当前草稿" : "保存为新草稿"}
          </button>
          <span>{workspace.activeDraft ? `当前：${workspace.activeDraft.title}` : "当前未绑定草稿"}</span>
        </div>
      </div>

      <section className="drafts-panel embedded" aria-label="本地项目草稿列表">
        {workspace.draftMessage ? <p className="draft-message">{workspace.draftMessage}</p> : null}

        {workspace.drafts.length > 0 ? (
          <div className="draft-list">
            {workspace.drafts.map((draft) => (
              <article className={draft.id === workspace.activeDraft?.id ? "draft-card active" : "draft-card"} key={draft.id}>
                <div>
                  <h3>{draft.title}</h3>
                  <p>
                    {new Date(draft.updatedAt).toLocaleString("zh-CN")} · {draft.report?.sceneCount ?? 0} 场 ·{" "}
                    {draft.yamlText.trim() ? "含 YAML" : "仅小说"}
                  </p>
                </div>
                <div className="draft-card-actions">
                  <button className="ghost-button" type="button" onClick={() => workspace.loadDraft(draft)}>
                    加载
                  </button>
                  <button className="ghost-button danger-button" type="button" onClick={() => workspace.deleteDraft(draft.id)}>
                    删除
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-drafts">还没有草稿。先转换或编辑内容，再点击“保存为新草稿”。</p>
        )}
      </section>
    </section>
  );
}
