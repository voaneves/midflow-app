/**
 * File locations that work both on Node (real disk) and on Cloudflare Workers
 * (no module URL, only an ephemeral in-memory /tmp).
 */
import path from 'path'
import { fileURLToPath } from 'url'

const moduleUrl = import.meta.url
/** true when running as a Cloudflare Worker (no file-based module URL). */
export const isWorker = !moduleUrl || !moduleUrl.startsWith('file:')

const SERVER_DIR = isWorker ? '/tmp' : path.dirname(fileURLToPath(moduleUrl))

/** Writable data folder: server/data on Node, /tmp/data on Workers (lost when the Worker restarts). */
export const DATA_DIR = path.join(SERVER_DIR, 'data')
/** Local fallback photos. Not available on Workers (reads there fail and are handled). */
export const PHOTOS_DIR = isWorker ? '/tmp/no-photos' : path.join(SERVER_DIR, '..', 'src', 'assets', 'photos')
