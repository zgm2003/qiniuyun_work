import mysql, { type Pool, type PoolOptions, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";

export type MysqlEnvironment = Record<string, string | undefined>;
export type MysqlQueryRunner = {
  query<T extends RowDataPacket[] | RowDataPacket[][] | ResultSetHeader>(
    sql: string,
    values?: readonly unknown[]
  ): Promise<[T]>;
};

export type MysqlTransactionConnection = MysqlQueryRunner & {
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): void;
};

export type MysqlTransactionRunner = MysqlQueryRunner & {
  getConnection(): Promise<MysqlTransactionConnection>;
};

let pool: Pool | null = null;

function parsePort(value: string | undefined): number {
  if (!value) {
    return 3306;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("MYSQL_DSN 端口不合法");
  }

  return port;
}

export function parseMysqlDsn(dsn: string): PoolOptions {
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

export function buildMysqlPoolOptions(env: MysqlEnvironment): PoolOptions {
  const dsn = env.MYSQL_DSN;
  if (!dsn) {
    throw new Error("MYSQL_DSN 未配置");
  }

  const connectionLimit = Number(env.MYSQL_CONNECTION_LIMIT ?? "10");
  if (!Number.isInteger(connectionLimit) || connectionLimit <= 0) {
    throw new Error("MYSQL_CONNECTION_LIMIT 必须是正整数");
  }

  return {
    ...parseMysqlDsn(dsn),
    waitForConnections: true,
    connectionLimit
  };
}

export function getMysqlPool(env: MysqlEnvironment = process.env): Pool {
  if (!pool) {
    pool = mysql.createPool(buildMysqlPoolOptions(env));
  }

  return pool;
}
