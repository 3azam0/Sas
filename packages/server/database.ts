/** Shared query boundary for embedded development and managed Postgres. */
export interface QueryDatabase {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{rows: T[]}>;
}
export interface Database extends QueryDatabase {
  transaction<T>(run: (tx: QueryDatabase) => Promise<T>): Promise<T>;
}
