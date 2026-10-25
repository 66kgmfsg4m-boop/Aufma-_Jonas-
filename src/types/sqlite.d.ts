declare module "node:sqlite" {
  export type SqlValue = string | number | bigint | null | Uint8Array;

  export class DatabaseSync {
    constructor(
      path: string,
      options?: { enableForeignKeyConstraints?: boolean },
    );
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }

  export class StatementSync {
    run(...params: SqlValue[]): {
      changes: number;
      lastInsertRowid: number | bigint;
    };
    all(...params: SqlValue[]): Record<string, SqlValue>[];
    get(...params: SqlValue[]): Record<string, SqlValue> | undefined;
  }
}
