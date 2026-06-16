import { expect, browser } from '@wdio/globals'
import { describe } from 'mocha'

import { blockedPage, translations } from '../src/test-helper.ts'

describe('malicious blocked page URL', () => {
  // Note: This test causes a warning to be logged in the webdriver logs, for the
  // intentional error message from the extension page
  it('wrong token', async () => {
    await browser.url('https://invalid.invalid')
    await blockedPage.expectBlockedPage('invalid.invalid')
    const url = await browser.getUrl()
    // Insert 'a' in front of token
    const modifiedUrl = url.replace('token=', 'token=a')
    if (modifiedUrl === url) {
      throw new Error('failed to replace token')
    }

    // Prepare handling of error dialog
    const dialogMessagePromise = new Promise((resolve, reject) =>
      /* eslint-disable-next-line @typescript-eslint/no-misused-promises -- type declaration bug? https://github.com/webdriverio/webdriverio/issues/15276 */
      browser.on('dialog', async (dialog) => {
        const type = dialog.type()
        const message = dialog.message()
        if (type === 'alert') {
          resolve(message)
        } else {
          reject(
            new Error(
              `unexpected dialog type: ${type}; with message '${message}'`,
            ),
          )
        }
        await dialog.dismiss()
      }),
    )
    await browser.url(modifiedUrl)
    expect(await dialogMessagePromise).toBe(translations.EN.errorIncorrectToken)

    await blockedPage.expectBlockedPageUrl()

    // Current implementation leaves UI uninitialized in case of incorrect token
    await expect(blockedPage.displayedDomainElement()).toHaveText('')
    await expect(blockedPage.buttonOpen()).toHaveText('')
    await expect(blockedPage.buttonRevert()).toHaveText('')

    // Clicking the buttons should have no effect
    await blockedPage.buttonOpen().click()
    await blockedPage.expectBlockedPageUrl()

    await blockedPage.buttonRevert().click()
    await blockedPage.expectBlockedPageUrl()
  })

  // Note: It is unlikely that (1) a modified blocked page URL is opened because it looks like websites
  //   cannot open extension pages, and (2) even more unlikely that it will have the correct 'token'
  //   However, in case that is somehow possible, the following test verifies that at least no HTML injection
  //   is possible (which might be able to execute code with the permissions of the extension);
  //   though a malicious blocked page URL could still try to deceive the user (e.g. include a different
  //   'raw domain' than the one displayed to the user)
  async function checkHtmlInjection(
    injectedAlertMessage: string,
    expectedDomainString: string,
  ) {
    await browser.url('https://invalid.invalid')
    await blockedPage.expectBlockedPage('invalid.invalid')

    const url = await browser.getUrl()
    const modifiedUrlObj = new URL(await browser.getUrl())
    const params = modifiedUrlObj.searchParams
    for (const param of params.keys()) {
      // Modify everything except 'token', so that blocked page URL is still valid
      if (param !== 'token') {
        params.set(param, `<script>alert("${injectedAlertMessage}")</script>`)
      }
    }

    const modifiedUrl = modifiedUrlObj.href
    if (modifiedUrl === url) {
      throw new Error('failed to modify URL')
    }

    let htmlInjectionMessage: string | null = null
    /* eslint-disable-next-line @typescript-eslint/no-misused-promises -- type declaration bug? https://github.com/webdriverio/webdriverio/issues/15276 */
    browser.on('dialog', async (dialog) => {
      // Also specify a fallback message in case `message()` is for whatever reason null,
      // to still detect that dialog appeared
      htmlInjectionMessage = dialog.message() || 'no message'
      await dialog.dismiss()
    })
    await browser.url(modifiedUrl)

    await blockedPage.expectInnerHtml(
      blockedPage.displayedDomainElement(),
      `&lt;script&gt;alert("${expectedDomainString}")&lt;/script&gt;`,
    )
    // No dialog should have appeared, respectively no HTML injection should have occurred
    expect(htmlInjectionMessage).toBeNull()
  }

  it('HTML injection', async () => {
    await checkHtmlInjection('XSS', 'XSS')
  })

  it('HTML injection, non-ASCII', async () => {
    await checkHtmlInjection(
      'XSS äö',
      'XSS <span class="non-ascii-char">??</span>',
    )
  })
})
