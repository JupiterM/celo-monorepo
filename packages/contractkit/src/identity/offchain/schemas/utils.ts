import { Err, Ok, parseJsonAsResult, Result, trimLeading0x } from '@celo/base/src'
import { publicKeyToAddress } from '@celo/utils/lib/address'
import { AES128Decrypt, Encrypt } from '@celo/utils/lib/ecies'
import { EIP712Object, EIP712TypedData } from '@celo/utils/lib/sign-typed-data-utils'
import { trimPublicKeyPrefix } from '@celo/utils/src/ecdh'
import { createCipheriv, createHmac, randomBytes } from 'crypto'
import { keccak256 } from 'ethereumjs-util'
import { isLeft } from 'fp-ts/lib/Either'
import * as t from 'io-ts'
import { join, normalize } from 'path'
import OffchainDataWrapper, { OffchainErrorTypes } from '../../offchain-data-wrapper'
import {
  InvalidDataError,
  InvalidKey,
  OffchainError,
  SchemaErrors,
  SchemaErrorTypes,
  UnavailableKey,
} from './errors'

export interface Schema<DataType> {
  write: (data: DataType) => Promise<SchemaErrors | void>
  read: (from: string) => Promise<DataType>
  readAsResult: (from: string) => Promise<Result<DataType, SchemaErrors>>
}

export interface EncryptedSchema<DataType> {
  write: (data: DataType, to: string[], symmetricKey?: Buffer) => Promise<SchemaErrors | void>
  read: (from: string) => Promise<DataType>
  readAsResult: (from: string) => Promise<Result<DataType, SchemaErrors>>
}

const KEY_LENGTH = 16
const IV_LENGTH = 16

// label = PRF(ECDH(A, B), A || B || data path)
// ciphertext path = "/cosmetic path/" || base64(label)
function getCiphertextLabel(
  path: string,
  sharedSecret: Buffer,
  senderPublicKey: string,
  receiverPublicKey: string
) {
  const senderPublicKeyBuffer = Buffer.from(trimLeading0x(senderPublicKey), 'hex')
  const receiverPublicKeyBuffer = Buffer.from(trimLeading0x(receiverPublicKey), 'hex')

  const label = createHmac('blake2s256', sharedSecret)
    .update(Buffer.concat([senderPublicKeyBuffer, receiverPublicKeyBuffer, Buffer.from(path)]))
    .digest('base64')
  return normalize(join('ciphertexts', label))
}

// Assumes that the wallet has the dataEncryptionKey of wrapper.self available
// TODO: Should check and throw a more meaningful error if not

/**
 * Encrypts the symmetric key `key` to `toAddress`'s data encryption key and uploads it
 * to the computed storage path.
 *
 * @param wrapper the offchain data wrapper
 * @param dataPath path to where the encrypted data is stored. Used to derive the key location
 * @param key the symmetric key to distribute
 * @param toAddress address to encrypt symmetric key to
 */
const distributeSymmetricKey = async (
  wrapper: OffchainDataWrapper,
  dataPath: string,
  key: Buffer,
  toAddress: string
): Promise<void | Error> => {
  const accounts = await wrapper.kit.contracts.getAccounts()
  const [fromPubKey, toPubKey] = await Promise.all([
    accounts.getDataEncryptionKey(wrapper.self),
    accounts.getDataEncryptionKey(toAddress),
  ])
  const wallet = wrapper.kit.getWallet()
  const sharedSecret = await wallet.computeSharedSecret(publicKeyToAddress(fromPubKey), toPubKey)

  const computedDataPath = getCiphertextLabel(`${dataPath}.key`, sharedSecret, fromPubKey, toPubKey)
  const encryptedData = Encrypt(Buffer.from(trimPublicKeyPrefix(toPubKey), 'hex'), Buffer.from(key))

  const signature = await signBuffer(wrapper, computedDataPath, encryptedData)
  return wrapper.writeDataTo(encryptedData, signature, computedDataPath)
}

