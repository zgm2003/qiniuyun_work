"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "./workspace-context";
import { listServerProjects, loadServerProject, type ServerProjectListItem } from "./server-projects-client";
import { formatGenerationRunSummary, getGenerationRunTone } from "./generation-run-presenter";

export function ProjectsPage() {
  const router = useRouter();
  const workspace = useWorkspace();
  const [projects, setProjects] = useState<ServerProjectListItem[]>([]);
  const [message, setMessage] = useState("正在读取服务端项目...");

  async function refreshProjects() {
    try {
      const nextProjects = await listServerProjects();
      setProjects(nextProjects);
      setMessage(nextProjects.length > 0 ? "" : "还没有服务端项目。可以先保存当前工作区。");
    } catch (projectError) {
      setProjects([]);
      setMessage(projectError instanceof Error ? projectError.message : "读取项目失败");
    }
  }

  async function openProject(projectId: string) {
    try {
      const project = await loadServerProject(projectId);
      workspace.loadServerProjectIntoWorkspace(project);
      router.push("/workspace");
    } catch (projectError) {
      setMessage(projectError instanceof Error ? projectError.message : "打开项目失败");
    }
  }

  async function saveCurrentWorkspace() {
    await workspace.saveCurrentWorkspaceToServer();
    await refreshProjects();
  }

  useEffect(() => {
    let ignore = false;
    listServerProjects()
      .then((nextProjects) => {
        if (!ignore) {
          setProjects(nextProjects);
          setMessage(nextProjects.length > 0 ? "" : "还没有服务端项目。可以先保存当前工作区。");
        }
      })
      .catch((projectError) => {
        if (!ignore) {
          setProjects([]);
          setMessage(projectError instanceof Error ? projectError.message : "读取项目失败");
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <section className="workbench-page" aria-label="服务端项目">
      <div className="workbench-page-head compact">
        <div>
          <p className="eyebrow">Server Projects</p>
          <h1>服务端项目</h1>
          <p className="lead">保存和加载服务端项目草稿，便于继续打磨小说改编剧本。</p>
        </div>
        <button className="primary-button" type="button" onClick={() => void saveCurrentWorkspace()}>
          保存当前工作区
        </button>
      </div>

      {workspace.serverProjectMessage ? <p className="draft-message">{workspace.serverProjectMessage}</p> : null}
      {message ? <p className="draft-message">{message}</p> : null}

      <div className="draft-list" aria-label="服务端项目列表">
        {projects.map((project) => (
          <article className={project.id === workspace.serverProjectId ? "draft-card active" : "draft-card"} key={project.id}>
            <div>
              <h3>{project.title}</h3>
              <p>
                {new Date(project.updatedAt).toLocaleString("zh-CN")} · {project.status}
              </p>
              {project.latestGenerationRun ? (
                <p className={`generation-run-line ${getGenerationRunTone(project.latestGenerationRun.status)}`}>
                  最近生成：{formatGenerationRunSummary(project.latestGenerationRun)}
                </p>
              ) : (
                <p className="generation-run-line neutral">暂无生成记录</p>
              )}
            </div>
            <button className="ghost-button" type="button" onClick={() => void openProject(project.id)}>
              打开
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
