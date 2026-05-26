import { expect, browser } from '@wdio/globals'
import { Key } from 'webdriverio'
import { describe } from 'mocha'

import {
  blockedPage,
  runAsExtension,
  translations,
} from '../src/test-helper.ts'

/** Asserts that the current window is an incognito window */
async function assertIncognitoWindow() {
  const incognito = await runAsExtension(
    async () =>
      await browser.execute(async () => {
        // @ts-expect-error: does not know about web-extension types
        return (await browser.windows.getCurrent()).incognito
      }),
  )
  if (incognito !== true) {
    throw new Error(`unexpected incognito value: ${incognito}`)
  }
}

/**
 * Opens a new incognito window.
 *
 * **Important:** Does not focus the new window yet. This function should be used together with
 * `executeAndGetWindowHandles` to get the incognito window handle and switch to it.
 */
async function openIncognitoWindow() {
  await runAsExtension(async () => {
    await browser.execute(async () => {
      // @ts-expect-error: does not know about web-extension types
      await browser.windows.create({
        incognito: true,
      })
    })
  })
}

/**
 * Clicks the "Open" button of the extension, in a way which should open the blocked site
 * in a new incognito window.
 */
async function clickOpenIncognito() {
  type ElementPos = {
    x: number
    y: number
  }
  async function elementPos(
    element: ChainablePromiseElement,
  ): Promise<ElementPos> {
    const location = await element.getLocation()
    const size = await element.getSize()
    // Position in the middle of the element
    return {
      x: location.x + size.width / 2,
      y: location.y + size.height / 2,
    }
  }

  // Perform 'press Alt' + 'Click'
  await browser.actions([
    browser.action('key').down(Key.Alt),
    browser
      .action('pointer')
      .move(await elementPos(blockedPage.buttonOpen()))
      .down('left')
      .up('left'),
  ])
}

type WindowHandles = {
  old: string
  new: string
}
/** Gets the 'old' and 'new' window handles, obtained before and after executing the action */
async function executeAndGetWindowHandles(
  action: () => Promise<void>,
): Promise<WindowHandles> {
  const oldHandles = await browser.getWindowHandles()
  const oldCurrentHandle = await browser.getWindowHandle()
  await action()

  const newHandles = await browser.getWindowHandles()
  if (newHandles.length !== oldHandles.length + 1) {
    throw new Error(`unexpected handles: ${newHandles}`)
  }

  const newHandlesFiltered = newHandles.filter((h) => !oldHandles.includes(h))
  // Also permit length of 2, because for `openIncognitoWindow()` it finds 2 handles
  // (maybe one for window and one for tab?)
  if (newHandlesFiltered.length !== 1 && newHandlesFiltered.length !== 2) {
    throw new Error(
      `unable to find new handle; filtered: ${newHandlesFiltered}; all: ${newHandles}`,
    )
  }

  return {
    old: oldCurrentHandle,
    new: newHandlesFiltered[0],
  }
}

// Delegates to the test helper function, but uses default values for the non-ASCII function parameters
async function expectBlockedPage(
  domainText: string,
  revertButton: 'back' | 'close',
  incognitoHintShown: boolean,
) {
  await blockedPage.expectBlockedPage(
    domainText,
    revertButton,
    null,
    false,
    incognitoHintShown,
  )
}

/*
 * Notes:
 * - This is a separate / additional test from the Firefox Private mode config in `wdio.conf.ts` to more
 *   specifically test incognito functionality, instead of just running basic tests additionally in
 *   Private mode.
 * - These tests all assume that `wdio.conf.ts` successfully enabled the extension in Private mode.
 */