/**
 * Handles choosing the symmetric key to use.
 * If we're explicitly passing in a key, use that,
 * If a key has already been generated for this dataPath, use that,
 * Else generate a new one
 *
 * @param wrapper the offchain data wrapper
 * @param dataPath path to where the encrypted data is stored. Used to derive the key location
 * @param symmetricKey
 */
async function fetchOrGenerateKey(
  wrapper: OffchainDataWrapper,
  dataPath: string,
  symmetricKey?: Buffer
) {
  if (symmetricKey) {
    return Ok(symmetricKey)
  }

  const existingKey = await readSymmetricKey(wrapper, dataPath, wrapper.self)
  if (existingKey.ok) {
    return Ok(existingKey.result)
  }

  if (
    existingKey.error.errorType === SchemaErrorTypes.OffchainError &&
    existingKey.error.error.errorType === OffchainErrorTypes.NoStorageRootProvidedData
  ) {
    return Ok(randomBytes(16))
  }

  return Err(existingKey.error)
}

/**
 * Handles encrypting the data with a symmetric key, then distributing said key to each address
 * in the `toAddresses` array.
 *
 * @param wrapper the offchain data wrapper
 * @param dataPath path to where the encrypted data is stored. Used to derive the key location
 * @param data the data to encrypt
 * @param toAddresses the addresses to distribute the symmetric key to
 * @param symmetricKey the symmetric key to use to encrypt the data. One will be found or generated if not provided
 */
export const writeEncrypted = async (
  wrapper: OffchainDataWrapper,
  dataPath: string,
  data: Buffer,
  toAddresses: string[],
  symmetricKey?: Buffer
) => {
  const fetchKey = await fetchOrGenerateKey(wrapper, dataPath, symmetricKey)
  if (!fetchKey.ok) {
    return fetchKey.error
  }

  //  file_ciphertext = IV || E(message key, IV, data)
  const iv = randomBytes(16)
  const cipher = createCipheriv('aes-128-ctr', fetchKey.result, iv)
  const payload = Buffer.concat([iv, cipher.update(data), cipher.final()])

  const signature = await signBuffer(wrapper, `${dataPath}.enc`, payload)
  await wrapper.writeDataTo(payload, signature, `${dataPath}.enc`)

  await Promise.all(
    // here we encrypt the key to ourselves so we can retrieve it later
    [wrapper.self, ...toAddresses].map(async (toAddress) =>
      distributeSymmetricKey(wrapper, dataPath, fetchKey.result, toAddress)
    )
  )
}

/**
 * Reads and decrypts a symmetric key that has been encrypted to your
 * data encryption key.
 *
 * @param wrapper the offchain data wrapper
 * @param dataPath path to where the encrypted data is stored. Used to derive the key location
 * @param senderAddress the address that encrypted this key to you
 */
const readSymmetricKey = async (
  wrapper: OffchainDataWrapper,
  dataPath: string,
  senderAddress: string
): Promise<Result<Buffer, SchemaErrors>> => {
  const accounts = await wrapper.kit.contracts.getAccounts()
  const wallet = wrapper.kit.getWallet()
  const [readerPubKey, senderPubKey] = await Promise.all([
    accounts.getDataEncryptionKey(wrapper.self),
    accounts.getDataEncryptionKey(senderAddress),
  ])

  if (readerPubKey === null) {
    return Err(new UnavailableKey(senderAddress))
  }

  const readerPublicKeyAddress = publicKeyToAddress(readerPubKey)
  if (!wallet.hasAccount(readerPublicKeyAddress)) {
    return Err(new UnavailableKey(readerPublicKeyAddress))
  }

  const sharedSecret = await wallet.computeSharedSecret(readerPublicKeyAddress, senderPubKey)
  const computedDataPath = getCiphertextLabel(
    `${dataPath}.key`,
    sharedSecret,
    senderPubKey,
    readerPubKey
  )
  const encryptedPayload = await wrapper.readDataFromAsResult(
    senderAddress,
    (buf) => buildEIP712TypedData(wrapper, computedDataPath, buf),
    computedDataPath
  )

  if (!encryptedPayload.ok) {
    return Err(new OffchainError(encryptedPayload.error))
  }

  const payload = await wallet.decrypt(readerPublicKeyAddress, encryptedPayload.result)
  return Ok(payload)
}

