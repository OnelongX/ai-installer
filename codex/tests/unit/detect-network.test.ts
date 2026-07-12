import net from 'node:net'

import { afterAll, describe, expect, it } from 'vitest'

import { probeTcp } from '../../src/main/installer/tasks/detect-network'

describe('detect-network probeTcp', () => {
  const servers: net.Server[] = []

  afterAll(() => {
    for (const s of servers) s.close()
  })

  it('returns true when a listener answers the connect', async () => {
    const server = net.createServer()
    servers.push(server)
    const port = await new Promise<number>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address()
        resolve(typeof addr === 'object' && addr ? addr.port : 0)
      })
    })

    expect(await probeTcp('127.0.0.1', port, 1000)).toBe(true)
  })

  it('returns false for a closed port on localhost', async () => {
    // 59999 is very unlikely to be listening; short timeout keeps it fast.
    // (We probe localhost rather than a TEST-NET host because captive
    // routers / proxies on some networks answer connects to unroutable IPs,
    // which would make a timeout-based assertion flaky.)
    expect(await probeTcp('127.0.0.1', 59_999, 500)).toBe(false)
  })
})
