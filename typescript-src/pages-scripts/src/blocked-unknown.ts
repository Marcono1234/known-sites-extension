import {
  ExtPageUrlParams,
  fromPageUrlParams,
  MessageData,
  MessageResponse,
} from '../../common-src/common'

// Based on https://github.com/EFForg/https-everywhere/blob/579b8c59d078fd65d547a546b381c9ae45c61232/chromium/pages/translation.js
function setI18nContent() {
  // Use a translation string here instead of e.g. `i18n.getUILanguage()` to actually match the translation
  // being used, for example in case the UI language is not supported and `default_locale` was used for translation
  document.documentElement.lang = browser.i18n.getMessage('blocked_html_lang')

  /** Set translated text based on data attributes */
  function setI18nContent(
    dataSuffix: string,
    callback: (element: Element, message: string) => void,
  ) {
    const attrName = 'data-i18n' + (dataSuffix === '' ? '' : '-' + dataSuffix)

    for (const element of document.querySelectorAll(`[${attrName}]`)) {
      const attrValue = element.getAttribute(attrName)
      if (attrValue === null) {
        console.error(`Missing attribute ${attrName}`, element)
        continue
      }

      const message = browser.i18n.getMessage(attrValue)
      if (message === '') {
        console.error(`Missing translation for ${attrValue}`)
      } else {
        callback(element, message)
      }
    }
  }

  const eyeIconInTextAlt = browser.i18n.getMessage(
    'blocked_eye_icon_in_text_alt',
  )

  setI18nContent('', (element, message) => (element.textContent = message))
  setI18nContent('formatted', (element, message) => {
    message = escapeHtml(message)
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/@NON-ASCII@/g, '<span class="non-ascii-char">?</span>')
      .replace(
        /@EYE-ICON@/g,
        `<img class="eye-icon-in-text" alt="${escapeHtml(eyeIconInTextAlt)}" />`,
      )
      .replace(/@ALT-KEY@/g, '<kbd>Alt</kbd>')
    element.innerHTML = message
  })
  setI18nContent('title', (element, message) =>
    element.setAttribute('title', message),
  )
  setI18nContent('img-alt', (element, message) =>
    element.setAttribute('alt', message),
  )
  setI18nContent('aria-label', (element, message) =>
    element.setAttribute('aria-label', message),
  )
}

// From https://stackoverflow.com/a/6234804
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function isAscii(codepoint: number | undefined): boolean {
  return codepoint !== undefined && codepoint >= 32 && codepoint <= 126
}

function createAsciiOnlyDomainForTitle(domain: string): string {
  // Note: Could probably also implement this with regex checking for negated range
  let asciiDomain = ''
  for (const c of domain) {
    if (isAscii(c.codePointAt(0))) {
      asciiDomain += c
    } else {
      asciiDomain += '?'
    }
  }

  return asciiDomain
}

type HighlightResult = {
  asciiOnlyDomainHtml: string
  originalDomainHtml: string
}

/** Creates highlighting data for non-ASCII domains, or `null` if the domain is ASCII-only */
function createHighlightedDomain(domain: string): HighlightResult | null {
  // HTML for the converted domain, where all non-ASCII chars have been replaced
  let asciiOnlyResultHtml = ''
  // HTML for the original domain, containing non-ASCII chars
  let originalResultHtml = ''
  let hasNonAscii = false
  // Used to track spans of multiple non-ASCII chars
  let wasLastNonAscii = false

  for (const c of domain) {
    const escapedChar = escapeHtml(c)
    // `c` is a single codepoint as string, can use codePointAt(0)
    const codepoint = c.codePointAt(0)
    // Check if ASCII
    if (isAscii(codepoint)) {
      const toAdd = (wasLastNonAscii ? '</span>' : '') + escapedChar
      asciiOnlyResultHtml += toAdd
      originalResultHtml += toAdd

      wasLastNonAscii = false
    } else {
      hasNonAscii = true
      const prefix = wasLastNonAscii ? '' : '<span class="non-ascii-char">'
      asciiOnlyResultHtml += prefix + '?'
      originalResultHtml += prefix + escapedChar

      wasLastNonAscii = true
    }
  }

  if (wasLastNonAscii) {
    const toAdd = '</span>'
    asciiOnlyResultHtml += toAdd
    originalResultHtml += toAdd
  }

  return hasNonAscii
    ? {
        asciiOnlyDomainHtml: asciiOnlyResultHtml,
        originalDomainHtml: originalResultHtml,
      }
    : null
}

