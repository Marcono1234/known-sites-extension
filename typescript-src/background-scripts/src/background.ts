import * as psl from 'psl'
import { LRUCache } from 'lru-cache'
// Use trailing slash to avoid import Node module
import * as punycode from 'punycode/'
import {
  MessageData,
  MessageDataOpenUrl,
  MessageResponse,
  toPageUrlParamsString,
} from '../../common-src/common'

/** URL protocols (lowercase, with trailing ':') which are checked by the extension */
const SUPPORTED_PROTOCOLS = ['http:', 'https:']

const IS_FIREFOX: Promise<boolean> = (
  browser.runtime.getBrowserInfo === undefined
    ? Promise.resolve(false)
    : browser.runtime.getBrowserInfo().then(
        (browserInfo) => {
          const browserName = browserInfo.name
          console.debug(`Browser name: ${browserName}`)
          return browserName.includes('Firefox')
        },
        (error) => {
          console.warn('Failed getting browser info', error)
          return false
        },
      )
).then((isFirefox) => {
  console.debug(`Is browser Firefox: ${isFirefox}`)
  return isFirefox
})

/**
 * Logs a debug message, but only if a debug flag has been set.
 *
 * Should be used for potentially sensitive messages (such as domain name) or verbose
 * messages which should not be logged by default.
 */
function logDebug(message: string, ...args: unknown[]) {
  /*
   * Custom debug flag because even `console.debug` logs everything by default, the
   * browser might just hide the debug messages by default.
   * That could leak information because in the browser when debugging the extension
   * it is possible to see console messages printed before the browser debug mode
   * had been enabled.
   *
   * To set this debug flag, open the debug page for the extension background script,
   * and enter `_KNOWN_SITES_DEBUG = true` in the Console.
   *
   * See also https://stackoverflow.com/q/79540106
   */

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enabled = (window as any)._KNOWN_SITES_DEBUG
  if (enabled === true) {
    console.debug(message, ...args)
  }
}

/**
 * Token used to verify that a message really originated from the extension, and not
 * that a malicious website opened the 'blocked page' with forged URL parameter values.
 *
 * For Firefox the risk for this might be lower because the internal UUID used in
 * the extension page URL seems to be random per installation and is therefore
 * difficult to guess for a malicious website (?). But for Chrome the extension ID
 * used in the URL seems to be the same for all installations.
 */
const TOKEN = Array.from(crypto.getRandomValues(new Uint8Array(20)))
  // convert to hex
  .map((b) => b.toString(16).padStart(2, '0'))
  .join('')

