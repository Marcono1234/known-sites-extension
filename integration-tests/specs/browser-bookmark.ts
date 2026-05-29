import { expect, browser } from '@wdio/globals'
import { describe } from 'mocha'

import { blockedPage, runAsExtension } from '../src/test-helper.ts'

async function addBookmarkEntry(
  url: string,
  title: string | undefined = undefined,
) {
  await runAsExtension(async () => {
    await browser.execute(
      async (url, title) => {
        const args = {
          url,
          title,
        }
        // @ts-expect-error: does not know about web-extension types
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await browser.bookmarks.create(args)
      },
      url,
      title,
    )
  })
}

describe('browser bookmark', () => {
  it('regular entry', async () => {
    await addBookmarkEntry('https://example-regular.invalid/somesubpage')

    // Should not be blocked since it was in history
    await browser.url('https://example-regular.invalid')
    await expect(browser).toHaveUrl('https://example-regular.invalid/')

    // Should consider other domain still as unknown
    await browser.url('https://example-other.invalid')
    await blockedPage.expectBlockedPage('example-other.invalid', 'back')
  })

  // Note: Assumes that there is no PSL entry for the tested domains
  it('subdomain entry', async () => {
    await addBookmarkEntry('https://first.example-sub.invalid')

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
    // Add a bookmark entry whose URL path and title contain another domain (which should be ignored by the extension)
    await addBookmarkEntry(
      `https://example-title.invalid/${otherDomain}/${encodeURIComponent(otherUrl)}`,
      `${otherDomain} ${otherUrl}`,
    )

    await browser.url('https://example-title.invalid/path')
    await expect(browser).toHaveUrl('https://example-title.invalid/path')

    // Should consider other domain still as unknown
    await browser.url(otherUrl)
    await blockedPage.expectBlockedPage(otherDomain, 'back')
  })
})