/**
 * Reads and decrypts a payload that has been encrypted to your data encryption key. Will
 * resolving the symmetric key used to encrypt the payload.
 *
 * @param wrapper the offchain data wrapper
 * @param dataPath path to where the encrypted data is stored. Used to derive the key location
 * @param senderAddress the address that encrypted this key to you
 */
export const readEncrypted = async (
  wrapper: OffchainDataWrapper,
  dataPath: string,
  senderAddress: string
): Promise<Result<Buffer, SchemaErrors>> => {
  const encryptedPayloadPath = `${dataPath}.enc`
  const [payload, key] = await Promise.all([
    wrapper.readDataFromAsResult(
      senderAddress,
      (buf) => buildEIP712TypedData(wrapper, encryptedPayloadPath, buf),
      encryptedPayloadPath
    ),
    readSymmetricKey(wrapper, dataPath, senderAddress),
  ])

  if (!payload.ok) {
    return Err(new OffchainError(payload.error))
  }
  if (!key.ok) {
    return Err(key.error)
  }

  if (key.result.length !== KEY_LENGTH) {
    return Err(new InvalidKey())
  }

  return Ok(
    AES128Decrypt(key.result, payload.result.slice(0, IV_LENGTH), payload.result.slice(IV_LENGTH))
  )
}

export const deserialize = <DataType>(
  type: t.Type<DataType>,
  buf: Buffer
): Result<DataType, SchemaErrors> => {
  const dataAsJson = parseJsonAsResult(buf.toString())
  if (!dataAsJson.ok) {
    return Err(new InvalidDataError())
  }

  const parsedDataAsType = type.decode(dataAsJson.result)
  if (isLeft(parsedDataAsType)) {
    return Err(new InvalidDataError())
  }

  return Ok(parsedDataAsType.right)
}

export const buildEIP712TypedData = async <DataType>(
  wrapper: OffchainDataWrapper,
  path: string,
  data: DataType | Buffer,
  type?: t.Type<DataType>
): Promise<EIP712TypedData> => {
  const chainId = await wrapper.kit.web3.eth.getChainId()
  const EIP712Domain = [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
  ]

  let types = {}
  let message = {}
  if (Buffer.isBuffer(data)) {
    types = {
      ClaimWithPath: [
        { name: 'path', type: 'string' },
        { name: 'hash', type: 'string' },
      ],
    }
    message = {
      hash: keccak256(data).toString('hex'),
    }
  } else {
    const Claim = buildEIP712Schema(type!)
    types = {
      Claim,
      ClaimWithPath: [
        { name: 'path', type: 'string' },
        { name: 'payload', type: 'Claim' },
      ],
    }
    message = {
      payload: (data as unknown) as EIP712Object,
    }
  }

  return {
    types: {
      EIP712Domain,
      ...types,
    },
    domain: {
      name: 'CIP8 Claim',
      version: '1.0.0',
      chainId,
    },
    primaryType: 'ClaimWithPath',
    message: {
      path,
      ...message,
    },
  }
}

export const signBuffer = async (wrapper: OffchainDataWrapper, dataPath: string, buf: Buffer) => {
  const typedData = await buildEIP712TypedData(wrapper, dataPath, buf)
  return wrapper.kit.getWallet().signTypedData(wrapper.signer, typedData)
}

const ioTsToSolidityTypeMapping: { [x: string]: string } = {
  [t.string._tag]: 'string',
  [t.number._tag]: 'uint256',
  [t.boolean._tag]: 'bool',
}

type EIP712Schema = Array<{ name: string; type: string }>
const buildEIP712Schema = <DataType>(type: t.Type<DataType>): EIP712Schema => {
  // @ts-ignore
  const shape = type.props
  // @ts-ignore
  return Object.entries(shape).reduce((accum, [key, value]) => {
    // @ts-ignore
    return [
      ...accum,
      {
        name: key,
        // @ts-ignore
        type: ioTsToSolidityTypeMapping[value._tag] || 'string',
      },
    ]
  }, [])
}
