import { expect, browser } from '@wdio/globals'
import { describe } from 'mocha'

import { blockedPage } from '../src/test-helper.ts'

describe('public suffix list', () => {
  it('allowed subdomain, first parent', async () => {
    await browser.url('https://github.com')
    await blockedPage.expectBlockedPage('github.com')

    await blockedPage.buttonOpen().click()
    // Should have opened blocked page
    await expect(browser).toHaveUrl('https://github.com/')

    await browser.url('https://docs.github.com')
    // Should be allowed, since it is not a separate domain based on PSL
    await expect(browser).toHaveUrl('https://docs.github.com/')
  })

  it('allowed subdomain, first subdomain', async () => {
    // Note: Use different domain than in first 'allowed subdomain' test, since that one already
    // opened domain, and therefore affected browser state
    await browser.url('https://www.google.com')
    // Should show parent domain, since PSL does not consider it separate
    await blockedPage.expectBlockedPage('google.com')

    await blockedPage.buttonOpen().click()
    // Should have opened blocked page
    await expect(browser).toHaveUrl('https://www.google.com/')

    await browser.url('https://google.com')
    await expect(browser).toHaveUrl('https://google.com/')
  })

  it('PSL .co.uk', async () => {
    await browser.url('https://google.co.uk')
    await blockedPage.expectBlockedPage('google.co.uk')

    await blockedPage.buttonOpen().click()
    // Should have opened blocked page
    await expect(browser).toHaveUrl('https://google.co.uk/')

    await browser.url('https://wikipedia.co.uk')
    await blockedPage.expectBlockedPage('wikipedia.co.uk', 'back')
  })

  it('PSL .github.io', async () => {
    await browser.url('https://octocat.github.io')
    await blockedPage.expectBlockedPage('octocat.github.io')

    await blockedPage.buttonOpen().click()
    // Should have opened blocked page
    await expect(browser).toHaveUrl('https://octocat.github.io/')

    await browser.url('https://google.github.io')
    await blockedPage.expectBlockedPage('google.github.io', 'back')

    // Parent domain should still be blocked
    await browser.url('https://github.io')
    await blockedPage.expectBlockedPage('github.io', 'back')
  })

  it('PSL trailing dot', async () => {
    await browser.url('https://square.github.io')
    await blockedPage.expectBlockedPage('square.github.io')

    await blockedPage.buttonOpen().click()
    // Should have opened blocked page
    await expect(browser).toHaveUrl('https://square.github.io/')

    // Try other domain with trailing dot; should not circumvent PSL
    await browser.url('https://microsoft.github.io./')
    await blockedPage.expectBlockedPage('microsoft.github.io.', 'back')

    await blockedPage.buttonOpen().click()
    // Should have opened blocked page
    await expect(browser).toHaveUrl('https://microsoft.github.io./')

    // To be safe, same domain but without trailing dot should still be blocked
    await browser.url('https://microsoft.github.io/')
    await blockedPage.expectBlockedPage('microsoft.github.io', 'back')

    // Parent domain should still be blocked
    await browser.url('https://github.io')
    await blockedPage.expectBlockedPage('github.io', 'back')
  })
})
