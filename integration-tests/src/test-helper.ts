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
  // Note: Apparently cannot directly pass in dummy URL to `newWindow`; webdriver does not wait for page to be loaded then?
  //   Therefore do this in separate steps
  await browser.newWindow('about:blank', { type: 'tab' })
  await browser.url('https://invalid.invalid')
  const result = await f()
  await browser.closeWindow()
  return result
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

    /** Error message for incorrect token */
    errorIncorrectToken: string
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

    errorIncorrectToken: 'Action failed. (incorrect token)',
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

  /** Performs assertions on the blocked page */
  export async function expectBlockedPage(
    domainText: string,
    button: 'close' | 'back' = 'close',
    nonAsciiDomainPieces: DisplayedDomainPiece[] | undefined = undefined,
    nonAsciiToggled: boolean = false,
  ) {
    await expectBlockedPageUrl()

    const en = translations.EN
    await expect(browser).toHaveTitle(en.windowTitle(domainText))
    // TODO: Uses xPath selector `/...` here because CSS selector does not find `html` element
    //   on older Firefox versions, see https://github.com/webdriverio/webdriverio/issues/15233
    await expect($('/html')).toHaveAttribute('lang', en.htmlLang)

    // Maybe improve this to better follow best practices at https://webdriver.io/docs/selectors/

    await expect($('h1')).toHaveText(en.headerText)
    await expect($('img.logo')).toHaveAttribute('alt', en.headerLogoAlt)
    await expect($('p[data-i18n="blocked_warning_text"]')).toHaveText(en.text)
    await expect($('p[data-i18n="blocked_warning_open_question"]')).toHaveText(
      en.textOpenQuestion,
    )

    const displayedDomain = displayedDomainElement()
    await expect(displayedDomain).toHaveText(
      nonAsciiDomainPieces === undefined
        ? domainText
        : nonAsciiDomainPieces.map((p) => p.s).join(''),
    )
    await expectDisplayedDomainHtml(
      displayedDomain,
      nonAsciiDomainPieces || [{ type: 'literal', s: domainText }],
    )
    await expect(displayedDomain).toBeDisplayedInViewport()

    const elementsNonAscii = $$('.non-ascii-domain')

    if (nonAsciiDomainPieces === undefined) {
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
      button === 'back' ? en.buttonBack : en.buttonCloseTab,
    )
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
      // @ts-expect-error: type declaration for `toHaveHTML` is wrong, see https://github.com/webdriverio/expect-webdriverio/issues/2089
      includeSelectorTag: false, // only check inner HTML
      prettify: false,
    })
  }
}
