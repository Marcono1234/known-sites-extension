import { expect, browser } from '@wdio/globals'
import { describe } from 'mocha'

import { blockedPage } from '../src/test-helper.ts'

// Delegates to the test helper function, but has reordered parameters because most tests here
// use the default `revertButton` value (and would have to redundantly specify it all the time otherwise)
async function expectBlockedPage(
  domainText: string,
  nonAsciiDomainPieces: blockedPage.DisplayedDomainPiece[] | null = null,
  nonAsciiToggled: boolean = false,
  revertButton: 'close' | 'back' = 'close',
) {
  await blockedPage.expectBlockedPage(
    domainText,
    revertButton,
    nonAsciiDomainPieces,
    nonAsciiToggled,
  )
}

describe('non-ASCII', () => {
  it('display, prefix', async () => {
    await browser.url('https://ä-display.invalid')
    await expectBlockedPage('?-display.invalid', [
      { type: 'highlighted', s: '?' },
      { type: 'literal', s: '-display.invalid' },
    ])
  })

  it('display, suffix', async () => {
    await browser.url('https://display-ä.invalid')
    await expectBlockedPage('display-?.invalid', [
      { type: 'literal', s: 'display-' },
      { type: 'highlighted', s: '?' },
      { type: 'literal', s: '.invalid' },
    ])
  })

  it('display, middle', async () => {
    await browser.url('https://display-ä-middle.invalid')
    await expectBlockedPage('display-?-middle.invalid', [
      { type: 'literal', s: 'display-' },
      { type: 'highlighted', s: '?' },
      { type: 'literal', s: '-middle.invalid' },
    ])
  })

  it('display, multiple', async () => {
    await browser.url('https://ä-display-öü-multiple-äüö-aäuüoö.invalid')
    await expectBlockedPage('?-display-??-multiple-???-a?u?o?.invalid', [
      { type: 'highlighted', s: '?' },
      { type: 'literal', s: '-display-' },
      { type: 'highlighted', s: '??' },
      { type: 'literal', s: '-multiple-' },
      { type: 'highlighted', s: '???' },
      { type: 'literal', s: '-a' },
      { type: 'highlighted', s: '?' },
      { type: 'literal', s: 'u' },
      { type: 'highlighted', s: '?' },
      { type: 'literal', s: 'o' },
      { type: 'highlighted', s: '?' },
      { type: 'literal', s: '.invalid' },
    ])
  })

  it('punycode', async () => {
    // domain 'punycode-ä.invalid'
    await browser.url('xn--punycode--32a.invalid')
    await expectBlockedPage('punycode-?.invalid', [
      { type: 'literal', s: 'punycode-' },
      { type: 'highlighted', s: '?' },
      { type: 'literal', s: '.invalid' },
    ])
  })

  it('long domain', async () => {
    let domain = `${'abäü'.repeat(20)}.invalid`
    await browser.url(`https://${domain}`)

    // TODO: Ideally would also check `expectBlockedPage(...)`, but it seems webdriver's `toHaveText(...)` somehow drops
    // the truncated `<span>` elements containing the highlighted '?', so instead of "ab??" repeated, the actual text
    // is erroneously (?) something like "ababab...ab??ab??" (note the missing '?' at the beginning)
    const size1 = await blockedPage.displayedDomainElement().getSize()

    domain = `${'abäü'.repeat(50)}.invalid`
    await browser.url(`https://${domain}`)

    // TODO: Ideally would also check `expectBlockedPage(...)`, see TODO above
    const size2 = await blockedPage.displayedDomainElement().getSize()

    // Verify that domain text was not wrapped into multiple lines
    expect(size1.height).toBe(size2.height)

    // Verify that domain text was truncated
    // TODO: Does not work; apparently this is the non-truncated width
    // expect(size1.width).toBe(size2.width)

    // Also check domain which is only non-ASCII, with no ASCII interspersed
    domain = `${'äü'.repeat(50)}.invalid`
    await browser.url(`https://${domain}`)

    await expectBlockedPage(
      domain.replace(/[äü]/g, '?'),
      [
        {
          type: 'highlighted',
          s: '?'.repeat(50 * 2),
        },
        {
          type: 'literal',
          s: '.invalid',
        },
      ],
      false,
      'back',
    )
    const size3 = await blockedPage.displayedDomainElement().getSize()

    // Verify that domain text was not wrapped into multiple lines
    expect(size1.height).toBe(size3.height)

    // Verify that domain text was truncated
    // TODO: Does not work; apparently this is the non-truncated width
    // expect(size1.width).toBe(size3.width)
  })

  it('functionality', async () => {
    await browser.url('https://open-first-ä-other-öü.invalid')
    await expectBlockedPage('open-first-?-other-??.invalid', [
      { type: 'literal', s: 'open-first-' },
      { type: 'highlighted', s: '?' },
      { type: 'literal', s: '-other-' },
      { type: 'highlighted', s: '??' },
      { type: 'literal', s: '.invalid' },
    ])

    await blockedPage.checkboxLabelToggleAscii().click()
    // Domain in tab title should still have '?', but domain displayed on page will show the non-ASCII chars
    await expectBlockedPage(
      'open-first-?-other-??.invalid',
      [
        { type: 'literal', s: 'open-first-' },
        { type: 'highlighted', s: 'ä' },
        { type: 'literal', s: '-other-' },
        { type: 'highlighted', s: 'öü' },
        { type: 'literal', s: '.invalid' },
      ],
      true, // checkbox should be selected now
    )

    // Disable non-ASCII chars again
    await blockedPage.checkboxLabelToggleAscii().click()
    await expectBlockedPage(
      'open-first-?-other-??.invalid',
      [
        { type: 'literal', s: 'open-first-' },
        { type: 'highlighted', s: '?' },
        { type: 'literal', s: '-other-' },
        { type: 'highlighted', s: '??' },
        { type: 'literal', s: '.invalid' },
      ],
      false, // checkbox should be unselected again
    )

    // Enable non-ASCII chars again
    await blockedPage.checkboxLabelToggleAscii().click()
    // Domain in tab title should still have '?', but domain displayed on page will show the non-ASCII chars
    await expectBlockedPage(
      'open-first-?-other-??.invalid',
      [
        { type: 'literal', s: 'open-first-' },
        { type: 'highlighted', s: 'ä' },
        { type: 'literal', s: '-other-' },
        { type: 'highlighted', s: 'öü' },
        { type: 'literal', s: '.invalid' },
      ],
      true, // checkbox should be selected again
    )

    await blockedPage.buttonOpen().click()
    await expect(browser).toHaveUrl(
      // Browser apparently reports URL in punycode encoding
      'https://xn--open-first--other--vtb18age.invalid/',
    )

    // Domain should not be blocked anymore
    await browser.url('https://open-first-ä-other-öü.invalid')
    await expect(browser).toHaveUrl(
      // Browser apparently reports URL in punycode encoding
      'https://xn--open-first--other--vtb18age.invalid/',
    )

    // Try opening other domain, this time without toggling non-ASCII before opening
    await browser.url('https://open-second-äöü.invalid')
    await expectBlockedPage(
      'open-second-???.invalid',
      [
        { type: 'literal', s: 'open-second-' },
        { type: 'highlighted', s: '???' },
        { type: 'literal', s: '.invalid' },
      ],
      false, // checkbox should be unselected again
      'back',
    )

    await blockedPage.buttonOpen().click()
    await expect(browser).toHaveUrl(
      // Browser apparently reports URL in punycode encoding
      'https://xn--open-second--rcb6w8c.invalid/',
    )
  })
})
