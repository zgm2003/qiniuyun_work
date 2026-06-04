import Link from "next/link";
import { WORKBENCH_NAV_ITEMS } from "@/features/workspace/workbench-nav";

export default function Home() {
  return (
    <main className="entry-shell">
      <section className="entry-card">
        <p className="eyebrow">Novel · YAML · Script</p>
        <h1>小说转剧本工作台</h1>
        <p className="lead">
          把小说改编流程拆成清晰工作区：先录入小说和模型配置，再审查 YAML，最后管理草稿和质量报告。
        </p>
        <div className="entry-actions">
          <Link className="primary-button" href="/workspace">
            进入工作台
          </Link>
          <Link className="ghost-button" href="/script">
            查看剧本审查
          </Link>
        </div>
      </section>

      <section className="route-grid" aria-label="工作台路由">
        {WORKBENCH_NAV_ITEMS.map((item) => (
          <Link className="route-card" href={item.href} key={item.href}>
            <span>{item.label}</span>
            <strong>{item.href}</strong>
            <p>{item.description}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
