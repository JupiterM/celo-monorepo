import { Address, sleep } from '@celo/base'
import { Err, Ok, Result } from '@celo/base/lib/result'
import { ContractKit } from '@celo/contractkit'
import {
  MetaTransactionWalletWrapper,
  RawTransaction,
  toRawTransaction,
} from '@celo/contractkit/lib/wrappers/MetaTransactionWallet'
import { PlatformOSType } from 'react-native'
import { TransactionReceipt } from 'web3-core'
import {
  deployWallet,
  getDistributedBlindedPepper,
  requestSubsidisedAttestations,
  startSession,
  submitMetaTransaction,
} from './actions'
import { KomenciClient } from './client'
import {
  FetchError,
  FetchErrorTypes,
  NoWalletError,
  TxError,
  TxErrorTypes,
  TxEventNotFound,
  TxRevertError,
  TxTimeoutError,
} from './errors'
import { retry } from './retry'

const TAG = 'KomenciKit'

interface KomenciOptions {
  url: string
  platform: PlatformOSType
  account: Address
  txRetryTimeoutMs: number
}

type KomenciOptionsInput = Omit<KomenciOptions, 'txRetryTimeoutMs'> & {
  txRetryTimeoutMs?: number
}

const DEFAULT_OPTIONS: Partial<KomenciOptions> = {
  txRetryTimeoutMs: 20000,
}

export class KomenciKit {
  private client: KomenciClient
  private options: KomenciOptions
  private wallet?: MetaTransactionWalletWrapper

