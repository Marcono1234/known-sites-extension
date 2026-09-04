import { expect, browser } from '@wdio/globals'

/**
 * Executes the given function in the context of the extension, meaning it has access
 * to the [web extension API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API)
 * (based on the permissions of the extension).
 */
/*
 * Note: This is quite hacky, but it seems webdriver has no dedicated API at the moment to access
 * and modify browser features such as bookmarks and history.
 */
export async function runAsExtension<T>(f: () => Promise<T>): Promise<T> {
  // Open an arbitrary URL which will be blocked by the extension
  // Do this in a separate temporary tab to not affect navigation behavior of the current tab
  const oldHandle = await browser.getWindowHandle()
  // Note: Use `createWindow` instead of `newWindow(url, ...)` here because the latter fails with NS_BINDING_ABORTED,
  //   maybe due to mocking of requests?
  const tabHandle = (await browser.createWindow('tab')).handle
  await browser.switchToWindow(tabHandle)
  await browser.url('https://run-as-extension.invalid')
  const result = await f()
  // Switch back to tab before calling `closeWindow()`, in case executing the function created a new tab / window
  await browser.switchToWindow(tabHandle)
  await browser.closeWindow()
  // Switch back to previous window; it seems `closeWindow()` might otherwise focus initial window instead
  // of last focused one
  await browser.switchToWindow(oldHandle)
  return result
}

/**
 * Registers a listener for the 'dialog' event, to be invoked at most once.
 *
 * Workaround for https://github.com/webdriverio/webdriverio/issues/15558
 */
// TODO: Remove once webdriver bug is fixed
export function onceDialog(
  listener: (dialog: WebdriverIO.Dialog) => Promise<void>,
) {
  const wrappingListener = async (dialog: WebdriverIO.Dialog) => {
    // Disable lint; inconsistent with `browser.on`, `browser.off` type declaration does not support async listener
    /* eslint-disable-next-line @typescript-eslint/no-misused-promises */
    browser.off('dialog', wrappingListener)
    await listener(dialog)
  }
  browser.on('dialog', wrappingListener)
}

/**
 * Registers a handler for a browser dialog.
 *
 * @param dialogAction called when the dialog has the expected type and message; should either accept
 *    or dismiss the dialog
 * @returns promise which is resolved when the expected dialog appeared, and is rejected when an
 *    unexpected dialog appeared
 */
export async function registerDialogHandler(
  expectedType: 'alert' | 'confirm' | 'prompt',
  expectedMessage: string,
  dialogAction: (dialog: WebdriverIO.Dialog) => Promise<void>,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    onceDialog(async (dialog) => {
      const type = dialog.type()
      const message = dialog.message()

      try {
        expect(type).toBe(expectedType)
        expect(message).toBe(expectedMessage)

        await dialogAction(dialog)
        resolve()
      } catch (error) {
        // Dismiss in case of wrong type or message; https://webdriver.io/docs/api/dialog/ says must always
        // accept or dismiss to avoid freezing page
        await dialog.dismiss()
        // Reject afterwards, so dialog promise is only done when dialog has actually been dismissed already
        // Assume that this is an instance of `Error`
        /* eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors */
        reject(error)
      }
    })
  }).catch((error) => {
    if (error instanceof Error) {
      // Use the stack trace from the caller which awaits the promise result; otherwise the error has a stack trace
      // from webdriver's event handling, making it difficult to know where `registerDialogHandler` was called
      Error.captureStackTrace(error)
    }
    throw error
  })
}

/** Translations of the extension UI */
export namespace translations {
  export interface Translations {
    /** HTML 'lang' attribute value */
    htmlLang: string

    /** Title of the tab, for the given domain display text */
    windowTitle(domainText: string): string

    /** 'alt' text for the header logo */
    headerLogoAlt: string
    headerText: string

    /** Main text of the blocked page */
    text: string
    /** Question whether user wants to open the blocked website */
    textOpenQuestion: string
    /** Non-ASCII warning text, without any formatting */
    textNonAscii: string
    /** Non-ASCII warning text, formatted as HTML */
    textNonAsciiHtml: string

    /** ARIA label for the checkbox */
    toggleOriginalDomainLabel: string
    /** 'title' text (= hover text) for the checkbox icon */
    toggleOriginalDomainTitle: string
    /** 'alt' text for the toggle icon (for usage in text) */
    toggleOriginalDomainIconAlt: string

