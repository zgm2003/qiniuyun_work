import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import mysql from "mysql2/promise";

function readDotEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  const env = {};
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    let value = line.slice(equalsIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }

  return env;
}

function parsePort(value) {
  if (!value) {
    return 3306;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("MYSQL_DSN 端口不合法");
  }

  return port;
}

function parseMysqlDsn(dsn) {
  if (dsn.startsWith("mysql://")) {
    const url = new URL(dsn);
    const database = url.pathname.replace(/^\//, "");
    if (!database) {
      throw new Error("MYSQL_DSN 缺少数据库名");
    }

    return {
      host: url.hostname,
      port: parsePort(url.port),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database,
      charset: "utf8mb4"
    };
  }

  const goDsn = dsn.match(/^([^:]+):([^@]*)@tcp\(([^:()]+):(\d+)\)\/([^?]+)(?:\?.*)?$/);
  if (goDsn) {
    return {
      host: goDsn[3],
      port: parsePort(goDsn[4]),
      user: goDsn[1],
      password: goDsn[2],
      database: goDsn[5],
      charset: "utf8mb4"
    };
  }

  throw new Error("MYSQL_DSN 格式不支持");
}

const sqlFileArg = process.argv[2] ?? "src/lib/db/schema.sql";
const sqlFile = resolve(sqlFileArg);
if (!existsSync(sqlFile)) {
  throw new Error(`SQL 文件不存在：${sqlFileArg}`);
}

const fileEnv = {
  ...readDotEnvFile(resolve(".env.local")),
  ...readDotEnvFile(resolve(".env"))
};
const dsn = process.env.MYSQL_DSN ?? fileEnv.MYSQL_DSN;
if (!dsn) {
  throw new Error("MYSQL_DSN 未配置；请设置环境变量或写入 .env.local");
}

const connection = await mysql.createConnection({
  ...parseMysqlDsn(dsn),
  multipleStatements: true
});

try {
  await connection.query(readFileSync(sqlFile, "utf8"));
  console.log(`Applied SQL: ${sqlFileArg}`);
} finally {
  await connection.end();
}
