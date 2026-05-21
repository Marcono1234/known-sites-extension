import { expect, browser } from '@wdio/globals'
import { describe } from 'mocha'

import { blockedPage } from '../src/test-helper.ts'

describe('navigation', () => {
  it('button go back', async () => {
    const domain1 = 'first.invalid'
    const domain2 = 'second.invalid'

    await browser.url('about:newtab')
    await expect(browser).toHaveUrl('about:newtab') // should not have been blocked

    await browser.url(`https://${domain1}`)
    await blockedPage.expectBlockedPage(domain1, 'back')

    await browser.url(`https://${domain2}`)
    await blockedPage.expectBlockedPage(domain2, 'back')

    await blockedPage.buttonRevert().click()
    // Navigated to first blocked page
    await blockedPage.expectBlockedPage(domain1, 'back')

    await blockedPage.buttonRevert().click()
    await expect(browser).toHaveUrl('about:newtab')

    // Domains should still be blocked
    await browser.url(`https://${domain1}`)
    await blockedPage.expectBlockedPage(domain1, 'back')

    await browser.url(`https://${domain2}`)
    await blockedPage.expectBlockedPage(domain2, 'back')
  })

  it('button close tab', async () => {
    const originalWindowHandle = await browser.getWindowHandle()
    const originalWindowCount = (await browser.getWindowHandles()).length
    // Create a new tab, to avoid closing window when all tabs are closed
    const tabHandle = (await browser.createWindow('tab')).handle
    await browser.switchToWindow(tabHandle)
    let windowHandles = await browser.getWindowHandles()
    expect(windowHandles.length).toBe(originalWindowCount + 1)
    expect(windowHandles).toContain(tabHandle)

    await browser.url('https://example.invalid')
    await blockedPage.expectBlockedPage('example.invalid')

    await blockedPage.buttonRevert().click()
    // Have to manually switch back to original tab; it seems otherwise after tab was closed by extension
    // webdriver still references the now closed tab
    await browser.switchToWindow(originalWindowHandle)

    // Tab should have been closed
    windowHandles = await browser.getWindowHandles()
    expect(windowHandles.length).toBe(originalWindowCount)
    expect(windowHandles).not.toContain(tabHandle)

    // Domain should still be blocked
    await browser.url('https://example.invalid')
    await blockedPage.expectBlockedPage('example.invalid')
  })

  it('navigate blocked', async () => {
    const domain1 = 'first.invalid'
    const domain2 = 'second.invalid'

    await browser.url('about:newtab')
    await expect(browser).toHaveUrl('about:newtab') // should not have been blocked

    await browser.url(`https://${domain1}`)
    await blockedPage.expectBlockedPage(domain1, 'back')

    await browser.url(`https://${domain2}`)
    await blockedPage.expectBlockedPage(domain2, 'back')

    await browser.back()
    // Navigated to first blocked page
    await blockedPage.expectBlockedPage(domain1, 'back')

    await browser.back()
    await expect(browser).toHaveUrl('about:newtab')

    await browser.forward()
    await blockedPage.expectBlockedPage(domain1, 'back')

    // Should still be blocked when opening again
    await browser.url(`https://${domain1}`)
    await blockedPage.expectBlockedPage(domain1, 'back')

    await browser.url(`https://${domain2}`)
    await blockedPage.expectBlockedPage(domain2, 'back')
  })

  it('navigate opened', async () => {
    await browser.url('about:newtab')
    await expect(browser).toHaveUrl('about:newtab') // should not have been blocked

    await browser.url('https://navigate-open.invalid')
    await blockedPage.expectBlockedPage('navigate-open.invalid', 'back')

    await blockedPage.buttonOpen().click()
    await expect(browser).toHaveUrl('https://navigate-open.invalid/')

    await browser.back()
    // Blocked page should not have been recorded in history after "Open" button was pressed
    await expect(browser).toHaveUrl('about:newtab')

    await browser.forward()
    await expect(browser).toHaveUrl('https://navigate-open.invalid/')
  })
})
