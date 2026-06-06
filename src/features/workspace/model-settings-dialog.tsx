"use client";

import { useState } from "react";
import { UiDialog } from "@/components/ui/dialog";
import { UiSelect } from "@/components/ui/select";
import { useWorkspace } from "./workspace-context";

type ModelSettingsDialogProps = {
  defaultOpen?: boolean;
};

export function ModelSettingsDialog({ defaultOpen = false }: ModelSettingsDialogProps) {
  const workspace = useWorkspace();
  const [open, setOpen] = useState(defaultOpen);
  const providerSettingsMessageClass =
    workspace.providerSettingsMessage.includes("失败") ||
    workspace.providerSettingsMessage.includes("不能为空") ||
    workspace.providerSettingsMessage.includes("未配置")
      ? "model-list-message error"
      : "model-list-message";

  function openSettings() {
    setOpen(true);
    void workspace.loadProviderSettingsFromServer();
  }

  return (
    <>
      <button
        className="model-settings-trigger"
        type="button"
        aria-label="打开模型设置"
        onClick={openSettings}
      >
        <span className="model-settings-trigger-icon">
          <GearIcon />
        </span>
        <span>模型设置</span>
      </button>

      <UiDialog
        open={open}
        title="模型设置"
        description="主流程只负责小说转 YAML；这里读取并保存唯一数据库 AI 配置，API Key 加密入库且不回显。"
        onClose={() => setOpen(false)}
      >
        {workspace.isProviderSettingsLoading ? (
          <div className="model-settings-form">
            <p className="model-list-message">正在读取数据库里的 AI 配置...</p>
          </div>
        ) : (
          <div className="model-settings-form">
            <div className="model-grid">
              <div className="model-fixed-provider" aria-label="固定 AI 连接类型">
                <span>连接类型</span>
                <strong>OpenAI Compatible</strong>
                <small>本项目只保存一套运行时配置</small>
              </div>

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

            {workspace.isProductionRuntime ? (
              <div className="model-live-fields" aria-label="生产模型配置说明">
                <p className="model-list-message">
                  使用服务端唯一 AI 配置。浏览器端不能查看或覆盖 API Key、Base URL 和 model；当前目标模型由服务端配置决定。
                </p>
              </div>
            ) : (
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

                <div className="model-field-row">
                  <label className="model-field-main">
                    <span>Model</span>
                    {workspace.modelIds.length > 0 ? (
                      <UiSelect
                        hideLabel
                        label="Model"
                        value={workspace.model}
                        options={workspace.modelOptions}
                        onChange={workspace.setModel}
                      />
                    ) : (
                      <input
                        className="compact-input"
                        value={workspace.model}
                        onChange={(event) => workspace.setModel(event.target.value)}
                        placeholder="gpt-5.5"
                      />
                    )}
                  </label>
                  <button
                    className="secondary-button model-fetch-button"
                    type="button"
                    disabled={!workspace.canFetchModels || workspace.isModelListPending}
                    onClick={workspace.fetchModels}
                  >
                    {workspace.isModelListPending ? "获取中..." : "获取模型"}
                  </button>
                </div>

                <p className={workspace.modelListStatus === "error" ? "model-list-message error" : "model-list-message"}>
                  {workspace.modelListMessage}
                </p>

                <label>
                  <span>API Key</span>
                  <input
                    className="compact-input sensitive-input"
                    type="password"
                    value={workspace.apiKey}
                    onChange={(event) => workspace.setApiKey(event.target.value)}
                    placeholder="已保存的 API Key 不会回显；填写新 Key 会加密覆盖"
                  />
                </label>

                <div className="model-settings-footer">
                  <p className={providerSettingsMessageClass}>{workspace.providerSettingsMessage}</p>
                  <div className="model-settings-actions">
                    <button
                      className="primary-button model-settings-save-button"
                      type="button"
                      disabled={!workspace.canSaveProviderSettings || workspace.isProviderSettingsPending}
                      onClick={workspace.saveProviderSettingsToServer}
                    >
                      {workspace.isProviderSettingsPending ? "保存中..." : "保存唯一配置"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </UiDialog>
    </>
  );
}

function GearIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 8.25a3.75 3.75 0 1 0 0 7.5 3.75 3.75 0 0 0 0-7.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M19.1 13.4a7.8 7.8 0 0 0 .04-2.77l2.02-1.55-2.1-3.63-2.38.96a7.92 7.92 0 0 0-2.38-1.38L13.96 2h-4.2l-.34 3.03a7.92 7.92 0 0 0-2.38 1.38l-2.38-.96-2.1 3.63 2.02 1.55a7.8 7.8 0 0 0 .04 2.77l-2.02 1.55 2.1 3.63 2.35-.95a7.78 7.78 0 0 0 2.41 1.4l.34 2.97h4.2l.34-2.97a7.78 7.78 0 0 0 2.41-1.4l2.35.95 2.1-3.63-2.02-1.55Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
