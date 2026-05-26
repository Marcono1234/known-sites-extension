import { expect, browser } from '@wdio/globals'
import { describe } from 'mocha'

import { blockedPage, runAsExtension } from '../src/test-helper.ts'

async function addHistoryEntry(
  url: string,
  title: string | undefined = undefined,
) {
  await runAsExtension(async () => {
    await browser.execute(
      async (url, title) => {
        if (title) {
          // @ts-expect-error: does not know about web-extension types
          browser.history.addUrl({ url: url, title: title })
        } else {
          // @ts-expect-error: does not know about web-extension types
          browser.history.addUrl({ url: url })
        }
      },
      url,
      title,
    )
  })
}

async function removeHistoryEntry(url: string) {
  await runAsExtension(async () => {
    await browser.execute(async (url) => {
      // @ts-expect-error: does not know about web-extension types
      await browser.history.deleteUrl({ url: url })
    }, url)
  })
}

/** Returns an array of URLs whose history entries match the given text  */
async function getHistoryEntries(text: string): Promise<string[]> {
  return await runAsExtension(
    async () =>
      await browser.execute(async (text) => {
        // @ts-expect-error: does not know about web-extension types
        const entries = await browser.history.search({ text: text })
        // @ts-expect-error: does not know about web-extension types
        return entries.map((e) => e.url)
      }, text),
  )
}

describe('browser history', () => {
  it('regular entry', async () => {
    await addHistoryEntry('https://example-regular.invalid/somesubpage')

    // Should not be blocked since it was in history
    await browser.url('https://example-regular.invalid')
    await expect(browser).toHaveUrl('https://example-regular.invalid/')

    // Should consider other domain still as unknown
    await browser.url('https://example-other.invalid')
    await blockedPage.expectBlockedPage('example-other.invalid', 'back')
  })

  // Note: Assumes that there is no PSL entry for the tested domains
  it('subdomain entry', async () => {
    await addHistoryEntry('https://first.example-sub.invalid')

    // Should not be blocked since parent domain is in history
    await browser.url('https://second.example-sub.invalid/path')
    await expect(browser).toHaveUrl('https://second.example-sub.invalid/path')

    // Should consider other domain still as unknown
    await browser.url('https://example-other.invalid')
    await blockedPage.expectBlockedPage('example-other.invalid', 'back')
  })

  it('ignore title and URL path', async () => {
    const otherDomain = 'example-other.invalid'
    const otherUrl = 'https://' + otherDomain
    // Add a history entry whose URL path and title contain another domain (which should be ignored by the extension)
    await addHistoryEntry(
      `https://example-title.invalid/${otherDomain}/${encodeURIComponent(otherUrl)}`,
      `${otherDomain} ${otherUrl}`,
    )

    await browser.url('https://example-title.invalid/path')
    await expect(browser).toHaveUrl('https://example-title.invalid/path')

    // Should consider other domain still as unknown
    await browser.url(otherUrl)
    await blockedPage.expectBlockedPage(otherDomain, 'back')
  })

  it('handle history removal', async () => {
    const domain = 'history-remove.invalid'
    const url1 = `https://${domain}/first`
    const url2 = `https://${domain}/second`
    await addHistoryEntry(url1)
    await addHistoryEntry(url2)

    // Should not be blocked since it was in history
    await browser.url(url1)
    await expect(browser).toHaveUrl(url1)

    await removeHistoryEntry(url1)
    // Should still not be blocked since `url2` with same domain is still in history
    await browser.url(url1)
    await expect(browser).toHaveUrl(url1)

    await removeHistoryEntry(url2)
    // Should be blocked now since all history entries for domain were removed
    await browser.url(url1)
    await blockedPage.expectBlockedPage(domain, 'back')

    await browser.url(url2)
    await blockedPage.expectBlockedPage(domain, 'back')
  })

  // TODO: skipped because webdriver apparently does not record history entries
  //   (only lists those which were manually added to history)
  it.skip('no history entry when not opening', async () => {
    const domain = 'not-opened.invalid'
    const url = `https://${domain}`
    await browser.url(url)
    await blockedPage.expectBlockedPage(domain)
    let historyEntries = await getHistoryEntries(domain)
    // Should not be contained in history
    if (historyEntries.length !== 0) {
      throw new Error(`unexpected history entries: ${historyEntries}`)
    }

    await blockedPage.buttonOpen().click()
    // Should have opened blocked URL
    await expect(browser).toHaveUrl(`https://${domain}/`)

    historyEntries = await getHistoryEntries(domain)
    // History should contain URL now
    if (historyEntries.length !== 1 || !historyEntries.includes(url)) {
      throw new Error(`unexpected history entries: ${historyEntries}`)
    }
  })
})
