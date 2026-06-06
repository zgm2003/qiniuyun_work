import Link from "next/link";
import { WORKBENCH_NAV_ITEMS } from "@/features/workspace/workbench-nav";

const ROUTE_CARD_TITLES: Record<string, string> = {
  "/workspace": "导入小说并生成",
  "/script": "编辑、校验、导出"
};

export default function Home() {
  return (
    <main className="entry-shell">
      <section className="entry-card">
        <p className="eyebrow">Novel · YAML · Script</p>
        <h1>小说转剧本工作台</h1>
        <p className="lead">把 3 章以上小说直接变成结构化 YAML 剧本：导入正文、生成初稿、继续编辑和导出。</p>
        <div className="entry-actions">
          <Link className="primary-button" href="/workspace">
            进入工作台
          </Link>
          <Link className="ghost-button" href="/script">
            编辑 YAML 剧本
          </Link>
        </div>
      </section>

      <section className="route-grid" aria-label="工作台路由">
        {WORKBENCH_NAV_ITEMS.map((item) => (
          <Link className="route-card" href={item.href} key={item.href}>
            <span>{item.label}</span>
            <strong>{ROUTE_CARD_TITLES[item.href]}</strong>
            <p>{item.description}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
