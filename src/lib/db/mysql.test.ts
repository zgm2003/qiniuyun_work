import { describe, expect, it } from "vitest";
import { buildMysqlPoolOptions, parseMysqlDsn } from "./mysql";

describe("parseMysqlDsn", () => {
  it("parses mysql URL DSN", () => {
    expect(parseMysqlDsn("mysql://app:secret@127.0.0.1:3306/qiniuyun")).toMatchObject({
      host: "127.0.0.1",
      port: 3306,
      user: "app",
      password: "secret",
      database: "qiniuyun"
    });
  });

  it("parses URL encoded credentials", () => {
    expect(parseMysqlDsn("mysql://app%40user:p%40ss%2Fword@127.0.0.1:3306/qiniuyun")).toMatchObject({
      user: "app@user",
      password: "p@ss/word"
    });
  });

  it("parses Go tcp DSN used by the docker env", () => {
    expect(parseMysqlDsn("root:admin_go_local@tcp(host.docker.internal:3307)/admin?charset=utf8mb4&parseTime=True&loc=Local")).toMatchObject({
      host: "host.docker.internal",
      port: 3307,
      user: "root",
      password: "admin_go_local",
      database: "admin"
    });
  });

  it("rejects unsupported DSN formats instead of guessing", () => {
    expect(() => parseMysqlDsn("not a mysql dsn")).toThrow("MYSQL_DSN 格式不支持");
  });
});

describe("buildMysqlPoolOptions", () => {
  it("requires MYSQL_DSN", () => {
    expect(() => buildMysqlPoolOptions({})).toThrow("MYSQL_DSN 未配置");
  });

  it("uses an explicit positive connection limit", () => {
    expect(
      buildMysqlPoolOptions({
        MYSQL_DSN: "mysql://app:secret@127.0.0.1:3306/qiniuyun",
        MYSQL_CONNECTION_LIMIT: "7"
      })
    ).toMatchObject({
      connectionLimit: 7,
      waitForConnections: true
    });
  });

  it("rejects invalid connection limits", () => {
    expect(() =>
      buildMysqlPoolOptions({
        MYSQL_DSN: "mysql://app:secret@127.0.0.1:3306/qiniuyun",
        MYSQL_CONNECTION_LIMIT: "0"
      })
    ).toThrow("MYSQL_CONNECTION_LIMIT 必须是正整数");
  });
});