  constructor(private contractKit: ContractKit, options: KomenciOptionsInput) {
    // @ts-ignore
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    }
    this.client = new KomenciClient(this.options.url)
  }

  startSession = async (
    captchaToken: string,
    deviceAttestationToken: string
  ): Promise<Result<true, FetchError>> => {
    const resp = await this.client.exec(
      startSession({
        captchaResponseToken: captchaToken,
        externalAccount: this.options.account,
        deviceType: this.options.platform,
        iosDeviceToken: this.options.platform === 'ios' ? deviceAttestationToken : undefined,
        androidSignedAttestation:
          this.options.platform === 'android' ? deviceAttestationToken : undefined,
      })
    )

    if (resp.ok) {
      this.client.setToken(resp.result.token)
      return Ok(true)
    }

    return resp
  }

  getDistributedBlindedPepper = async (
    e164Number: string,
    clientVersion: string
  ): Promise<Result<string, Error>> => {
    const resp = await this.client.exec(getDistributedBlindedPepper({ e164Number, clientVersion }))

    if (resp.ok) {
      return Ok(resp.result.identifier)
    }

    return resp
  }

  @retry({
    tries: 3,
    bailOnErrorTypes: [
      FetchErrorTypes.Unauthorised,
      FetchErrorTypes.ServiceUnavailable,
      TxErrorTypes.Revert,
    ],
    onRetry: (_args, error, attempt) => {
      console.debug(`${TAG}/deployWallet attempt#${attempt} error: `, error)
    },
  })
  public async deployWallet(): Promise<Result<string, FetchError | TxError>> {
    const resp = await this.client.exec(deployWallet())
    if (resp.ok) {
      if (resp.result.status === 'deployed') {
        return Ok(resp.result.walletAddress)
      } else {
        const txHash = resp.result.txHash
        const receiptResult = await this.waitForReceipt(txHash)
        if (receiptResult.ok) {
          const receipt = receiptResult.result
          if (!receipt.status) {
            // TODO: Extract reason
            return Err(new TxRevertError(txHash, 'reason'))
          }

          const deployWalletLog = receipt.logs.find((log) => {
            console.log(log)
            return false
          })

          if (deployWalletLog === undefined) {
            // TODO: Extract event
            return Err(new TxEventNotFound(txHash, 'event'))
          }

          const walletAddress = deployWalletLog.topics[2]
          await this.setWallet(walletAddress)

          return Ok(deployWalletLog.topics[2])
        }

        return receiptResult
      }
    } else {
      return resp
    }
  }

  public async selectIssuers(
    identifier: string
  ): Promise<Result<TransactionReceipt, FetchError | TxError | NoWalletError>> {
    if (this.wallet === undefined) {
      return Err(new NoWalletError())
    }

    const attestations = await this.contractKit.contracts.getAttestations()
    const selectIssuersTx = attestations.selectIssuers(identifier).txo
    const signature = await this.wallet.signMetaTransaction(selectIssuersTx)
    return this.submitMetaTransaction(
      toRawTransaction(this.wallet.executeMetaTransaction(selectIssuersTx, signature).txo)
    )
  }

  public async completeAttestation(
    identifier: string,
    issuer: Address,
    code: string
  ): Promise<Result<TransactionReceipt, FetchError | TxError | NoWalletError>> {
    if (this.wallet === undefined) {
      return Err(new NoWalletError())
    }

    const attestations = await this.contractKit.contracts.getAttestations()
    const completeTx = attestations.complete(identifier, this.options.account, issuer, code)
    const signature = await this.wallet.signMetaTransaction(completeTx)
    return this.submitMetaTransaction(
      toRawTransaction(this.wallet.executeMetaTransaction(completeTx, signature).txo)
    )
  }

  @retry({
    tries: 3,
    bailOnErrorTypes: [
      FetchErrorTypes.Unauthorised,
      FetchErrorTypes.ServiceUnavailable,
      TxErrorTypes.Revert,
    ],
    onRetry: (_args, error, attempt) => {
      console.debug(`${TAG}/requestAttestations attempt#${attempt} error: `, error)
    },
  })
  public async requestAttestations(
    identifier: string,
    attestationsRequested: number
  ): Promise<Result<TransactionReceipt, FetchError | TxError | NoWalletError>> {
    if (this.wallet === undefined) {
      return Err(new NoWalletError())
    }

    const attestations = await this.contractKit.contracts.getAttestations()
    const requestTx = await attestations.request(identifier, attestationsRequested)
    const requestTxSig = await this.wallet.signMetaTransaction(requestTx.txo)
    const requestMetaTx = this.wallet.executeMetaTransaction(requestTx.txo, requestTxSig)

    const approveTx = await attestations.approveAttestationFee(attestationsRequested)
    const approveTxSig = await this.wallet.signMetaTransaction(approveTx.txo)
    const approveMetaTx = this.wallet.executeMetaTransaction(approveTx.txo, approveTxSig)

    const resp = await this.client.exec(
      requestSubsidisedAttestations({
        identifier,
        attestationsRequested,
        transactions: {
          request: toRawTransaction(requestMetaTx),
          approve: toRawTransaction(approveMetaTx),
        },
      })
    )

    if (resp.ok) {
      const txHash = resp.result.txHash
      return this.waitForReceipt(txHash)
    }

    return resp
  }

  @retry({
    tries: 3,
    bailOnErrorTypes: [
      FetchErrorTypes.Unauthorised,
      FetchErrorTypes.ServiceUnavailable,
      TxErrorTypes.Revert,
    ],
    onRetry: (_args, error, attempt) => {
      console.debug(`${TAG}/submitMetaTransaction attempt#${attempt} error: `, error)
    },
  })
  public async submitMetaTransaction(
    payload: RawTransaction
  ): Promise<Result<TransactionReceipt, FetchError | TxError>> {
    const resp = await this.client.exec(submitMetaTransaction(payload))
    if (resp.ok) {
      const txHash = resp.result.txHash
      return this.waitForReceipt(txHash)
    }

    return resp
  }

  public async setWallet(walletAddress: string) {
    this.wallet = await this.contractKit.contracts.getMetaTransactionWallet(walletAddress)
  }

  private async waitForReceipt(txHash: string): Promise<Result<TransactionReceipt, TxError>> {
    let receipt: TransactionReceipt | null = null
    let waited = 0
    while (receipt == null && waited < this.options.txRetryTimeoutMs) {
      receipt = await this.contractKit.web3.eth.getTransactionReceipt(txHash)
      if (receipt == null) {
        await sleep(100)
        waited += 100
      }
    }

    if (receipt == null) {
      return Err(new TxTimeoutError())
    }

    return Ok(receipt)
  }
}
