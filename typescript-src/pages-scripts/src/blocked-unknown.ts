import {
  ExtPageUrlParams,
  fromPageUrlParams,
  MessageData,
  MessageResponse,
} from '../../common-src/common'

// Based on https://github.com/EFForg/https-everywhere/blob/579b8c59d078fd65d547a546b381c9ae45c61232/chromium/pages/translation.js
function setI18nContent() {
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

function createSanitizedDomainForTitle(domain: string): string {
  // Note: Could probably also implement this with regex checking for negated range
  let sanitized = ''
  for (const c of domain) {
    if (isAscii(c.codePointAt(0))) {
      sanitized += c
    } else {
      sanitized += '?'
    }
  }

  return sanitized
}

type HighlightResult = {
  sanitizedDomainHtml: string
  originalDomainHtml: string
}

/** Creates highlighting data for non-ASCII domains, or `null` if the domain is ASCII-only */
function createHighlightedDomain(domain: string): HighlightResult | null {
  let sanitizedResultHtml = ''
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
      sanitizedResultHtml += toAdd
      originalResultHtml += toAdd

      wasLastNonAscii = false
    } else {
      hasNonAscii = true
      const prefix = wasLastNonAscii ? '' : '<span class="non-ascii-char">'
      sanitizedResultHtml += prefix + '?'
      originalResultHtml += prefix + escapedChar

      wasLastNonAscii = true
    }
  }

  if (wasLastNonAscii) {
    const toAdd = '</span>'
    sanitizedResultHtml += toAdd
    originalResultHtml += toAdd
  }

  return hasNonAscii
    ? {
        sanitizedDomainHtml: sanitizedResultHtml,
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
  const blockedPage = fromPageUrlParams(
    new URLSearchParams(window.location.search),
  )

  // To be safe, check token before using any of the URL parameters, since they could
  // be forged by a malicious website
  const token = blockedPage.token
  sendMessage({ action: 'check-token', token: token }).then(() =>
    initializePage(blockedPage),
  )
})

function initializePage(blockedPage: ExtPageUrlParams) {
  const blockedUrl = blockedPage.url
  const blockedDomain = blockedPage.domain
  const token = blockedPage.token

  setI18nContent()
  // Sanitize domain to avoid having it interfere with title, e.g. due to right-to-left override
  document.title = browser.i18n.getMessage(
    'blocked_window_title',
    createSanitizedDomainForTitle(blockedDomain),
  )

  const openButton = document.getElementById('open-button')!
  openButton.addEventListener('click', () => {
    console.info('Sending message to open URL')

    // Send message to let extension first add domain to cache and then open
    // it (to avoid immediately blocking it again), and also to validate token
    sendMessage({
      action: 'open-url',
      token: token,
      data: {
        url: blockedUrl,
        // Use raw domain value to use what the browser originally provided; assuming that
        // all APIs of the browser treat domain consistently
        domain: blockedPage.rawDomain,
        isIncognito: blockedPage.isIncognito,
      },
    })
  })

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

  const domainPlaceholder = document.getElementById('domain-placeholder')!
  const highlightedDomainHtmls = createHighlightedDomain(blockedDomain)

  if (highlightedDomainHtmls === null) {
    domainPlaceholder.textContent = blockedDomain
  } else {
    // Initially show encoded representation
    domainPlaceholder.innerHTML = highlightedDomainHtmls.sanitizedDomainHtml
    for (const element of document.getElementsByClassName('non-ascii-domain')) {
      // Show warning element
      element.classList.remove('hidden')
    }

    const toggleCheckbox = document.getElementById(
      'original-domain-toggle-checkbox',
    )!
    toggleCheckbox.addEventListener('change', (event) => {
      const isChecked = (event.target as HTMLInputElement).checked === true
      const newHtml = isChecked
        ? highlightedDomainHtmls.originalDomainHtml
        : highlightedDomainHtmls.sanitizedDomainHtml
      domainPlaceholder.innerHTML = newHtml
    })
  }
}
