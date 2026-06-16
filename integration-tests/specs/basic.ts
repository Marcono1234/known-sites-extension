import { expect, browser } from '@wdio/globals'
import { describe } from 'mocha'
import { pathToFileURL } from 'node:url'

import { blockedPage } from '../src/test-helper.ts'

describe('blocked page, basic', () => {
  it('block unknown page', async () => {
    await browser.url('https://example1.invalid')
    await blockedPage.expectBlockedPage('example1.invalid')

    await blockedPage.buttonOpen().click()
    // Should have opened blocked URL
    await expect(browser).toHaveUrl('https://example1.invalid/')

    // Should consider other domain still as unknown
    await browser.url('https://example2.invalid')
    await blockedPage.expectBlockedPage('example2.invalid', 'back')

    // Should consider first domain as known, and not block it
    await browser.url('https://example1.invalid')
    await expect(browser).toHaveUrl('https://example1.invalid/')
  })

  // Note: Assumes that there is no PSL entry for the tested domains
  it('ignore subdomain', async () => {
    await browser.url('https://sub.sub-example.invalid')
    await blockedPage.expectBlockedPage('sub-example.invalid')

    await blockedPage.buttonOpen().click()
    // Should have opened blocked URL
    await expect(browser).toHaveUrl('https://sub.sub-example.invalid/')

    // Other subdomain should not be blocked
    await browser.url('https://other.sub-example.invalid')
    await expect(browser).toHaveUrl('https://other.sub-example.invalid/')

    // Parent domain should not be blocked
    await browser.url('https://sub-example.invalid')
    await expect(browser).toHaveUrl('https://sub-example.invalid/')

    // Should also work when first opening parent domain and then subdomain
    await browser.url('https://sub2-example.invalid')
    await blockedPage.expectBlockedPage('sub2-example.invalid', 'back')
    await blockedPage.buttonOpen().click()
    await expect(browser).toHaveUrl('https://sub2-example.invalid/')
    // Should not be blocked
    await browser.url('https://sub.sub2-example.invalid')
    await expect(browser).toHaveUrl('https://sub.sub2-example.invalid/')
  })

  it('ignore URL path', async () => {
    await browser.url('https://path-example.invalid/first-path')
    await blockedPage.expectBlockedPage('path-example.invalid')

    await blockedPage.buttonOpen().click()
    // Should have opened blocked URL
    await expect(browser).toHaveUrl('https://path-example.invalid/first-path')

    // Same domain with other URL path should not be blocked
    await browser.url('https://path-example.invalid/second-path')
    await expect(browser).toHaveUrl('https://path-example.invalid/second-path')
  })

  it('complex URL', async () => {
    await browser.url(
      'https://example-complex.invalid/test?test=%C3%A4#section',
    )
    await blockedPage.expectBlockedPage('example-complex.invalid')

    await blockedPage.buttonOpen().click()
    await expect(browser).toHaveUrl(
      'https://example-complex.invalid/test?test=%C3%A4#section',
    )
  })

  it('long domain', async () => {
    let domain = `${'a'.repeat(70)}.invalid`
    await browser.url(`https://${domain}`)

    await blockedPage.expectBlockedPage(domain)
    const size1 = await blockedPage.displayedDomainElement().getSize()

    domain = `${'a'.repeat(200)}.invalid`
    await browser.url(`https://${domain}`)

    await blockedPage.expectBlockedPage(domain, 'back')
    const size2 = await blockedPage.displayedDomainElement().getSize()

    // Verify that domain text was not wrapped into multiple lines
    expect(size1.height).toBe(size2.height)

    // Verify that domain text was truncated
    // TODO: Does not work; apparently this is the non-truncated width
    // expect(size1.width).toBe(size2.width)
  })

  it('http: URI blocked', async () => {
    await browser.url('http://http-uri.invalid')
    await blockedPage.expectBlockedPage('http-uri.invalid')

    // Should also block different capitalization of 'http:' (though most likely browser already normalizes it)
    await browser.url('HTTP://http-uri.invalid')
    await blockedPage.expectBlockedPage('http-uri.invalid')
  })

  it('https: URI blocked', async () => {
    await browser.url('https://https-uri.invalid')
    await blockedPage.expectBlockedPage('https-uri.invalid')

    // Should also block different capitalization of 'https:' (though most likely browser already normalizes it)
    await browser.url('HTTPS://https-uri.invalid')
    await blockedPage.expectBlockedPage('https-uri.invalid')
  })

  it('file: URI not be blocked', async () => {
    // Create a `file:///` URI for an existing path (directory root), otherwise browser does not load the page
    const url = pathToFileURL('/').toString()
    await browser.url(url)
    await expect(browser).toHaveUrl(url)
  })

  it('about: URI not blocked', async () => {
    for (const url of ['about:blank', 'about:newtab', 'about:about']) {
      await browser.url(url)
      await expect(browser).toHaveUrl(url)
    }
  })

  it('trailing dot', async () => {
    await browser.url('https://first.trailing-dot.invalid.')
    // Should show complete domain, including subdomain (regardless of PSL) and trailing dot
    await blockedPage.expectBlockedPage('first.trailing-dot.invalid.')

    await blockedPage.buttonOpen().click()
    // Should have opened blocked URL
    await expect(browser).toHaveUrl('https://first.trailing-dot.invalid./')

    // Should consider same domain, but without trailing dot, as unknown
    await browser.url('https://first.trailing-dot.invalid')
    await blockedPage.expectBlockedPage('trailing-dot.invalid', 'back')

    // Should consider other subdomain as unknown (with and without trailing dot)
    await browser.url('https://second.trailing-dot.invalid.')
    await blockedPage.expectBlockedPage('second.trailing-dot.invalid.', 'back')

    await browser.url('https://second.trailing-dot.invalid')
    await blockedPage.expectBlockedPage('trailing-dot.invalid', 'back')

    // After opening domain without trailing dot, should still consider domain with trailing dot as unknown
    // (i.e. opposite order of assertion done above)
    await blockedPage.buttonOpen().click()
    await expect(browser).toHaveUrl('https://second.trailing-dot.invalid/')
    await browser.url('https://second.trailing-dot.invalid.')
    await blockedPage.expectBlockedPage('second.trailing-dot.invalid.', 'back')

    // Parent domain with trailing dot should still be considered unknown
    await browser.url('https://trailing-dot.invalid.')
    await blockedPage.expectBlockedPage('trailing-dot.invalid.', 'back')
  })

  it('IPv4 address', async () => {
    await browser.url('http://127.1.0.0')
    await blockedPage.expectBlockedPage('127.1.0.0')

    await blockedPage.buttonOpen().click()
    // Should have opened blocked URL
    await expect(browser).toHaveUrl('http://127.1.0.0/')

    // Should consider other IP address still as unknown
    await browser.url('http://127.2.0.0')
    await blockedPage.expectBlockedPage('127.2.0.0', 'back')
  })

  it('IPv6 address', async () => {
    await browser.url('http://[::1]')
    await blockedPage.expectBlockedPage('[::1]')

    await blockedPage.buttonOpen().click()
    // Should have opened blocked URL
    await expect(browser).toHaveUrl('http://[::1]/')

    // Should consider other IP address still as unknown
    // (this IPv6 is Google DNS, see https://developers.google.com/speed/public-dns/docs/using#addresses)
    await browser.url('http://[2001:4860:4860::8888]')
    await blockedPage.expectBlockedPage('[2001:4860:4860::8888]', 'back')
  })
})
