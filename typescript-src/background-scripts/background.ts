import * as psl from 'psl'
import * as LRUCache from 'lru-cache'
// Use trailing slash to avoid import Node module
import * as punycode from 'punycode/'
import HistoryItem = browser.history.HistoryItem

class LRUCacheSet<T> {
  // Cache value does not matter, only key matter
  private readonly cache: LRUCache<T, any>

  constructor(maxSize: number) {
    this.cache = new LRUCache({
      max: maxSize,
    })
  }

  public contains(item: T): boolean {
    // Use get(...) instead of has(...) to update entry
    return this.cache.get(item) !== undefined
  }

  public add(item: T) {
    this.cache.set(item, true)
  }

  public remove(item: T) {
    this.cache.delete(item)
  }

  public clear() {
    this.cache.clear()
  }
}

const knownDomainsCache = new LRUCacheSet<string>(200)

browser.webRequest.onBeforeRequest.addListener(
  handleRequest,
  { urls: ['<all_urls>'], types: ['main_frame'] },
  ['blocking']
)

// Update cache when items were removed from browser history
browser.history.onVisitRemoved.addListener((removed) => {
  if (removed.allHistory) {
    console.info('Clearing known domains cache after history was cleared')
    knownDomainsCache.clear()
  } else {
    const removedDomains = new Set<string>()
    removed.urls.forEach((url) => {
      const domain = parseDomain(url)

      // Avoid duplicate log messages in case multiple URLs of same domain are removed
      if (!removedDomains.has(domain)) {
        removedDomains.add(domain)
        console.info(
          `Removing domain ${domain} from cache after history removal`
        )
        knownDomainsCache.remove(domain)
      }
    })
  }
})

// Matches the data sent by the content script
type MessageData =
  | { action: 'open-url'; url: string; domain: string }
  | { action: 'close-tab' }

// Handle messages from blocking pages
browser.runtime.onMessage.addListener((message: MessageData, sender) => {
  console.debug('Received message', message, sender)

  const tabId = sender.tab?.id
  if (tabId === undefined) {
    console.error('Failed to get tab ID')
    return
  }

  if (message.action === 'open-url') {
    const url: string = message.url
    const domain: string = message.domain

    console.info(`Received message to open URL from domain ${domain}`)
    knownDomainsCache.add(domain)

    browser.tabs
      .update(tabId, {
        // Replace the extension tab
        loadReplace: true,
        url: url,
      })
      .catch((reason) => {
        console.error(`Failed opening URL ${url}`, reason)
      })
  } else {
    console.info('Received message to close tab')
    browser.tabs
      .remove(tabId)
      .catch((reason) => console.error('Failed closing tab', reason))
  }
})

function parseDomain(url: string): string {
  let hostname
  try {
    hostname = new URL(url).hostname
  } catch (typeError) {
    console.error(`Failed parsing URL ${url}`, typeError)
    // Fall back to using complete URL as domain
    return url
  }
  if (hostname === '') {
    console.error(`URL ${url} has no hostname`)
    // Fall back to using complete URL as domain
    return url
  }

  const pslDomain = psl.get(hostname)

  if (pslDomain === null) {
    return hostname
  }
  // Sanity check to verify that PSL domain matches hostname
  else if (pslDomain === hostname || hostname.endsWith('.' + pslDomain)) {
    return pslDomain
  } else {
    console.warn(`PSL domain ${pslDomain} does not match hostname ${hostname}`)
    return hostname
  }
}

function parseOrigin(url: string): string {
  return new URL(url).origin
}

function matchesHistoryItem(
  historyItem: HistoryItem,
  url: string,
  domain: string
): boolean {
  const historyUrl = historyItem.url

  if (historyUrl === url) {
    return true
  } else if (historyUrl !== undefined) {
    return parseDomain(historyUrl) === domain
  } else {
    return false
  }
}

async function hasExactBookmarkUrlMatch(url: string): Promise<boolean> {
  const bookmarks = browser.bookmarks.search({
    url: url,
  })
  return (await bookmarks).length > 0
}

