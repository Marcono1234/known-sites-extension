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

    setI18nContent('', (element, message) => element.textContent = message)
    setI18nContent('html', (element, message) => element.innerHTML = message)
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
 * @property {string} encodedDomainHtml
 * @property {string} decodedDomainHtml
 * 
 * @param {string} domain 
 * @returns {?HighlightResult}
 */
function createHighlightedDomain(domain) {
    let encodedResultHtml = ''
    let decodedResultHtml = ''
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
            encodedResultHtml += toAdd
            decodedResultHtml += toAdd

            wasLastNonAscii = false
        } else {
            hasNonAscii = true
            const prefix = (wasLastNonAscii ? '' : '<span class="non-ascii-char">')
            encodedResultHtml += prefix + '?'
            decodedResultHtml += prefix + escapedChar

            wasLastNonAscii = true
        }
    }

    if (wasLastNonAscii) {
        const toAdd = '</span>'
        encodedResultHtml += toAdd
        decodedResultHtml += toAdd
    }

    return hasNonAscii ? {
        encodedDomainHtml: encodedResultHtml,
        decodedDomainHtml: decodedResultHtml,
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
        )
    })

    let revertButtonText
    let revertButtonAction

    if (history.length > 1) {
        revertButtonText = browser.i18n.getMessage('blocked_button_back')
        revertButtonAction = () => history.back()
    } else {
        revertButtonText = browser.i18n.getMessage('blocked_button_close_tab')
        revertButtonAction = () => {
            // window.close() only seems to work when tab was opened by script
            // Therefore let extension close the tab
            browser.runtime.sendMessage(
                {
                    'action': 'close-tab'
                }
            )
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
        domainPlaceholder.innerHTML = highlightedDomainHtmls.encodedDomainHtml
        for (const element of document.getElementsByClassName('non-ascii-domain')) {
            // Show warning element
            element.classList.remove('hidden')
        }

        const toggleCheckbox = document.getElementById('original-domain-toggle-checkbox')
        toggleCheckbox.addEventListener('change', event => {
            // @ts-ignore
            let newHtml = event.target.checked === true ? highlightedDomainHtmls.decodedDomainHtml : highlightedDomainHtmls.encodedDomainHtml
            domainPlaceholder.innerHTML = newHtml
        })
    }
})
