import { Err, Ok, Result } from '@celo/base/lib/result'
import 'cross-fetch'
import { isRight } from 'fp-ts/Either'

import { Action } from './actions'
import {
  FetchError,
  FetchErrorTypes,
  NetworkError,
  RequestError,
  ResponseDecodeError,
  ServiceUnavailable,
  Unauthorised,
  UnexpectedStatus,
} from './errors'
import { retry } from './retry'

const TAG = 'KomenciClient'

export class KomenciClient {
  private token: string | undefined
  private readonly url: string

  constructor(url: string) {
    // Ensure trailing slash
    this.url = url.replace(/\/$/, '') + '/'
  }

  setToken(token: string) {
    this.token = token
  }

  @retry({
    tries: 3,
    bailOnErrorTypes: [FetchErrorTypes.Unauthorised, FetchErrorTypes.RequestError],
    onRetry: (args, error, attempt) => {
      const action = args[0] as Action<any, any, any>
      console.debug(`${TAG}/exec:${action.action} attempt#${attempt} error: `, error)
    },
  })
  async exec<TAction, TPayload, TResp>(
    action: Action<TAction, TPayload, TResp>
  ): Promise<Result<TResp, FetchError>> {
    try {
      const headers = new Headers()
      if (this.token) {
        headers.set('Authorization', `Bearer ${this.token}`)
      }

      const resp = await fetch(this.url + action.action, {
        method: action.method,
        // @ts-ignore
        body: action.payload !== null ? JSON.stringify(action.payload) : undefined,
        headers,
      })

      if (resp.status >= 200 && resp.status <= 299) {
        const body = await resp.json()
        const decodedResp = action.codec.decode(body)
        if (isRight(decodedResp)) {
          return Ok(decodedResp.right)
        } else {
          return Err(new ResponseDecodeError(body))
        }
      } else if (resp.status === 403) {
        return Err(new Unauthorised())
      } else if (resp.status === 400) {
        const body = await resp.json()
        return Err(new RequestError(body))
      } else if (resp.status >= 500 && resp.status <= 599) {
        return Err(new ServiceUnavailable())
      }

      return Err(new UnexpectedStatus(resp.status))
    } catch (e) {
      return Err(new NetworkError(e))
    }
  }
}
