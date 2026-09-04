// Code which is shared between the page content script and the background script

/**
 * Exposes the same functions as `console`, but treats the `message` argument always literally
 * instead of treating substrings like `%d` as "substitution string".
 */
export const safeConsole = {
  // All these functions log the `message` with "%s" and then let the browser log additional
  // args (if any) separately, as described in the `console` documentation
  // This allows using template literals (`... ${...}`) without risking that they include
  // accidental or malicious substitution strings

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  debug: (message: string, ...additionalArgs: any[]) => {
    // eslint-disable-next-line no-console, @typescript-eslint/no-unsafe-argument
    console.debug('%s', message, ...additionalArgs)
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  info: (message: string, ...additionalArgs: any[]) => {
    // eslint-disable-next-line no-console, @typescript-eslint/no-unsafe-argument
    console.info('%s', message, ...additionalArgs)
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warn: (message: string, ...additionalArgs: any[]) => {
    // eslint-disable-next-line no-console, @typescript-eslint/no-unsafe-argument
    console.warn('%s', message, ...additionalArgs)
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  error: (message: string, ...additionalArgs: any[]) => {
    // eslint-disable-next-line no-console, @typescript-eslint/no-unsafe-argument
    console.error('%s', message, ...additionalArgs)
  },
}

/** URL protocols (lowercase, with trailing ':') which are checked by the extension */
export const SUPPORTED_PROTOCOLS = ['http:', 'https:']

type BaseMessage<A extends string> = {
  action: A
  token: string
}
interface BaseMessageWithData<A extends string, D> extends BaseMessage<A> {
  data: D
}

/** Data sent by the content script */
export type MessageData =
  | BaseMessageWithData<'open-url', MessageDataOpenUrl>
  | BaseMessage<'close-tab'>
  | BaseMessage<'check-token'>

/** Data for an 'open-url' message from the content script  */
export type MessageDataOpenUrl = {
  url: string
  domain: string
  /** Whether to open the URL in a new incognito window */
  openIncognito: boolean
}

/** Response to a message from the content script */
export type MessageResponse = 'success' | 'incorrect-token' | 'error'

/** URL parameters used by the 'blocked page' of the extension */
export type ExtPageUrlParams = {
  url: string
  domain: string
  rawDomain: string
  canOpenIncognito: boolean
  token: string
}

// TODO: Can this be implemented in a more type-safe way / without repeating the property names?
//   (but also without potentially breaking when webpack is used)
export function toPageUrlParamsString(params: ExtPageUrlParams): string {
  const urlParams = new URLSearchParams()
  urlParams.append('url', params.url)
  urlParams.append('domain', params.domain)
  urlParams.append('rawDomain', params.rawDomain)
  urlParams.append('canOpenIncognito', params.canOpenIncognito.toString())
  urlParams.append('token', params.token)
  return urlParams.toString()
}

export function fromPageUrlParams(params: URLSearchParams): ExtPageUrlParams {
  return {
    url: params.get('url')!,
    domain: params.get('domain')!,
    rawDomain: params.get('rawDomain')!,
    canOpenIncognito: params.get('canOpenIncognito')! === 'true',
    token: params.get('token')!,
  }
}
