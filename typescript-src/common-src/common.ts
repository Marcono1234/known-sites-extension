// Code which is shared between the page content script and the background script

/** Data sent by the content script */
export type MessageData =
  | { action: 'open-url'; url: string; domain: string; isIncognito: boolean }
  | { action: 'close-tab' }

/** URL parameters used by the 'blocked page' of the extension */
export type ExtPageUrlParams = {
  url: string
  domain: string
  rawDomain: string
  isIncognito: boolean
}

// TODO: Can this be implemented in a more type-safe way / without repeating the property names?
//   (but also without potentially breaking when webpack is used)
export function toPageUrlParamsString(params: ExtPageUrlParams): string {
  const urlParams = new URLSearchParams()
  urlParams.append('url', params.url)
  urlParams.append('domain', params.domain)
  urlParams.append('rawDomain', params.rawDomain)
  urlParams.append('isIncognito', params.isIncognito.toString())
  return urlParams.toString()
}

export function fromPageUrlParams(params: URLSearchParams): ExtPageUrlParams {
  return {
    url: params.get('url')!,
    domain: params.get('domain')!,
    rawDomain: params.get('rawDomain')!,
    isIncognito: params.get('isIncognito')! === 'true',
  }
}