describe('incognito mode', () => {
  it('open incognito, go back', async () => {
    await browser.url('about:newtab')

    const domain = 'go-back.invalid'
    const url = `https://${domain}/`

    await browser.url(url)
    await expectBlockedPage(domain, 'back', true)

    const handles = await executeAndGetWindowHandles(clickOpenIncognito)

    await browser.switchToWindow(handles.old)
    // In non-incognito window should have navigated back to previous page
    await expect(browser).toHaveUrl('about:newtab')

    // Domain should still be blocked in non-incognito window
    await browser.url(url)
    await expectBlockedPage(domain, 'back', true)

    // Switch to potential incognito window
    await browser.switchToWindow(handles.new)
    await assertIncognitoWindow()
    // Should have opened blocked site in incognito window
    // Note: This only works because extension currently does not use `incognito: split` yet;
    //   if that is changed, then incognito window would initially block domain as well
    await expect(browser).toHaveUrl(url)

    // Other domain should still be blocked in incognito window
    await browser.url('https://other.invalid')
    await expectBlockedPage(
      'other.invalid',
      'back',
      // Should not show incognito hint, because already in incognito window
      false,
    )

    // Known domain should not be blocked in incognito window
    await browser.url(url)
    await expect(browser).toHaveUrl(url)

    // Close incognito window
    await browser.closeWindow()

    // Domain should still be blocked in non-incognito window
    await browser.url(url)
    await expectBlockedPage(domain, 'back', true)
  })

  it('open incognito, close tab', async () => {
    const originalWindowHandle = await browser.getWindowHandle()
    const originalWindowCount = (await browser.getWindowHandles()).length
    // Create a new tab, to avoid closing window when all tabs are closed
    const tabHandle = (await browser.createWindow('tab')).handle
    await browser.switchToWindow(tabHandle)
    let windowHandles = await browser.getWindowHandles()
    expect(windowHandles.length).toBe(originalWindowCount + 1)
    expect(windowHandles).toContain(tabHandle)

    const domain = 'close-tab.invalid'
    const url = `https://${domain}/`

    await browser.url(url)
    await expectBlockedPage(domain, 'close', true)

    const handles = await executeAndGetWindowHandles(clickOpenIncognito)
    // Note: Don't use `handles.old` here because that refers to the now closed tab
    await browser.switchToWindow(originalWindowHandle)
    // Tab should have been closed
    windowHandles = await browser.getWindowHandles()
    expect(windowHandles).not.toContain(tabHandle)

    // Domain should still be blocked in non-incognito window
    await browser.url(url)
    await expectBlockedPage(domain, 'close', true)

    // Switch to potential incognito window
    await browser.switchToWindow(handles.new)
    await assertIncognitoWindow()
    // Should have opened blocked URL in incognito window
    await expect(browser).toHaveUrl(url)

    // Close incognito window
    await browser.closeWindow()
  })

  it('open incognito, already incognito', async () => {
    // Open and switch to incognito window
    const handles = await executeAndGetWindowHandles(openIncognitoWindow)
    await browser.switchToWindow(handles.new)

    // Prepare handling of error dialog
    const dialogMessagePromise = new Promise((resolve, reject) =>
      browser.on('dialog', async (dialog) => {
        const type = dialog.type()
        const message = dialog.message()
        if (type === 'alert') {
          resolve(message)
        } else {
          reject(`unexpected dialog type: ${type}; with message '${message}'`)
        }
        await dialog.dismiss()
      }),
    )

    const domain = 'already-incognito.invalid'
    const url = `https://${domain}/`

    await browser.url(url)
    await expectBlockedPage(
      domain,
      // Firefox seems to open `about:privatebrowsing` by default in the new incognito window,
      // therefore button has 'back' behavior
      'back',
      // Should not show incognito hint, because already in incognito window
      false,
    )

    await clickOpenIncognito()
    expect(await dialogMessagePromise).toBe(
      translations.EN.errorCannotOpenIncognito,
    )
    // Should still be blocked page
    await expectBlockedPage(domain, 'back', false)

    await blockedPage.buttonOpen().click()
    // Should have opened blocked URL
    await expect(browser).toHaveUrl(url)

    // Close incognito window
    await browser.closeWindow()
  })

  // Verifies that incognito mode uses a separate known domains cache
  it('separate contexts', async () => {
    const handles = await executeAndGetWindowHandles(openIncognitoWindow)
    const regularHandle = handles.old
    const incognitoHandle = handles.new

    const regularDomain = 'context-regular.invalid'
    const regularUrl = `https://${regularDomain}/`

    const incognitoDomain = 'context-incognito.invalid'
    const incognitoUrl = `https://${incognitoDomain}/`

    await browser.switchToWindow(regularHandle)

    await browser.url(regularUrl)
    await expectBlockedPage(regularDomain, 'close', true)

    await blockedPage.buttonOpen().click()
    await expect(browser).toHaveUrl(regularUrl)

    await browser.switchToWindow(incognitoHandle)
    await browser.url(regularUrl)
    // Incognito window considers known websites from regular window
    await expect(browser).toHaveUrl(regularUrl)

    await browser.url(incognitoUrl)
    await expectBlockedPage(incognitoDomain, 'back', false)

    await blockedPage.buttonOpen().click()
    await expect(browser).toHaveUrl(incognitoUrl)

    // Should not be blocked anymore
    await browser.url(incognitoUrl)
    await expect(browser).toHaveUrl(incognitoUrl)

    await browser.switchToWindow(regularHandle)
    await browser.url(incognitoUrl)
    // Regular window should consider domain opened in incognito mode as unknown
    await expectBlockedPage(incognitoDomain, 'back', true)

    // Close incognito window
    // Do this last to ensure regular window is really not using incognito cache, because closing
    // last incognito window clears the cache (and therefore test would not notice the difference)
    await browser.switchToWindow(incognitoHandle)
    await browser.closeWindow()
  })

  // Closing last incognito window clears incognito cache
  it('cache clearing', async () => {
    const handles = await executeAndGetWindowHandles(openIncognitoWindow)
    const regularHandle = handles.old
    let incognitoHandle = handles.new

    const regularDomain = 'cache-clearing-regular.invalid'
    const regularUrl = `https://${regularDomain}/`

    const incognitoDomain = 'cache-clearing-incognito.invalid'
    const incognitoUrl = `https://${incognitoDomain}/`

    await browser.switchToWindow(regularHandle)

    await browser.url(regularUrl)
    await expectBlockedPage(regularDomain, 'close', true)

    await blockedPage.buttonOpen().click()
    await expect(browser).toHaveUrl(regularUrl)

    await browser.switchToWindow(incognitoHandle)
    await browser.url(incognitoUrl)
    await expectBlockedPage(incognitoDomain, 'back', false)

    await blockedPage.buttonOpen().click()
    await expect(browser).toHaveUrl(incognitoUrl)

    // Close incognito window and open new one; extension should clear cache and domain should be
    // considered unknown again
    await browser.closeWindow()
    incognitoHandle = (await executeAndGetWindowHandles(openIncognitoWindow))
      .new
    await browser.switchToWindow(incognitoHandle)
    await browser.url(incognitoUrl)
    await expectBlockedPage(incognitoDomain, 'back', false)

    // Close incognito window
    await browser.closeWindow()

    // Regular cache should have been unaffected; domain should still be considered 'known'
    // (Note that verifying the cache entry here relies on webdriver not actually recording browser
    //  history entries otherwise extension would simply fall back to history check, see also
    //  `browser-history.ts`. But even if webdriver did record history entries keep this assertion
    //  here to be safe.)
    await browser.url(regularUrl)
    await expect(browser).toHaveUrl(regularUrl)
  })
})
