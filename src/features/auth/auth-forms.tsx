"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { login, register } from "./auth-client";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const isRegister = mode === "register";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        if (isRegister) {
          await register(email, password, name);
        } else {
          await login(email, password);
        }
        router.push("/projects");
      } catch (authError) {
        setError(authError instanceof Error ? authError.message : isRegister ? "注册失败" : "登录失败");
      }
    });
  }

  return (
    <main className="entry-shell">
      <section className="entry-card auth-card" aria-label={isRegister ? "注册" : "登录"}>
        <p className="eyebrow">Account · Server Projects</p>
        <h1>{isRegister ? "创建作者账号" : "登录作者账号"}</h1>
        <p className="lead">
          {isRegister
            ? "注册后可以把小说原文和 YAML 剧本保存到服务端项目列表。"
            : "登录后只会看到你自己的小说改编项目；未登录仍可使用本地演示闭环。"}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isRegister ? (
            <label>
              <span>名称</span>
              <input className="compact-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="作者昵称" />
            </label>
          ) : null}
          <label>
            <span>邮箱</span>
            <input
              className="compact-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="author@example.com"
              required
            />
          </label>
          <label>
            <span>密码</span>
            <input
              className="compact-input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="至少 8 个字符"
              required
            />
          </label>
          {error ? <p className="error-box">{error}</p> : null}
          <button className="primary-button" type="submit" disabled={isPending}>
            {isPending ? "处理中..." : isRegister ? "注册并进入项目" : "登录并进入项目"}
          </button>
        </form>
      </section>
    </main>
  );
}
