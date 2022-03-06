"use strict;"

// Based on https://github.com/EFForg/https-everywhere/blob/579b8c59d078fd65d547a546b381c9ae45c61232/chromium/pages/cancel/ux.js

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search)
    const urlValue = params.get('url')
    const domainValue = params.get('domain')
    const punycodeDomainValue = params.get('punycodeDomain')
    const rawDomainValue = params.get('rawDomain')

    document.title = `Blocked - ${domainValue}`

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
        revertButtonText = 'Go back'
        revertButtonAction = () => history.back()
    } else {
        revertButtonText = 'Close tab'
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
    domainPlaceholder.textContent = punycodeDomainValue

    if (domainValue !== punycodeDomainValue) {
        for (const element of document.getElementsByClassName('punycode-difference')) {
            // Show warning element
            element.classList.remove('hidden')
        }

        const toggleCheckbox = document.getElementById('decoded-domain-checkbox')
        toggleCheckbox.addEventListener('change', event => {
            // @ts-ignore
            let newText = event.target.checked === true ? domainValue : punycodeDomainValue
            domainPlaceholder.textContent = newText
        })
    }
})
