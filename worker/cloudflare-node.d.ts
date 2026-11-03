// Minimal typing for Cloudflare's node:http bridge (https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/)
declare module 'cloudflare:node' {
  import type { Server } from 'node:http'
  export function httpServerHandler(server: Server | { port: number }): unknown
}

// Minimal typing for Durable Objects (no @cloudflare/workers-types dependency).
declare module 'cloudflare:workers' {
  interface DurableObjectStorage {
    get<T = unknown>(key: string): Promise<T | undefined>
    put<T>(key: string, value: T): Promise<void>
    deleteAll(): Promise<void>
    setAlarm(scheduledTime: number): Promise<void>
  }
  interface DurableObjectState {
    storage: DurableObjectStorage
  }
  export class DurableObject<Env = unknown> {
    ctx: DurableObjectState
    env: Env
    constructor(ctx: DurableObjectState, env: Env)
  }
}
