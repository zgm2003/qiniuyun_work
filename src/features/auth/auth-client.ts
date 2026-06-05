export type UserSummary = {
  id: string;
  email: string;
  name: string;
};

type UserSuccess = {
  user: UserSummary;
};

type CurrentUserSuccess = {
  user: UserSummary | null;
};

type ApiFailure = {
  error: string;
};

function isApiFailure(value: unknown): value is ApiFailure {
  return typeof value === "object" && value !== null && "error" in value && typeof (value as { error: unknown }).error === "string";
}

async function readUserResponse(response: Response, fallbackMessage: string): Promise<UserSummary> {
  const body = (await response.json()) as UserSuccess | ApiFailure;
  if (!response.ok || isApiFailure(body)) {
    throw new Error(isApiFailure(body) ? body.error : fallbackMessage);
  }

  return body.user;
}

export async function fetchCurrentUser(): Promise<UserSummary | null> {
  const response = await fetch("/api/auth/me", { cache: "no-store" });
  const body = (await response.json()) as CurrentUserSuccess;
  return body.user;
}

export async function login(email: string, password: string): Promise<UserSummary> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  return readUserResponse(response, "登录失败");
}

export async function register(email: string, password: string, name: string): Promise<UserSummary> {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, name })
  });

  return readUserResponse(response, "注册失败");
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}