    buttonOpen: string
    buttonBack: string
    buttonCloseTab: string

    hintIncognito: string
    hintIncognitoHtml: string

    errorCannotOpenIncognito: string
    /** Error message for incorrect token */
    errorIncorrectToken: string
    /**
     * Error message for incorrect token dialog during initialization of blocked page.
     * Unlike {@link errorIncorrectToken} this dialog asks the user whether they want to
     * reopen the unknown site.
     */
    errorIncorrectTokenInitialization: string
  }

  /** English translations */
  export const EN: Translations = {
    htmlLang: 'en',

    windowTitle: function (domainText: string): string {
      return `Blocked – ${domainText}`
    },

    headerLogoAlt: 'Logo',
    headerText: 'Unknown Website Blocked',

    text: 'You are trying to open a website which you have not opened before. Please verify that you really want to open this website; this might be a phishing attack.',
    textOpenQuestion: 'Do you want to open this website?',
    textNonAscii:
      'The domain of the website uses special characters (replaced here with ' +
      '?' +
      '), this is sometimes used to ' +
      'deceive users' +
      '. To view the original domain, click the ' +
      'icon, but note that certain characters might completely change the way the text is displayed, such as changing the text direction.',
    textNonAsciiHtml:
      'The domain of the website uses special characters (replaced here with ' +
      '<span class="non-ascii-char">?</span>' +
      '), this is sometimes used to ' +
      '<b>deceive users</b>' +
      '. To view the original domain, click the ' +
      '<img class="eye-icon-in-text" alt="Toggle original domain icon"> ' +
      'icon, but note that certain characters might completely change the way the text is displayed, such as changing the text direction.',

    toggleOriginalDomainLabel: 'Toggle original domain',
    toggleOriginalDomainTitle: 'Click to toggle',
    toggleOriginalDomainIconAlt: 'Toggle original domain icon',

    buttonOpen: 'Open',
    buttonBack: 'Go back',
    buttonCloseTab: 'Close tab',

    hintIncognito:
      "Hint: Hold the Alt key while clicking the 'Open' button to open the website in a new Incognito / Private window.",
    hintIncognitoHtml:
      "Hint: Hold the <kbd>Alt</kbd> key while clicking the 'Open' button to open the website in a new Incognito / Private window.",

    errorCannotOpenIncognito: 'Incognito / Private window cannot be opened',
    errorIncorrectToken: 'Action failed. (incorrect token)',
    errorIncorrectTokenInitialization:
      'Loading the extension page failed (incorrect token).\nTry to reopen the unknown website?',
  }
}

/** Provides utility functions for interacting with the blocked page of the extension */
export namespace blockedPage {
  /** Element displaying the blocked domain (possibly with non-ASCII chars replaced) */
  export function displayedDomainElement(): ChainablePromiseElement {
    return $('#domain-placeholder')
  }

  /**
   * The clickable label of the checkbox for toggling display of a non-ASCII domain
   * (not visible if domain is ASCII-only)
   */
  export function checkboxLabelToggleAscii(): ChainablePromiseElement {
    return $('label[for="original-domain-toggle-checkbox"]')
  }

  /** The "Open blocked page" button */
  export function buttonOpen(): ChainablePromiseElement {
    return $('button#open-button')
  }

  /** The "Go back" / "Close tab" button */
  export function buttonRevert(): ChainablePromiseElement {
    return $('button#revert-button')
  }

  /**
   * Piece of a displayed domain; either
   * - literal
   * - highlighted, for a non-ASCII part
   */
  export interface DisplayedDomainPiece {
    type: 'literal' | 'highlighted'
    s: string
  }

  export async function expectBlockedPageUrl() {
    await expect(browser).toHaveUrl(
      /^moz-extension:\/\/.+\/pages\/blocked-unknown\.html\?.+/,
    )
  }

