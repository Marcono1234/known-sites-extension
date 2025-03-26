// Code which is shared between the page content script and the background script

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
  isIncognito: boolean
}

/** Response to a message from the content script */
export type MessageResponse = 'success' | 'incorrect-token' | 'error'

/** URL parameters used by the 'blocked page' of the extension */
export type ExtPageUrlParams = {
  url: string
  domain: string
  rawDomain: string
  isIncognito: boolean
  token: string
}

// TODO: Can this be implemented in a more type-safe way / without repeating the property names?
//   (but also without potentially breaking when webpack is used)
export function toPageUrlParamsString(params: ExtPageUrlParams): string {
  const urlParams = new URLSearchParams()
  urlParams.append('url', params.url)
  urlParams.append('domain', params.domain)
  urlParams.append('rawDomain', params.rawDomain)
  urlParams.append('isIncognito', params.isIncognito.toString())
  urlParams.append('token', params.token)
  return urlParams.toString()
}

export function fromPageUrlParams(params: URLSearchParams): ExtPageUrlParams {
  return {
    url: params.get('url')!,
    domain: params.get('domain')!,
    rawDomain: params.get('rawDomain')!,
    isIncognito: params.get('isIncognito')! === 'true',
    token: params.get('token')!,
  }
}
