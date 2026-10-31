// Minimal typing for Cloudflare's node:http bridge (https://developers.cloudflare.com/workers/runtime-apis/nodejs/http/)
declare module 'cloudflare:node' {
  import type { Server } from 'node:http'
  export function httpServerHandler(server: Server | { port: number }): unknown
}