// Disable lint: LRUCache has `{}` as bound
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
class LRUCacheSet<T extends {}> {
  // Cache value does not matter, only key matters
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
/**
 * Additional cache which is only used for incognito windows (because Firefox currently does not support
 * `incognito: split`). For incognito windows both caches are used for lookup but only this cache is used
 * for addition of domains. The cache is (if possible) cleared after all incognito windows are closed.
 */
const incognitoKnownDomainsCache = new LRUCacheSet<string>(200)

browser.windows.onCreated.addListener(async (newWindow) => {
  const isIncognito = newWindow.incognito
  if (isIncognito && !(await IS_FIREFOX)) {
    // Note: This alert dialog is only shown when the user enabled the extension for incognito mode, otherwise
    // the listener is not notified about the newly created incognito window (as desired)
    // Note: `alert` might not work for all browsers, e.g. Firefox shows "alert() is not supported in background windows",
    // but at least in Chrome (where this message is shown) `alert` works
    alert(browser.i18n.getMessage('browser_incognito_unsupported'))
  }
  if (isIncognito) {
    const hasOtherIncognitoWindows = (
      await browser.windows.getAll({ populate: false })
    ).some((window) => window.incognito && window.id !== newWindow.id)

    if (!hasOtherIncognitoWindows) {
      // Acts as fallback in case cache was not cleared properly after last incognito window was closed
      logDebug(
        'Detected first opened incognito window; clearing previous incognito cache',
      )
      incognitoKnownDomainsCache.clear()
    }
  }
})
browser.windows.onRemoved.addListener(async (windowId) => {
  const hasIncognitoWindow = (
    await browser.windows.getAll({ populate: false })
  ).some((window) => window.incognito && window.id !== windowId)

  if (!hasIncognitoWindow) {
    logDebug('No incognito window is open anymore; clearing incognito cache')
    incognitoKnownDomainsCache.clear()
  }
})

browser.webRequest.onBeforeRequest.addListener(
  handleRequest,
  {
    // Don't use <all_urls> because for Chrome that also includes the extension page
    urls: SUPPORTED_PROTOCOLS.map((protocol) => {
      // Match 'any host' with 'any path', see https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Match_patterns
      return `${protocol}//*/*`
    }),
    // Only check top-level documents but not embedded content such as `<iframe>`, assuming that if
    // site is trusted it does not embed untrusted content
    // Embedded content cannot be blocked properly anyway because the extension page would replace
    // the complete top-level document
    types: ['main_frame'],
  },
  ['blocking'],
)

// Update cache when items were removed from browser history
browser.history.onVisitRemoved.addListener((removed) => {
  if (removed.allHistory) {
    logDebug('Clearing known domains cache after history was cleared')
    knownDomainsCache.clear()
  } else {
    // Remove from cache, even if there are other history entries for domain remaining:
    // in that case next time domain is opened, it will be found in history and added to cache again
    logDebug('Removing domains from cache after history removal')
    removed.urls.forEach((url) => {
      const domain = parseDomain(url, true)
      if (domain !== null) {
        knownDomainsCache.remove(domain)
      }
    })
  }
})

// Handle messages from blocking pages
browser.runtime.onMessage.addListener(
  async (message: MessageData, sender): Promise<MessageResponse> => {
    console.debug(`Received '${message.action}' message`)

    const tabId = sender.tab?.id
    if (tabId === undefined) {
      console.error('Failed to get tab ID', sender)
      return 'error'
    }

    const token = message.token
    if (token !== TOKEN) {
      console.error(
        `Received incorrect token, expected ${TOKEN}`,
        message,
        sender,
      )
      return 'incorrect-token'
    }

    const action = message.action

    if (action === 'check-token') {
      // Token check already occurred above
      return 'success'
    } else if (action === 'open-url') {
      return onOpenUrlMessage(tabId, message.data)
    } else if (action === 'close-tab') {
      browser.tabs
        .remove(tabId)
        .catch((error) => console.error('Failed closing tab', error))
    } else {
      action satisfies never // ensure that if-else is exhaustive
      console.error(`Unknown message action: ${action}`, message, sender)
      return 'error'
    }

    return 'success'
  },
)

async function onOpenUrlMessage(
  tabId: number,
  messageData: MessageDataOpenUrl,
): Promise<MessageResponse> {
  const url = messageData.url
  const domain = messageData.domain
  const isIncognito = messageData.isIncognito

  ;(isIncognito ? incognitoKnownDomainsCache : knownDomainsCache).add(domain)

  const updateProperties: browser.tabs._UpdateUpdateProperties =
    (await IS_FIREFOX)
      ? {
          // Replace the extension tab
          loadReplace: true,
          url: url,
        }
      : {
          // Chrome does not support loadReplace, see https://github.com/mdn/browser-compat-data/issues/15412
          url: url,
        }

  browser.tabs.update(tabId, updateProperties).catch((error) => {
    console.error(`Failed opening URL ${url}`, error)
  })
  return 'success'
}

function parseDomain(url: string, ignoreUnsupportedProtocol: false): string
function parseDomain(
  url: string,
  ignoreUnsupportedProtocol: true,
): string | null
function parseDomain(
  url: string,
  ignoreUnsupportedProtocol: boolean,
): string | null {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch (typeError) {
    console.error(`Failed parsing URL ${url}`, typeError)
    // Fall back to using complete URL as domain
    return url
  }

  const protocol = parsedUrl.protocol.toLowerCase()
  if (!SUPPORTED_PROTOCOLS.includes(protocol)) {
    if (ignoreUnsupportedProtocol) {
      logDebug(`URL has unsupported protocol '${protocol}'`, url)
      return null
    } else {
      // Should normally not happen; if unsupported protocol is expected to occur, then
      // caller should have set `ignoreUnsupportedProtocol = true`
      console.error(`URL has unsupported protocol '${protocol}'`, url)
      // Fall back to using complete URL as domain
      return url
    }
  }

  const hostname = parsedUrl.hostname
  if (hostname === '') {
    console.error(`URL ${url} has no hostname`)
    // Fall back to using complete URL as domain
    return url
  }

  // psl.get(string) does not properly handle IP addresses, see https://github.com/lupomontero/psl/issues/29
  // therefore check for them here
  // Match anything which looks like an IPv4 or IPv6 address
  const ipAddressRegex = /^(\d+\.\d+\.\d+\.\d+|\[[\d:]+\])$/
  if (ipAddressRegex.test(hostname)) {
    logDebug(`Detected hostname ${hostname} to be an IP address`)
    return hostname
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
  let origin: string
  try {
    origin = new URL(url).origin
  } catch (typeError) {
    console.error(`Failed parsing URL ${url}`, typeError)
    // Fall back to using complete URL as origin
    return url
  }
  // 'null' is used as "opaque origin", see https://html.spec.whatwg.org/multipage/origin.html#concept-origin-opaque
  if (origin === '' || origin === 'null') {
    console.error(`URL ${url} has no origin`)
    // Fall back to using complete URL as origin
    return url
  }
  return origin
}

function matchesHistoryItem(
  historyItem: browser.history.HistoryItem,
  url: string,
  domain: string,
): boolean {
  const historyUrl = historyItem.url

  if (historyUrl === url) {
    return true
  } else if (historyUrl !== undefined) {
    return parseDomain(historyUrl, true) === domain
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
  domain: string,
): Promise<boolean> {
  const bookmarks = browser.bookmarks.search({
    query: queryString,
  })
  return (await bookmarks).some((bookmark) => {
    const url = bookmark.url
    return url !== undefined && parseDomain(url, true) === domain
  })
}

async function isBookmarkedSite(
  url: string,
  origin: string,
  domain: string,
): Promise<boolean> {
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
async function isKnownSite(
  url: string,
  domain: string,
  isIncognito: boolean,
): Promise<boolean> {
  if (knownDomainsCache.contains(domain)) {
    logDebug(`Found domain ${domain} in known domains cache`)
    return true
  }
  if (isIncognito && incognitoKnownDomainsCache.contains(domain)) {
    logDebug(`Found domain ${domain} in incognito known domains cache`)
    return true
  }

  const origin = parseOrigin(url)

  async function isKnownSiteFromBrowserData(): Promise<boolean> {
    if ((await hasVisits(url)) || (await hasVisits(origin))) {
      logDebug(`Found visits in history for domain ${domain}`)
      return true
    }

    // Did not find exact match in history; try history search
    logDebug(`Did not find visit for domain ${domain}; trying history search`)
    let historyItems = await browser.history.search({
      text: origin,
      // Get matching items from any point in the past
      startTime: 0,
      maxResults: 100,
    })

    if (historyItems.some((item) => matchesHistoryItem(item, url, domain))) {
      logDebug(`Found match in history search results for domain ${domain}`)
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
      logDebug(`Found match in history search results for domain ${domain}`)
      return true
    }

    logDebug(
      `Did not find history entry for domain ${domain}; trying bookmark search`,
    )
    if (await isBookmarkedSite(url, origin, domain)) {
      logDebug(`Found matching bookmark for domain ${domain}`)
      return true
    }

    return false
  }

  const timeStart = performance.now()
  const isKnown = await isKnownSiteFromBrowserData()
  const millisNeeded = performance.now() - timeStart
  logDebug(`Lookup from browser data took ${millisNeeded}ms`)

  if (isKnown) {
    // Add domain to cache
    ;(isIncognito ? incognitoKnownDomainsCache : knownDomainsCache).add(domain)
    return true
  } else {
    return false
  }
}

async function handleRequest(
  requestDetails: browser.webRequest._OnBeforeSendHeadersDetails,
): Promise<browser.webRequest.BlockingResponse> {
  const url = requestDetails.url
  // Note: `incognito` is only supported by Firefox currently, but not other browsers, see
  // https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/onBeforeRequest#browser_compatibility
  const isIncognito = requestDetails.incognito === true
  logDebug(`Handling ${isIncognito ? 'incognito ' : ''}request for ${url}`)

  // Firefox already seems to provide this in punycode
  const rawDomain = parseDomain(url, false)
  let nonPunycodeDomain: string
  try {
    nonPunycodeDomain = punycode.toUnicode(rawDomain)
  } catch (e) {
    console.error(`Punycode conversion failed for domain ${rawDomain}`, e)
    // If conversion failed; domain might be malformed and handling of it might be
    // browser specific; to be safe cancel loading
    return { cancel: true }
  }

  if (await isKnownSite(url, rawDomain, isIncognito)) {
    logDebug(`Allowing access to known domain ${rawDomain}`)
    return {}
  } else {
    logDebug(`Blocking unknown domain ${rawDomain}`)
    const urlParams = toPageUrlParamsString({
      url: url,
      domain: nonPunycodeDomain,
      rawDomain: rawDomain,
      isIncognito: isIncognito,
      token: TOKEN,
    })
    const blockingPageUrl = browser.runtime.getURL(
      `pages/blocked-unknown.html?${urlParams}`,
    )

    // Cannot return blocking page URL in `redirectUrl` because Firefox already records original URL in history
    // As (hacky?) workaround instead load the blocking page manually
    browser.tabs
      .update(requestDetails.tabId, {
        url: blockingPageUrl,
      })
      .catch((error) => {
        console.error(`Failed opening blocking page ${blockingPageUrl}`, error)
      })

    return {
      cancel: true,
    }
  }
}