async function hasQueryBookmarkUrlMatch(
  queryString: string,
  domain: string
): Promise<boolean> {
  const bookmarks = browser.bookmarks.search({
    query: queryString,
  })
  return (await bookmarks).some((bookmark) => {
    const url = bookmark.url
    return url !== undefined && parseDomain(url) === domain
  })
}

async function isBookmarkedSite(url: string, domain: string): Promise<boolean> {
  const origin = parseOrigin(url)

  return (
    (await hasExactBookmarkUrlMatch(url)) ||
    (await hasExactBookmarkUrlMatch(origin)) ||
    // Fall back to query string search
    (await hasQueryBookmarkUrlMatch(origin, domain)) ||
    (await hasQueryBookmarkUrlMatch(domain, domain))
  )
}

async function hasVisits(url: string): Promise<boolean> {
  const visits = await browser.history.getVisits({
    url: url,
  })
  return visits.length > 0
}

/**
 * Checks if the URL or its domain (if present) is known, by looking it up in the known domains cache
 * and the browser history.
 * If a match is found, `true` is returned and (if necessary) the known domains cache is adjusted.
 */
async function isKnownSite(url: string, domain: string): Promise<boolean> {
  if (knownDomainsCache.contains(domain)) {
    console.info(`Found domain ${domain} in known domains cache`)
    return true
  }

  const origin = parseOrigin(url)

  if ((await hasVisits(url)) || (await hasVisits(origin))) {
    console.info(`Found visits in history for domain ${domain}`)
    knownDomainsCache.add(domain)
    return true
  }

  // Did not find exact match in history; try history search
  console.info(`Did not find visit for domain ${domain}; trying history search`)
  let historyItems = await browser.history.search({
    text: origin,
    // Get matching items from any point in the past
    startTime: 0,
    maxResults: 100,
  })

  if (historyItems.some((item) => matchesHistoryItem(item, url, domain))) {
    console.info(`Found match in history search results for domain ${domain}`)
    knownDomainsCache.add(domain)
    return true
  }

  // Fall back to domain search
  historyItems = await browser.history.search({
    text: domain,
    // Get matching items from any point in the past
    startTime: 0,
    maxResults: 100,
  })

  if (historyItems.some((item) => matchesHistoryItem(item, url, domain))) {
    console.info(`Found match in history search results for domain ${domain}`)
    knownDomainsCache.add(domain)
    return true
  }

  console.info(
    `Did not find history entry for domain ${domain}; trying bookmark search`
  )
  if (await isBookmarkedSite(url, domain)) {
    console.info(`Found matching bookmark for domain ${domain}`)
    knownDomainsCache.add(domain)
    return true
  }

  return false
}

async function handleRequest(
  requestDetails: browser.webRequest._OnBeforeSendHeadersDetails
): Promise<browser.webRequest.BlockingResponse> {
  const url = requestDetails.url
  console.debug(`Handling request for ${url}`)

  // Firefox already seems to provide this in punycode
  const rawDomain = parseDomain(url)
  let nonPunycodeDomain: string
  try {
    nonPunycodeDomain = punycode.toUnicode(rawDomain)
  } catch (e) {
    console.error(`Punycode conversion failed for domain ${rawDomain}`, e)
    // If conversion failed; domain might be malformed and handling of it might be
    // browser specific; to be safe cancel loading
    return { cancel: true }
  }

  if (await isKnownSite(url, rawDomain)) {
    console.info(`Allowing access to known domain ${rawDomain}`)
    return {}
  } else {
    console.info(`Blocking unknown domain ${rawDomain}`)
    const blockingPageUrl = browser.runtime.getURL(
      // prettier-ignore
      `pages/blocked-unknown.html?url=${encodeURIComponent(url)}&domain=${encodeURIComponent(nonPunycodeDomain)}&rawDomain=${rawDomain}`
    )

    // Cannot return blocking page URL in `redirectUrl` because Firefox already records original URL in history
    // As (hacky?) workaround instead load the blocking page manually
    browser.tabs
      .update(requestDetails.tabId, {
        url: blockingPageUrl,
      })
      .catch((reason) => {
        console.error(`Failed opening blocking page ${url}`, reason)
      })

    return {
      cancel: true,
    }
  }
}
