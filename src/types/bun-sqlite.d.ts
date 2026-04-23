declare module 'bun:sqlite' {
  export class Database {
    constructor(path: string)
    query(sql: string): {
      all(...params: any[]): any[]
      get(...params: any[]): any
      run(...params: any[]): void
      execute(sql: string): void
    }
    exec(sql: string): void
    query(sql: string): {
      all(...params: any[]): any[]
      get(...params: any[]): any
      run(...params: any[]): void
    }
    close(): void
  }
}