  /**
   * Performs assertions on the blocked page
   *
   * @param revertButton behavior of the 'revert' button
   * @param nonAsciiDomainPieces `null` if ASCII-only domain
   * @param incognitoHintShown `undefined` if it does not matter for the test
   */
  export async function expectBlockedPage(
    domainText: string,
    revertButton: 'close' | 'back' = 'close',
    nonAsciiDomainPieces: DisplayedDomainPiece[] | null = null,
    nonAsciiToggled: boolean = false,
    incognitoHintShown: boolean | undefined = undefined,
  ) {
    await expectBlockedPageUrl()

    const en = translations.EN

    const titleLimit = 30
    const expectedTitleDomain =
      domainText.length > titleLimit
        ? `…${domainText.substring(domainText.length - titleLimit)}`
        : domainText
    await expect(browser).toHaveTitle(en.windowTitle(expectedTitleDomain))

    await expect($('html')).toHaveAttribute('lang', en.htmlLang)

    // Maybe improve this to better follow best practices at https://webdriver.io/docs/selectors/

    await expect($('h1')).toHaveText(en.headerText)
    await expect($('img.logo')).toHaveAttribute('alt', en.headerLogoAlt)
    await expect($('p[data-i18n="blocked_warning_text"]')).toHaveText(en.text)
    await expect($('p[data-i18n="blocked_warning_open_question"]')).toHaveText(
      en.textOpenQuestion,
    )

    const displayedDomain = displayedDomainElement()
    await expect(displayedDomain).toHaveText(
      nonAsciiDomainPieces === null
        ? domainText
        : nonAsciiDomainPieces.map((p) => p.s).join(''),
    )
    await expectDisplayedDomainHtml(
      displayedDomain,
      nonAsciiDomainPieces || [{ type: 'literal', s: domainText }],
    )
    await expect(displayedDomain).toBeDisplayedInViewport()

    const elementsNonAscii = $$('.non-ascii-domain')

    if (nonAsciiDomainPieces === null) {
      await elementsNonAscii.forEach(
        async (e) => await expect(e).not.toBeDisplayed(),
      )
    } else {
      await elementsNonAscii.forEach(
        async (e) => await expect(e).toBeDisplayedInViewport(),
      )

      // Note: It seems the checkbox itself is not 'clickable', only its label, which is handled below
      const checkbox = $('input#original-domain-toggle-checkbox')
      if (nonAsciiToggled) {
        await expect(checkbox).toBeChecked()
      } else {
        await expect(checkbox).not.toBeChecked()
      }
      await expect(checkbox).toHaveAttribute(
        'aria-label',
        en.toggleOriginalDomainLabel,
      )

      const checkboxLabel = checkboxLabelToggleAscii()
      await expect(checkboxLabel).toBeClickable()
      await expect(checkboxLabel).toHaveAttribute(
        'title',
        en.toggleOriginalDomainTitle,
      )

      const nonAsciiWarning = $(
        'p[data-i18n-formatted="blocked_non_ascii_warning_text"]',
      )
      await expect(nonAsciiWarning).toHaveText(en.textNonAscii)
      await expectInnerHtml(nonAsciiWarning, en.textNonAsciiHtml)
    }

    const buttonOpen_ = buttonOpen()
    await expect(buttonOpen_).toBeClickable()
    await expect(buttonOpen_).toHaveText(en.buttonOpen)

    const buttonRevert_ = buttonRevert()
    await expect(buttonRevert_).toBeClickable()
    await expect(buttonRevert_).toHaveText(
      revertButton === 'back' ? en.buttonBack : en.buttonCloseTab,
    )

    if (incognitoHintShown !== undefined) {
      const incognitoHint = $(
        'p[data-i18n-formatted="blocked_hint_open_incognito"]',
      )
      if (incognitoHintShown) {
        await expect(incognitoHint).toBeDisplayedInViewport()
        await expect(incognitoHint).toHaveText(en.hintIncognito)
        await expectInnerHtml(incognitoHint, en.hintIncognitoHtml)
      } else {
        await expect(incognitoHint).not.toBeDisplayed()
      }
    }
  }

  async function expectDisplayedDomainHtml(
    element: ChainablePromiseElement,
    nonAsciiDomainPieces: DisplayedDomainPiece[],
  ) {
    const expectedInnerHtml = nonAsciiDomainPieces
      .map((p) =>
        p.type === 'literal'
          ? p.s
          : `<span class="non-ascii-char">${p.s}</span>`,
      )
      .join('')

    await expectInnerHtml(element, expectedInnerHtml)
  }

  export async function expectInnerHtml(
    element: ChainablePromiseElement,
    expectedHtml: string,
  ) {
    await expect(element).toHaveHTML(expectedHtml, {
      includeSelectorTag: false, // only check inner HTML
      // @ts-expect-error: type declaration for `toHaveHTML` is missing some options, see https://github.com/webdriverio/expect-webdriverio/issues/2206
      prettify: false,
    })
  }
}
