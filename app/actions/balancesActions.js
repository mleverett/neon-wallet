// @flow
import { api } from 'neon-js'
import { extend, isEmpty, get } from 'lodash-es'
import { createActions } from 'spunky'
import { Howl } from 'howler'
// eslint-disable-next-line $FlowFixMe
import coinAudioSample from '../assets/audio/coin.wav'

import { getSettings } from './settingsActions'
import { getNode, getRPCEndpoint } from './nodeStorageActions'
import { ASSETS } from '../core/constants'
import { COIN_DECIMAL_LENGTH } from '../core/formatters'
import { toBigNumber } from '../core/math'
import { findNetworkByLabel } from '../core/networks'

const MAX_SCRIPT_HASH_CHUNK_SIZE = 5

type Props = {
  net: string,
  address: string,
  tokens: Array<TokenItemType>
}

let inMemoryBalances = {}
let hasTriggeredAudio = false
let inMemoryAddress
let inMemoryNetwork

const sound = new Howl({
  src: [coinAudioSample]
})

export const ID = 'balances'

export function resetBalanceState() {
  hasTriggeredAudio = false
  inMemoryAddress = undefined
  inMemoryNetwork = undefined
  inMemoryBalances = {}
}

function resetAudioTrigger() {
  hasTriggeredAudio = false
}

function determineIfBalanceUpdated(
  balanceData: Object,
  soundEnabled: boolean,
  networkHasChanged: boolean | void,
  addressHasChanged: boolean | void
) {
  if (
    isEmpty(inMemoryBalances) ||
    hasTriggeredAudio ||
    !soundEnabled ||
    networkHasChanged ||
    addressHasChanged
  ) {
    return undefined
  }
  Object.keys(balanceData).forEach(key => {
    const inMemoryBalance = toBigNumber(inMemoryBalances[key] || 0)
    if (toBigNumber(balanceData[key]).greaterThan(inMemoryBalance)) {
      sound.play()
      hasTriggeredAudio = true
    }
  })
}

async function getBalances({ net, address }: Props) {
  const { soundEnabled, tokens } = await getSettings()
  const network = findNetworkByLabel(net)

  let endpoint = await getNode(net)
  if (!endpoint) {
    endpoint = await getRPCEndpoint(net)
  }

  let networkHasChanged = true
  if (net === inMemoryNetwork) networkHasChanged = false

  let adressHasChanged = false
  if (!inMemoryAddress) adressHasChanged = false
  else if (inMemoryAddress !== address) adressHasChanged = true

  const chunks = tokens
    .filter(token => !token.isUserGenerated && token.networkId === network.id)
    .reduce((accum, currVal) => {
      if (!accum.length) {
        accum.push([currVal.scriptHash])
        return accum
      }

      if (accum[accum.length - 1].length < MAX_SCRIPT_HASH_CHUNK_SIZE) {
        accum[accum.length - 1].push(currVal.scriptHash)
      } else {
        accum.push([currVal.scriptHash])
      }
      return accum
    }, [])

  const promiseMap = chunks.map(chunk =>
    api.nep5.getTokenBalances(endpoint, chunk, address)
  )
  const results = await Promise.all(promiseMap)

  const parsedTokenBalances = results.reduce((accum, currBalance) => {
    Object.keys(currBalance).forEach(key => {
      const foundToken = tokens.find(token => token.symbol === key)
      if (foundToken && currBalance[key]) {
        determineIfBalanceUpdated(
          // $FlowFixMe
          { [foundToken.symbol]: currBalance[key] },
          soundEnabled,
          networkHasChanged,
          adressHasChanged
        )
        // $FlowFixMe
        inMemoryBalances[foundToken.symbol] = currBalance[key]
        accum.push({
          [foundToken.scriptHash]: {
            ...foundToken,
            balance: currBalance[key]
          }
        })
      }
    })
    return accum
  }, [])

  // Handle manually added script hashses here
  const userGeneratedTokenInfo = []
  // eslint-disable-next-line
  for (const token of tokens.filter(
    token => token.isUserGenerated && token.networkId === network.id
  )) {
    // eslint-disable-next-line
    const info = await api.nep5
      .getToken(endpoint, token.scriptHash, address)
      .catch(error => {
        // eslint-disable-next-line
        console.error(
          'An error occurrred attempting to fetch custom script hash balance info.',
          { error }
        )
        return Promise.resolve()
      })
    if (info) {
      userGeneratedTokenInfo.push({
        scriptHash: token.scriptHash,
        ...info
      })
    }
  }
  userGeneratedTokenInfo.forEach(token => {
    determineIfBalanceUpdated(
      { [token.symbol]: token.balance },
      soundEnabled,
      networkHasChanged,
      adressHasChanged
    )
    inMemoryBalances[token.symbol] = token.balance
    parsedTokenBalances.push({
      [token.scriptHash]: {
        ...token
      }
    })
  })

  // asset balances
  const assetBalances = await api
    .getBalanceFrom({ net, address }, api.neoscan)
    .catch(e => console.error(e))

  const assets = get(assetBalances, 'balance.assets', {})
  // The API doesn't always return NEO or GAS keys if, for example, the address only has one asset
  const neoBalance = assets.NEO ? assets.NEO.balance.toString() : '0'
  const gasBalance = assets.GAS
    ? assets.GAS.balance.round(COIN_DECIMAL_LENGTH).toString()
    : '0'
  const parsedAssets = [
    { [ASSETS.NEO]: neoBalance },
    { [ASSETS.GAS]: gasBalance }
  ]
  determineIfBalanceUpdated(
    { [ASSETS.NEO]: neoBalance },
    soundEnabled,
    networkHasChanged,
    adressHasChanged
  )
  inMemoryBalances[ASSETS.NEO] = neoBalance
  determineIfBalanceUpdated(
    { [ASSETS.GAS]: gasBalance },
    soundEnabled,
    networkHasChanged,
    adressHasChanged
  )
  inMemoryBalances[ASSETS.GAS] = gasBalance

  resetAudioTrigger()
  inMemoryNetwork = net
  // $FlowFixMe
  return extend({}, ...parsedTokenBalances, ...parsedAssets)
}

export default createActions(
  ID,
  ({ net, address, tokens }: Props = {}) => async () =>
    getBalances({ net, address, tokens })
)