/** Sends a message to the extension background script */
function sendMessage(message: MessageData): Promise<void> {
  return browser.runtime.sendMessage(message).then(
    (response: MessageResponse) => {
      if (response === 'success') {
        console.debug(`Message '${message.action}' was successfully processed`)
        return
      }

      console.error(`Message '${message.action}' was unsuccessful: ${response}`)
      if (response === 'error') {
        alert(browser.i18n.getMessage('blocked_action_failed_error'))
      } else if (response === 'incorrect-token') {
        alert(browser.i18n.getMessage('blocked_action_failed_incorrect_token'))
      } else {
        response satisfies never // ensure that if-else is exhaustive
      }

      // Mark Promise as rejected
      throw new Error(
        `Message '${message.action}' was unsuccessful: ${response}`,
      )
    },
    (error) => {
      console.error('Failed sending message', message, error)
    },
  )
}

// Based on https://github.com/EFForg/https-everywhere/blob/579b8c59d078fd65d547a546b381c9ae45c61232/chromium/pages/cancel/ux.js
document.addEventListener('DOMContentLoaded', () => {
  const blockedPageParams = fromPageUrlParams(
    new URLSearchParams(window.location.search),
  )

  // To be safe, check token before using any of the URL parameters, since they could
  // be forged by a malicious website
  const token = blockedPageParams.token
  sendMessage({ action: 'check-token', token: token }).then(() =>
    initializePage(blockedPageParams),
  )
})

function initializePage(blockedPageParams: ExtPageUrlParams) {
  const blockedUrl = blockedPageParams.url
  const blockedDomain = blockedPageParams.domain
  const canOpenIncognito = blockedPageParams.canOpenIncognito
  const token = blockedPageParams.token

  setI18nContent()
  // Replace non-ASCII chars in domain to avoid having it interfere with title, e.g. due to right-to-left override
  document.title = browser.i18n.getMessage(
    'blocked_window_title',
    createAsciiOnlyDomainForTitle(blockedDomain),
  )

  let revertButtonText: string
  let revertButtonAction: () => void

  if (history.length > 1) {
    revertButtonText = browser.i18n.getMessage('blocked_button_back')
    revertButtonAction = () => history.back()
  } else {
    revertButtonText = browser.i18n.getMessage('blocked_button_close_tab')
    revertButtonAction = () => {
      console.info('Sending message to close blocked page tab')

      // window.close() only seems to work when tab was opened by script
      // Therefore let extension close the tab
      sendMessage({
        action: 'close-tab',
        token: token,
      })
    }
  }

  const revertButton = document.getElementById('revert-button')!
  revertButton.textContent = revertButtonText
  revertButton.addEventListener('click', revertButtonAction)

  const openButton = document.getElementById('open-button')!
  openButton.addEventListener('click', (e) => {
    // TODO: When activating button by focusing it and pressing Enter, `altKey` seems to always be false?
    //   Not good for accessibility; would need a dedicated `keypress` listener for handling Enter?
    //   But is overriding the default listener a good idea (that is, can users normally customize the key for activating a button?)?
    const openIncognito = e.altKey

    if (openIncognito && !canOpenIncognito) {
      alert(browser.i18n.getMessage('blocked_cannot_open_incognito'))
      return
    }

    console.info(`Sending message to open URL; openIncognito: ${openIncognito}`)

    // Send message to let extension first add domain to cache and then open
    // it (to avoid immediately blocking it again), and also to validate token
    const messagePromise = sendMessage({
      action: 'open-url',
      token: token,
      data: {
        url: blockedUrl,
        // Use raw domain value to use what the browser originally provided; assuming that
        // all APIs of the browser treat domain consistently
        domain: blockedPageParams.rawDomain,
        openIncognito: openIncognito,
      },
    })

    if (openIncognito) {
      // Afterwards perform 'revert' action since URL was opened in new incognito window
      messagePromise.then(() => revertButtonAction())
    }
  })

  if (canOpenIncognito) {
    for (const element of document.getElementsByClassName(
      'open-incognito-hint',
    )) {
      // Show hint text
      element.removeAttribute('hidden')
    }
  }

  const domainPlaceholder = document.getElementById('domain-placeholder')!
  const highlightedDomainHtmls = createHighlightedDomain(blockedDomain)

  if (highlightedDomainHtmls === null) {
    domainPlaceholder.textContent = blockedDomain
  } else {
    // Initially show masked representation
    domainPlaceholder.innerHTML = highlightedDomainHtmls.asciiOnlyDomainHtml
    for (const element of document.getElementsByClassName('non-ascii-domain')) {
      // Show warning element
      element.removeAttribute('hidden')
    }

    const toggleCheckbox = document.getElementById(
      'original-domain-toggle-checkbox',
    )!
    toggleCheckbox.addEventListener('change', (event) => {
      const isChecked = (event.target as HTMLInputElement).checked === true
      const newHtml = isChecked
        ? highlightedDomainHtmls.originalDomainHtml
        : highlightedDomainHtmls.asciiOnlyDomainHtml
      domainPlaceholder.innerHTML = newHtml
    })
  }
}
