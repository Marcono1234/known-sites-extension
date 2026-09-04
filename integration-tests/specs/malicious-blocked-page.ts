import { expect, browser } from '@wdio/globals'
import { describe } from 'mocha'

import {
  blockedPage,
  onceDialog,
  registerDialogHandler,
  translations,
} from '../src/test-helper.ts'

describe('malicious blocked page URL', () => {
  // Note: This test causes a warning to be logged in the webdriver logs, for the
  // intentional error message from the extension page
  it('wrong token, no reopen', async () => {
    await browser.url('https://wrong-token.invalid')
    await blockedPage.expectBlockedPage('wrong-token.invalid')
    const url = await browser.getUrl()
    // Insert 'a' in front of token
    const modifiedUrl = url.replace('token=', 'token=a')
    if (modifiedUrl === url) {
      throw new Error('failed to replace token')
    }

    // Prepare handling of error dialog
    const dialogPromise = registerDialogHandler(
      'confirm',
      translations.EN.errorIncorrectTokenInitialization,
      // Dismiss dialog -> unknown site should not be reopened
      (dialog) => dialog.dismiss(),
    )
    await browser.url(modifiedUrl)
    await dialogPromise

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

  // Tests behavior when blocked page has wrong token, and user chooses to reopen unknown site
  // Note: This test causes a warning to be logged in the webdriver logs, for the
  // intentional error message from the extension page
  it('wrong token, reopen', async () => {
    const unknownUrl =
      'https://wrong-token-reopen.invalid/test?test=%C3%A4#section'
    await browser.url(unknownUrl)
    await blockedPage.expectBlockedPage('wrong-token-reopen.invalid')
    const url = await browser.getUrl()
    // Insert 'a' in front of token
    const modifiedUrl = url.replace('token=', 'token=a')
    if (modifiedUrl === url) {
      throw new Error('failed to replace token')
    }

    // Prepare handling of error dialog
    const dialogPromise = registerDialogHandler(
      'confirm',
      translations.EN.errorIncorrectTokenInitialization,
      // Accept dialog -> unknown site should be reopened
      (dialog) => dialog.accept(),
    )
    await browser.url(modifiedUrl)
    await dialogPromise

    // Should have opened blocked page with current (correct) token
    await expect(browser).not.toHaveUrl(modifiedUrl)
    await blockedPage.expectBlockedPage('wrong-token-reopen.invalid', 'back')

    await blockedPage.buttonOpen().click()
    // Should have opened blocked URL
    await expect(browser).toHaveUrl(unknownUrl)

    // TODO: This does not work; in the launched browser the navigation works correctly, but somehow
    // for this `back()` call webdriver seems to erroneously stay on the current URL (and duplicate
    // it in history?); can be seen when using `await browser.pause(...)` after `back()` for debugging
    /*
    await browser.back()
    // Should have opened original blocked page, not the one with wrong token
    await blockedPage.expectBlockedPage('wrong-token-reopen.invalid')
    */
  })

  // Tests behavior when blocked page has wrong token, and URL protocol of unknown site is unsupported
  // Note: This test causes a warning to be logged in the webdriver logs, for the
  // intentional error message from the extension page
  it('wrong token, unsupported URL', async () => {
    await browser.url('https://wrong-token-unsupported-url.invalid')
    await blockedPage.expectBlockedPage('wrong-token-unsupported-url.invalid')
    const url = await browser.getUrl()
    // Insert 'a' in front of token
    const wrongTokenUrl = url.replace('token=', 'token=a')
    if (wrongTokenUrl === url) {
      throw new Error('failed to replace token')
    }
    const modifiedUrl = wrongTokenUrl.replace(
      /url=.*?&/,
      'url=javascript:alert(1)&',
    )
    if (modifiedUrl === wrongTokenUrl) {
      throw new Error('failed to replace URL')
    }

    // Prepare handling of error dialog
    const dialogPromise = registerDialogHandler(
      // Unlike the other "incorrect token" dialogs, this should be an 'alert' dialog which the user can
      // only cancel, but not accept
      'alert',
      translations.EN.errorIncorrectToken,
      (dialog) => dialog.dismiss(),
    )
    await browser.url(modifiedUrl)
    await dialogPromise

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
    onceDialog(async (dialog) => {
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
