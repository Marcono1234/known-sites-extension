import { Services } from '@wdio/types'
import { SevereServiceError } from 'webdriverio'

import http from 'node:http'
import { AddressInfo } from 'node:net'

/**
 * Service which uses `browser.mock` to redirect all HTTP requests to a dummy HTTP server.
 * This is a workaround for https://github.com/webdriverio/webdriverio/issues/14090, see `browser.mock` usage below.
 */
export default class DummyHttpServerService
  implements Services.ServiceInstance
{
  private dummyHttpServer?: http.Server

  // Note: Would actually only need a single server (started in `onPrepare` and closed in `onComplete`),
  // but it seems then `before()` cannot access the `dummyHttpServer` field (and the port of the server),
  // maybe because it runs in a separate worker process, see also https://webdriver.io/docs/customservices;
  // therefore start a new server for each `before()`
  async before() {
    if (this.dummyHttpServer !== undefined) {
      // Expect that a new instance of this service class here is created for every test execution,
      // otherwise `after()` could not know which server to stop
      throw new SevereServiceError('dummy server is already running')
    }

    this.dummyHttpServer = await new Promise<http.Server>((resolve, reject) => {
      const server = http.createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(`<!doctype html>
        <html lang="en">
          <head>
            <title>Dummy Page</title>
          </head>
          <body>
            <h1>Dummy Page</h1>
          </body>
        </html>`)
      })

      server.on('error', (err) => reject(err))
      server.listen(
        {
          host: 'localhost',
          // Use arbitrary free port
          port: 0,
        },
        // Resolve Promise once server started listening
        () => resolve(server),
      )
    })
  }

  async after() {
    return new Promise((resolve, reject) => {
      if (this.dummyHttpServer === undefined) {
        resolve(null)
        return
      }

      this.dummyHttpServer.on('error', (err) => reject(err))
      this.dummyHttpServer.close((err) => (err ? reject(err) : resolve(null)))
      this.dummyHttpServer.closeAllConnections()
    })
  }

  // Set up mocking in `beforeSuite()` instead of `before()`, otherwise it seems this might run before installation
  // of the extension, and then installation fails with cryptic error
  async beforeSuite() {
    // Content of opened websites does not actually matter for the integration tests (and for `.invalid` URLs must
    // cancel request, otherwise browser shows a network error page, and URL assertions in tests fail), therefore
    // provide mock responses
    const mock = await browser.mock('**')
    // TODO: Ideally would just use `mock.respond('...', { fetchResponse: false })` (and directly define that in
    //   `wdio.conf.ts` instead of this dedicated service), but that does not work see https://github.com/webdriverio/webdriverio/issues/14090
    //   Therefore for now just redirect to dummy server
    const port = (this.dummyHttpServer!.address() as AddressInfo).port
    mock.redirect(`http://localhost:${port}`)
  }
}
