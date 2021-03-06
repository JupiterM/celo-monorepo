# Class: LedgerWallet

## Hierarchy

  ↳ [RemoteWallet](_wallets_remote_wallet_.remotewallet.md)‹[LedgerSigner](_wallets_signers_ledger_signer_.ledgersigner.md)›

  ↳ **LedgerWallet**

## Implements

* [ReadOnlyWallet](../interfaces/_wallets_wallet_.readonlywallet.md)
* [ReadOnlyWallet](../interfaces/_wallets_wallet_.readonlywallet.md)
* [ReadOnlyWallet](../interfaces/_wallets_wallet_.readonlywallet.md)

## Index

### Constructors

* [constructor](_wallets_ledger_wallet_.ledgerwallet.md#constructor)

### Properties

* [baseDerivationPath](_wallets_ledger_wallet_.ledgerwallet.md#basederivationpath)
* [derivationPathIndexes](_wallets_ledger_wallet_.ledgerwallet.md#derivationpathindexes)
* [ledgerAddressValidation](_wallets_ledger_wallet_.ledgerwallet.md#ledgeraddressvalidation)
* [transport](_wallets_ledger_wallet_.ledgerwallet.md#transport)

### Methods

* [decrypt](_wallets_ledger_wallet_.ledgerwallet.md#decrypt)
* [getAccounts](_wallets_ledger_wallet_.ledgerwallet.md#getaccounts)
* [hasAccount](_wallets_ledger_wallet_.ledgerwallet.md#hasaccount)
* [init](_wallets_ledger_wallet_.ledgerwallet.md#init)
* [isSetupFinished](_wallets_ledger_wallet_.ledgerwallet.md#issetupfinished)
* [signPersonalMessage](_wallets_ledger_wallet_.ledgerwallet.md#signpersonalmessage)
* [signTransaction](_wallets_ledger_wallet_.ledgerwallet.md#signtransaction)
* [signTypedData](_wallets_ledger_wallet_.ledgerwallet.md#signtypeddata)

## Constructors

###  constructor

\+ **new LedgerWallet**(`derivationPathIndexes`: number[], `baseDerivationPath`: string, `transport`: any, `ledgerAddressValidation`: [AddressValidation](../enums/_wallets_ledger_wallet_.addressvalidation.md)): *[LedgerWallet](_wallets_ledger_wallet_.ledgerwallet.md)*

*Defined in [packages/contractkit/src/wallets/ledger-wallet.ts:46](https://github.com/celo-org/celo-monorepo/blob/master/packages/contractkit/src/wallets/ledger-wallet.ts#L46)*

**Parameters:**

Name | Type | Default | Description |
------ | ------ | ------ | ------ |
`derivationPathIndexes` | number[] | zeroRange(ADDRESS_QTY) | number array of "address_index" for the base derivation path. Default: Array[0..9]. Example: [3, 99, 53] will retrieve the derivation paths of [`${baseDerivationPath}/3`, `${baseDerivationPath}/99`, `${baseDerivationPath}/53`] |
`baseDerivationPath` | string | CELO_BASE_DERIVATION_PATH | base derivation path. Default: "44'/52752'/0'/0" |
`transport` | any | {} | Transport to connect the ledger device  |
`ledgerAddressValidation` | [AddressValidation](../enums/_wallets_ledger_wallet_.addressvalidation.md) | AddressValidation.firstTransactionPerAddress | - |

**Returns:** *[LedgerWallet](_wallets_ledger_wallet_.ledgerwallet.md)*

## Properties

###  baseDerivationPath

• **baseDerivationPath**: *string*

*Defined in [packages/contractkit/src/wallets/ledger-wallet.ts:58](https://github.com/celo-org/celo-monorepo/blob/master/packages/contractkit/src/wallets/ledger-wallet.ts#L58)*

base derivation path. Default: "44'/52752'/0'/0"

___

###  derivationPathIndexes

• **derivationPathIndexes**: *number[]*

*Defined in [packages/contractkit/src/wallets/ledger-wallet.ts:57](https://github.com/celo-org/celo-monorepo/blob/master/packages/contractkit/src/wallets/ledger-wallet.ts#L57)*

number array of "address_index" for the base derivation path.
Default: Array[0..9].
Example: [3, 99, 53] will retrieve the derivation paths of
[`${baseDerivationPath}/3`, `${baseDerivationPath}/99`, `${baseDerivationPath}/53`]

___

###  ledgerAddressValidation

• **ledgerAddressValidation**: *[AddressValidation](../enums/_wallets_ledger_wallet_.addressvalidation.md)*

*Defined in [packages/contractkit/src/wallets/ledger-wallet.ts:60](https://github.com/celo-org/celo-monorepo/blob/master/packages/contractkit/src/wallets/ledger-wallet.ts#L60)*

___

###  transport

• **transport**: *any*

*Defined in [packages/contractkit/src/wallets/ledger-wallet.ts:59](https://github.com/celo-org/celo-monorepo/blob/master/packages/contractkit/src/wallets/ledger-wallet.ts#L59)*

Transport to connect the ledger device

## Methods

###  decrypt

▸ **decrypt**(`address`: string, `ciphertext`: Buffer): *Promise‹Buffer‹››*

*Inherited from [WalletBase](_wallets_wallet_.walletbase.md).[decrypt](_wallets_wallet_.walletbase.md#decrypt)*

*Defined in [packages/contractkit/src/wallets/wallet.ts:130](https://github.com/celo-org/celo-monorepo/blob/master/packages/contractkit/src/wallets/wallet.ts#L130)*

**Parameters:**

Name | Type |
------ | ------ |
`address` | string |
`ciphertext` | Buffer |

**Returns:** *Promise‹Buffer‹››*

___

###  getAccounts

▸ **getAccounts**(): *[Address](../modules/_base_.md#address)[]*

*Inherited from [RemoteWallet](_wallets_remote_wallet_.remotewallet.md).[getAccounts](_wallets_remote_wallet_.remotewallet.md#getaccounts)*

*Overrides [WalletBase](_wallets_wallet_.walletbase.md).[getAccounts](_wallets_wallet_.walletbase.md#getaccounts)*

*Defined in [packages/contractkit/src/wallets/remote-wallet.ts:62](https://github.com/celo-org/celo-monorepo/blob/master/packages/contractkit/src/wallets/remote-wallet.ts#L62)*

Get a list of accounts in the remote wallet

**Returns:** *[Address](../modules/_base_.md#address)[]*

___

###  hasAccount

▸ **hasAccount**(`address?`: [Address](../modules/_base_.md#address)): *boolean*

*Inherited from [RemoteWallet](_wallets_remote_wallet_.remotewallet.md).[hasAccount](_wallets_remote_wallet_.remotewallet.md#hasaccount)*

*Overrides [WalletBase](_wallets_wallet_.walletbase.md).[hasAccount](_wallets_wallet_.walletbase.md#hasaccount)*

*Defined in [packages/contractkit/src/wallets/remote-wallet.ts:71](https://github.com/celo-org/celo-monorepo/blob/master/packages/contractkit/src/wallets/remote-wallet.ts#L71)*

Returns true if account is in the remote wallet

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`address?` | [Address](../modules/_base_.md#address) | Account to check  |

**Returns:** *boolean*

___

###  init

▸ **init**(): *Promise‹void›*

*Inherited from [RemoteWallet](_wallets_remote_wallet_.remotewallet.md).[init](_wallets_remote_wallet_.remotewallet.md#init)*

*Defined in [packages/contractkit/src/wallets/remote-wallet.ts:21](https://github.com/celo-org/celo-monorepo/blob/master/packages/contractkit/src/wallets/remote-wallet.ts#L21)*

Discovers wallet accounts and caches results in memory
Idempotent to ensure multiple calls are benign

**Returns:** *Promise‹void›*

___

###  isSetupFinished

▸ **isSetupFinished**(): *boolean*

*Inherited from [RemoteWallet](_wallets_remote_wallet_.remotewallet.md).[isSetupFinished](_wallets_remote_wallet_.remotewallet.md#issetupfinished)*

*Defined in [packages/contractkit/src/wallets/remote-wallet.ts:111](https://github.com/celo-org/celo-monorepo/blob/master/packages/contractkit/src/wallets/remote-wallet.ts#L111)*

**Returns:** *boolean*

___

###  signPersonalMessage

▸ **signPersonalMessage**(`address`: [Address](../modules/_base_.md#address), `data`: string): *Promise‹string›*

*Inherited from [RemoteWallet](_wallets_remote_wallet_.remotewallet.md).[signPersonalMessage](_wallets_remote_wallet_.remotewallet.md#signpersonalmessage)*

*Overrides [WalletBase](_wallets_wallet_.walletbase.md).[signPersonalMessage](_wallets_wallet_.walletbase.md#signpersonalmessage)*

*Defined in [packages/contractkit/src/wallets/remote-wallet.ts:90](https://github.com/celo-org/celo-monorepo/blob/master/packages/contractkit/src/wallets/remote-wallet.ts#L90)*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`address` | [Address](../modules/_base_.md#address) | Address of the account to sign with |
`data` | string | Hex string message to sign |

**Returns:** *Promise‹string›*

Signature hex string (order: rsv)

___

###  signTransaction

▸ **signTransaction**(`txParams`: Tx): *Promise‹EncodedTransaction›*

*Inherited from [RemoteWallet](_wallets_remote_wallet_.remotewallet.md).[signTransaction](_wallets_remote_wallet_.remotewallet.md#signtransaction)*

*Overrides [WalletBase](_wallets_wallet_.walletbase.md).[signTransaction](_wallets_wallet_.walletbase.md#signtransaction)*

*Defined in [packages/contractkit/src/wallets/remote-wallet.ts:80](https://github.com/celo-org/celo-monorepo/blob/master/packages/contractkit/src/wallets/remote-wallet.ts#L80)*

Signs the EVM transaction using the signer pulled from the from field

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`txParams` | Tx | EVM transaction  |

**Returns:** *Promise‹EncodedTransaction›*

___

###  signTypedData

▸ **signTypedData**(`address`: [Address](../modules/_base_.md#address), `typedData`: EIP712TypedData): *Promise‹string›*

*Inherited from [RemoteWallet](_wallets_remote_wallet_.remotewallet.md).[signTypedData](_wallets_remote_wallet_.remotewallet.md#signtypeddata)*

*Overrides [WalletBase](_wallets_wallet_.walletbase.md).[signTypedData](_wallets_wallet_.walletbase.md#signtypeddata)*

*Defined in [packages/contractkit/src/wallets/remote-wallet.ts:100](https://github.com/celo-org/celo-monorepo/blob/master/packages/contractkit/src/wallets/remote-wallet.ts#L100)*

**Parameters:**

Name | Type | Description |
------ | ------ | ------ |
`address` | [Address](../modules/_base_.md#address) | Address of the account to sign with |
`typedData` | EIP712TypedData | the typed data object |

**Returns:** *Promise‹string›*

Signature hex string (order: rsv)
