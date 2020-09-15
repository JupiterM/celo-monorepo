import { ACCOUNT_ADDRESSES, ACCOUNT_PRIVATE_KEYS } from '@celo/dev-utils/lib/ganache-setup'
import { testWithGanache } from '@celo/dev-utils/lib/ganache-test'
import {
  privateKeyToPublicKey,
  publicKeyToAddress,
  toChecksumAddress,
} from '@celo/utils/lib/address'
import { NativeSigner } from '@celo/utils/lib/signatureUtils'
import { newKitFromWeb3 } from '../kit'
import { AccountsWrapper } from '../wrappers/Accounts'
import { createStorageClaim } from './claims/claim'
import { IdentityMetadataWrapper } from './metadata'
import OffchainDataWrapper, { OffchainErrorTypes } from './offchain-data-wrapper'
import { SchemaErrorTypes } from './offchain/schema-utils'
import { AuthorizedSignerAccessor, NameAccessor } from './offchain/schemas'
import { MockStorageWriter } from './offchain/storage-writers'

testWithGanache('Offchain Data', (web3) => {
  const kit = newKitFromWeb3(web3)

  const writerPrivate = ACCOUNT_PRIVATE_KEYS[0]
  const writerPublic = privateKeyToPublicKey(writerPrivate)
  const writerAddress = publicKeyToAddress(writerPublic)

  const readerPrivate = ACCOUNT_PRIVATE_KEYS[1]
  const readerPublic = privateKeyToPublicKey(readerPrivate)
  const readerAddress = publicKeyToAddress(readerPublic)

  const signer = ACCOUNT_ADDRESSES[2]
  // const reader = ACCOUNT_ADDRESSES[2]

  // const readerEncryptionKeyPrivate = ensureLeading0x(randomBytes(32).toString('hex'))
  // const readerEncryptionKeyPublic = privateKeyToPublicKey(readerEncryptionKeyPrivate)

  const WRITER_METADATA_URL = 'http://example.com/writer'
  const WRITER_STORAGE_ROOT = 'http://example.com/root'
  const WRITER_LOCAL_STORAGE_ROOT = `/tmp/offchain/${writerAddress}`
  let accounts: AccountsWrapper
  let wrapper: OffchainDataWrapper

  beforeEach(async () => {
    accounts = await kit.contracts.getAccounts()
    await accounts.createAccount().sendAndWaitForReceipt({ from: writerAddress })

    const metadata = IdentityMetadataWrapper.fromEmpty(writerAddress)
    await metadata.addClaim(
      createStorageClaim(WRITER_STORAGE_ROOT),
      NativeSigner(web3.eth.sign, writerAddress)
    )

    fetchMock.mock(WRITER_METADATA_URL, metadata.toString())
    await accounts
      .setMetadataURL(WRITER_METADATA_URL)
      .sendAndWaitForReceipt({ from: writerAddress })
  })

  beforeEach(() => {
    wrapper = new OffchainDataWrapper(writerAddress, kit)
    wrapper.storageWriter = new MockStorageWriter(
      WRITER_LOCAL_STORAGE_ROOT,
      WRITER_STORAGE_ROOT,
      fetchMock
    )
  })

  afterEach(async () => {
    fetchMock.reset()
  })

  describe('with the account being the signer', () => {
    it('can write a name', async () => {
      const testname = 'test'
      const nameAccessor = new NameAccessor(wrapper)
      await nameAccessor.write({ name: testname })

      const resp = await nameAccessor.readAsResult(writerAddress)
      if (resp.ok) {
        expect(resp.result.name).toEqual(testname)
      } else {
        const error = resp.error
        switch (error.errorType) {
          case SchemaErrorTypes.InvalidDataError:
            console.log("Something was wrong with the schema, can't try again")
            break
          case SchemaErrorTypes.OffchainError:
            const offchainError = error.error
            switch (offchainError.errorType) {
              case OffchainErrorTypes.FetchError:
                console.log('Something went wrong with fetching, try again')
                break
              case OffchainErrorTypes.InvalidSignature:
                console.log('Signature was wrong')
                break
              case OffchainErrorTypes.NoStorageRootProvidedData:
                console.log('Account has not data for this type')
                break
            }

          default:
            break
        }
      }
    })
  })

  it('cannot write with a signer that is not authorized', async () => {
    // Mock the 404
    fetchMock.mock(
      WRITER_STORAGE_ROOT + `/account/authorizedSigners/${toChecksumAddress(signer)}`,
      404
    )

    wrapper = new OffchainDataWrapper(signer, kit)
    wrapper.storageWriter = new MockStorageWriter(
      WRITER_LOCAL_STORAGE_ROOT,
      WRITER_STORAGE_ROOT,
      fetchMock
    )

    const testname = 'test'
    const nameAccessor = new NameAccessor(wrapper)
    await nameAccessor.write({ name: testname })

    const receivedName = await nameAccessor.readAsResult(writerAddress)
    expect(receivedName.ok).toEqual(false)
    const authorizedSignerAccessor = new AuthorizedSignerAccessor(wrapper)
    const authorization = await authorizedSignerAccessor.readAsResult(writerAddress, signer)
    expect(authorization.ok).toEqual(false)
  })

  // })
  // })

  // describe('with a different key being authorized to sign off-chain', () => {
  //   beforeEach(async () => {
  //     wrapper = new OffchainDataWrapper(writer, kit)
  //     wrapper.storageWriter = new MockStorageWriter(
  //       WRITER_LOCAL_STORAGE_ROOT,
  //       WRITER_STORAGE_ROOT,
  //       fetchMock
  //     )

  //     const authorizedSignerAccessor = new AuthorizedSignerAccessor(wrapper)
  //     const pop = await accounts.generateProofOfKeyPossession(writer, signer)
  //     await authorizedSignerAccessor.write(signer, serializeSignature(pop), '.*')
  //   })

  //   wrapper = new OffchainDataWrapper(signer, kit)
  //   wrapper.storageWriter = new MockStorageWriter(
  //     WRITER_LOCAL_STORAGE_ROOT,
  //     WRITER_STORAGE_ROOT,
  //     fetchMock
  //   )

  //   it('can read the authorization', async () => {
  //     const authorizedSignerAccessor = new AuthorizedSignerAccessor(wrapper)
  //     const authorization = await authorizedSignerAccessor.readAsResult(writer, signer)
  //     expect(authorization).toBeDefined()
  //   })

  //   it('can write a name', async () => {
  //     const testname = 'test'
  //     const nameAccessor = new NameAccessor(wrapper)
  //     await nameAccessor.write({ name: testname })

  //     const resp = await nameAccessor.readAsResult(writer)
  //     if (resp.ok) {
  //       expect(resp.result.name).toEqual(testname)
  //     }
  //   })
  // })

  describe('encryption', () => {
    describe('when no keys are loaded in the wallet', () => {
      it('can read and write when passing keys in directly', async () => {
        const testname = 'test'
        const payload = { name: testname }

        const nameAccessor = new NameAccessor(wrapper)

        await nameAccessor.writeEncryptedWithKey(payload, writerPrivate, readerPublic)
        const receivedName = await nameAccessor.readEncryptedWithKey(readerPrivate, writerPublic)
        expect(receivedName).toBeDefined()
        expect(receivedName?.ok).toBeTruthy()
        // @ts-ignore
        expect(receivedName?.result).toEqual(payload)
      })

      it('cannot write encrypted data', async () => {
        const testname = 'test'
        const payload = { name: testname }

        const nameAccessor = new NameAccessor(wrapper)

        try {
          await nameAccessor.writeEncrypted(payload, writerAddress, readerAddress)
          throw new Error("Shouldn't get here")
        } catch (e) {
          expect(e.message).toEqual(`Could not find address ${writerAddress.toLowerCase()}`)
        }
      })

      it('the reader cannot decrypt the data', async () => {
        const testname = 'test'
        const payload = { name: testname }

        const nameAccessor = new NameAccessor(wrapper)
        await nameAccessor.writeEncryptedWithKey(payload, writerPrivate, readerPublic)

        try {
          await nameAccessor.readEncrypted(readerAddress, writerAddress)
          throw new Error('Should not get here')
        } catch (e) {
          expect(e.message).toEqual(`Could not find address ${readerAddress.toLowerCase()}`)
        }
      })
    })

    describe('using keys in the wallet', () => {
      beforeEach(() => {
        kit.addAccount(writerPrivate)
        kit.addAccount(readerPrivate)
      })

      afterEach(() => {
        kit.removeAccount(writerPrivate)
        kit.removeAccount(readerPrivate)
      })

      it('reads and writes metadata', async () => {
        const testname = 'test'
        const payload = { name: testname }

        const nameAccessor = new NameAccessor(wrapper)

        await nameAccessor.writeEncrypted(payload, writerAddress, readerAddress)
        const receivedName = await nameAccessor.readEncrypted(readerAddress, writerAddress)
        expect(receivedName).toBeDefined()
        expect(receivedName?.ok).toBeTruthy()
        // @ts-ignore
        expect(receivedName?.result).toEqual(payload)
      })
    })
  })
})
