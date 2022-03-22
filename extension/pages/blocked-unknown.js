"use strict;"

// Based on https://github.com/EFForg/https-everywhere/blob/579b8c59d078fd65d547a546b381c9ae45c61232/chromium/pages/translation.js
function setI18nContent() {
    // Set translated text based on data attributes
    /**
     * @callback i18nCallback
     * @param {HTMLElement} element
     * @param {string} translatedMessage
     */
    /**
     * @param {string} dataSuffix
     * @param {i18nCallback} callback
     */
    function setI18nContent(dataSuffix, callback) {
        const attrName = 'data-i18n' + (dataSuffix === '' ? '' : ('-' + dataSuffix))

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
                // @ts-ignore
                callback(element, message)
            }
        }
    }

    const eyeIconInTextAlt = browser.i18n.getMessage('blocked_eye_icon_in_text_alt')

    setI18nContent('', (element, message) => element.textContent = message)
    setI18nContent('formatted', (element, message) => {
        message = escapeHtml(message)
            .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
            .replace(/@NON-ASCII@/g, '<span class=\"non-ascii-char\">?</span>')
            .replace(/@EYE-ICON@/g, `<img class=\"eye-icon-in-text\" alt=\"${escapeHtml(eyeIconInTextAlt)}\" />`)
        element.innerHTML = message
    })
    setI18nContent('title', (element, message) => element.title = message)
    setI18nContent('img-alt', (element, message) => element.setAttribute('alt', message))
    setI18nContent('aria-label', (element, message) => element.setAttribute('aria-label', message))
}

// From https://stackoverflow.com/a/6234804
/**
 * @param {string} input 
 * @returns {string}
 */
function escapeHtml(input) {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

/**
 * @param {number} codepoint 
 * @returns {boolean}
 */
function isAscii(codepoint) {
    return codepoint >= 32 && codepoint <= 126
}

/**
 * @param {string} domain 
 * @returns {string}
 */
function createSanitizedDomainForTitle(domain) {
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

/**
 * @typedef HighlightResult
 * @type {object}
 * @property {string} sanitizedDomainHtml
 * @property {string} originalDomainHtml
 * 
 * @param {string} domain 
 * @returns {?HighlightResult}
 */
function createHighlightedDomain(domain) {
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
            const prefix = (wasLastNonAscii ? '' : '<span class="non-ascii-char">')
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

    return hasNonAscii ? {
        sanitizedDomainHtml: sanitizedResultHtml,
        originalDomainHtml: originalResultHtml,
    } : null
}

// Based on https://github.com/EFForg/https-everywhere/blob/579b8c59d078fd65d547a546b381c9ae45c61232/chromium/pages/cancel/ux.js
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search)
    const urlValue = params.get('url')
    const domainValue = params.get('domain')
    const rawDomainValue = params.get('rawDomain')

    setI18nContent()
    // Sanitize domain to avoid having it interfere with title, e.g. due to right-to-left override
    document.title = browser.i18n.getMessage('blocked_window_title', createSanitizedDomainForTitle(domainValue))

    const openButton = document.getElementById('open-button')
    openButton.addEventListener('click', () => {
        console.info(`Sending message to open URL with domain ${domainValue}`)

        // Send message to let extension first add domain to cache and then open
        // it (to avoid immediately blocking it again)
        browser.runtime.sendMessage(
            {
                'action': 'open-url',
                'url': urlValue,
                // Use raw domain value to use what the browser originally provided; assuming that
                // all APIs of the browser treat domain consistently
                'domain': rawDomainValue
            }
        ).catch((reason) => {
            console.error(`Failed sending message to open blocked URL ${urlValue}`, reason)
        })
    })

    let revertButtonText
    let revertButtonAction

    if (history.length > 1) {
        revertButtonText = browser.i18n.getMessage('blocked_button_back')
        revertButtonAction = () => history.back()
    } else {
        revertButtonText = browser.i18n.getMessage('blocked_button_close_tab')
        revertButtonAction = () => {
            console.info('Sending message to close blocked page tab')

            // window.close() only seems to work when tab was opened by script
            // Therefore let extension close the tab
            browser.runtime.sendMessage(
                {
                    'action': 'close-tab'
                }
            ).catch((reason) => {
                console.error('Failed sending message to close blocked page tab', reason)
            })
        }
    }

    const revertButton = document.getElementById('revert-button')
    revertButton.textContent = revertButtonText
    revertButton.addEventListener('click', revertButtonAction)

    const domainPlaceholder = document.getElementById('domain-placeholder')
    const highlightedDomainHtmls = createHighlightedDomain(domainValue)

    if (highlightedDomainHtmls === null) {
        domainPlaceholder.textContent = domainValue
    } else {
        // Initially show encoded representation
        domainPlaceholder.innerHTML = highlightedDomainHtmls.sanitizedDomainHtml
        for (const element of document.getElementsByClassName('non-ascii-domain')) {
            // Show warning element
            element.classList.remove('hidden')
        }

        const toggleCheckbox = document.getElementById('original-domain-toggle-checkbox')
        toggleCheckbox.addEventListener('change', event => {
            // @ts-ignore
            const isChecked = event.target.checked === true
            const newHtml = isChecked ? highlightedDomainHtmls.originalDomainHtml : highlightedDomainHtmls.sanitizedDomainHtml
            domainPlaceholder.innerHTML = newHtml
        })
    }
})
