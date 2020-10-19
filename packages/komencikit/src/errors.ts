import { RootError } from '@celo/base/lib/result'

export enum FetchErrorTypes {
  Unauthorised = 'Unauthorised',
  RequestError = 'RequestError',
  ServiceUnavailable = 'ServiceUnavailable',
  UnexpectedStatus = 'UnexpectedStatus',
  NetworkError = 'NetworkError',
  DecodeError = 'DecodeError',
}

export class Unauthorised extends RootError<FetchErrorTypes.Unauthorised> {
  constructor() {
    super(FetchErrorTypes.Unauthorised)
  }
}

export class RequestError extends RootError<FetchErrorTypes.RequestError> {
  constructor(public readonly data: object) {
    super(FetchErrorTypes.RequestError)
  }
}

export class ServiceUnavailable extends RootError<FetchErrorTypes.ServiceUnavailable> {
  constructor() {
    super(FetchErrorTypes.ServiceUnavailable)
  }
}

export class UnexpectedStatus extends RootError<FetchErrorTypes.UnexpectedStatus> {
  constructor(public readonly statusCode: number) {
    super(FetchErrorTypes.UnexpectedStatus)
  }
}

export class NetworkError extends RootError<FetchErrorTypes.NetworkError> {
  constructor(public readonly networkError: Error) {
    super(FetchErrorTypes.NetworkError)
  }
}

export class ResponseDecodeError extends RootError<FetchErrorTypes.DecodeError> {
  constructor(public readonly received: any) {
    super(FetchErrorTypes.DecodeError)
  }
}

export type FetchError =
  | Unauthorised
  | RequestError
  | ServiceUnavailable
  | UnexpectedStatus
  | NetworkError
  | ResponseDecodeError

export enum TxErrorTypes {
  Timeout = 'Timeout',
  Revert = 'Revert',
  EventNotFound = 'EventNotFound',
}

export class TxTimeoutError extends RootError<TxErrorTypes.Timeout> {
  constructor() {
    super(TxErrorTypes.Timeout)
  }
}

export class TxRevertError extends RootError<TxErrorTypes.Revert> {
  constructor(public readonly txHash: string, public readonly reason: string) {
    super(TxErrorTypes.Revert)
  }
}

export class TxEventNotFound extends RootError<TxErrorTypes.EventNotFound> {
  constructor(public readonly txHash: string, public readonly event: string) {
    super(TxErrorTypes.EventNotFound)
  }
}

export class NoWalletError extends RootError<'NoWalletError'> {
  constructor() {
    super('NoWalletError')
  }
}

export type TxError = TxTimeoutError | TxRevertError | TxEventNotFound
