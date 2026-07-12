import net from 'node:net'

import { solaeonEndpoints } from '../../../shared/provider-config'

// Parse host + port out of a base_url like "http://192.168.1.101:48760".
function parseHostPort(baseUrl: string): { host: string; port: number } {
  try {
    const url = new URL(baseUrl)
    const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80
    return { host: url.hostname, port }
  } catch {
    return { host: '192.168.1.101', port: 48760 }
  }
}

/**
 * TCP-connect probe. We only care whether the LAN box answers a socket —
 * a plain connect succeeds even if the endpoint would return 404 to HTTP,
 * so this is a more reliable "is the internal deployment on this network"
 * signal than an HTTP request, and it needs no request body or auth.
 */
export function probeTcp(host: string, port: number, timeoutMs = 1500): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    let settled = false

    const finish = (reachable: boolean) => {
      if (settled) {
        return
      }
      settled = true
      socket.destroy()
      resolve(reachable)
    }

    socket.setTimeout(timeoutMs)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(false))
    socket.once('error', () => finish(false))

    try {
      socket.connect(port, host)
    } catch {
      finish(false)
    }
  })
}

/** Probe the Solaeon LAN address. Returns true if the internal box is reachable. */
export async function probeSolaeonInternal(timeoutMs = 1500): Promise<boolean> {
  const { host, port } = parseHostPort(solaeonEndpoints.internal)
  return probeTcp(host, port, timeoutMs)
}
