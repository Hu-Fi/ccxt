
//  ---------------------------------------------------------------------------

import Exchange from './abstract/fswap.js';
import { eddsa } from './base/functions/crypto.js';
import { sha256 } from './static_dependencies/noble-hashes/sha256.js';
import { ed25519 } from './static_dependencies/noble-curves/ed25519.js';
import { Balances, Currencies, Dict, Market, MarketInterface, Order, Str, Strings, Ticker, Tickers } from './base/types.js';
import { BadRequest, ExchangeError, ExchangeNotAvailable, InsufficientFunds, InvalidAddress, InvalidOrder } from './base/errors.js';

//  ---------------------------------------------------------------------------

//
// @class fswap
// @augments Exchange
//
export default class fswap extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'fswap',
            'name': 'fswap',
            'rateLimit': 100,
            'certified': false,
            'has': {
                'CORS': undefined,
                'spot': true,
                'margin': false,
                'swap': true,
                'future': false,
                'option': false,
                'cancelOrder': false,
                'createOrder': true,
                'deposit': true,
                'fetchBalance': true,
                'fetchClosedOrders': false,
                'fetchMarkets': true,
                'fetchOpenOrders': false,
                'fetchOrder': true,
                'fetchOrderBook': false,
                'fetchTicker': true,
                'fetchTrades': true,
                'withdraw': true,
            },
            'urls': {
                'logo': 'https://mixin-images.zeromesh.net/A2jrSrBJzt0QA4uxeLVlgt67uaXKt8NvBhGzNeLOxxZfwRMz2FjlcMfmM5ZFoXXiynj_6vzsxZiLVloxW478pIdBnLWBJJ8SJu8y=s256',
                'api': {
                    'fswapPublic': 'https://api.4swap.org/api',
                    'fswapPrivate': 'https://api.4swap.org/api',
                    'mixinPublic': 'https://api.mixin.one',
                    'mixinPrivate': 'https://api.mixin.one',
                },
                'doc': 'https://developers.pando.im/references/4swap/api.html',
            },
            'api': {
                'fswapPublic': {
                    'get': {
                        'info': 1,
                        'assets': 1,
                        'pairs': 1,
                        'cmc/pairs': 1,
                        'stats/markets': 1,
                        'stats/markets/{base}/{quote}': 1,
                        'stats/markets/{base}/{quote}/kline/v2': 1,
                        'transactions/{base}/{quote}': 1,
                    },
                },
                'mixinPublic': {
                    'get': {
                        'network/asset/{asset_id}': 1,
                    },
                },
                'fswapPrivate': {
                    'get': {
                        'orders/{follow_id}': 1,
                        'transactions/{base}/{quote}/mine': 1,
                    },
                    'post': {
                        'actions': 1,
                    },
                },
                'mixinPrivate': {
                    'get': {
                        'safe/snapshots': 1,
                    },
                },
            },
            'fees': {
                'trading': {
                    'taker': this.parseNumber ('0.0030'),
                    'maker': this.parseNumber ('0.0030'),
                },
                'swap': {
                    'taker': this.parseNumber ('0.0030'),
                    'maker': this.parseNumber ('0.0030'),
                },
            },
            'requiredCredentials': {
                'uid': true,        // app_id
                'login': true,      // session_id
                'apiKey': true,     // server_public_key
                'password': true,   // session_private_key
                'privateKey': true, // spend_private_key
                'secret': true,     // oauth_client_secret
            },
            'exceptions': {
                'exact': {
                    '10002': BadRequest,
                    '10006': ExchangeError,
                    '20116': ExchangeError,
                    '20117': InsufficientFunds,
                    '20120': InvalidOrder,
                    '20123': ExchangeError,
                    '20124': InsufficientFunds,
                    '20125': InvalidOrder,
                    '20127': InvalidOrder,
                    '20131': InvalidAddress,
                    '20133': ExchangeError,
                    '20134': InvalidOrder,
                    '20135': InvalidOrder,
                    '20150': InvalidAddress,
                },
                'broad': {
                    'Internal Server Error': ExchangeNotAvailable,
                },
            },
        });
    }

    async fetchMarkets (params = {}): Promise<Market[]> {
        //
        // @method
        // @name fswap#fetchMarkets
        // @description retrieves data on all markets for fswap
        // @see https://developers.pando.im/references/4swap/api.html#read-pairs
        // @param {object} [params] extra parameters specific to the exchange API endpoint
        // @returns {object[]} an array of objects representing market data
        //
        const response = await this.fswapPublicGetCmcPairs (params);
        const data = this.safeValue (response, 'data', {});
        const markets = Object.values (data);
        return this.parseMarkets (markets);
    }

    parseMarket (market: Dict): Market {
        // {
        //   "05c5ac01-31f9-4a69-aa8a-ab796de1d041_31d2ea9c-95eb-3355-b65b-ba096853bc18": {
        //     "base_id": "05c5ac01-31f9-4a69-aa8a-ab796de1d041",
        //     "base_name": "Monero",
        //     "base_symbol": "XMR",
        //     "quote_id": "31d2ea9c-95eb-3355-b65b-ba096853bc18",
        //     "quote_name": "Pando USD",
        //     "quote_symbol": "pUSD",
        //     "last_price": "148.2384060238058983",
        //     "base_volume": "0",
        //     "quote_volume": "0",
        //     "base_value": "924.95",
        //     "quote_value": "970.01",
        //     "volume_24h": "0",
        //     "fee_24h": "0",
        //     "depth_up_2": "9.65",
        //     "depth_down_2": "9.11"
        //   }
        // }
        const baseId = this.safeString (market, 'base_id');
        const quoteId = this.safeString (market, 'quote_id');
        const baseSymbol = this.parseSpecialSymbol (baseId, this.safeString (market, 'base_symbol'));
        const quoteSymbol = this.parseSpecialSymbol (quoteId, this.safeString (market, 'quote_symbol'));
        return {
            'id': baseId + '-' + quoteId,
            'symbol': baseSymbol + '/' + quoteSymbol,
            'base': baseSymbol,
            'quote': quoteSymbol,
            'baseId': baseId,
            'quoteId': quoteId,
            'active': true,
            'type': 'spot',
            'spot': true,
            'margin': false,
            'swap': false,
            'future': false,
            'option': false,
            'contract': false,
            'settle': undefined,
            'settleId': undefined,
            'contractSize': undefined,
            'linear': undefined,
            'inverse': undefined,
            'expiry': undefined,
            'expiryDatetime': undefined,
            'strike': undefined,
            'optionType': undefined,
            'precision': {
                'amount': undefined,
                'price': undefined,
            },
            'limits': {
                'amount': {
                    'min': this.parseNumber (0.0000001),
                    'max': undefined,
                },
                'price': {
                    'min': this.parseNumber (0.0000001),
                    'max': undefined,
                },
            },
            'created': undefined,
            'info': market,
        } as MarketInterface;
    }

    parseSpecialSymbol (tokenId: string, tokenSymbol: string): string {
        // Any asset on Mixin has an unique asset id which is an UUID
        // For different version of stablecoin like USDT, they have the same symbol (USDT)
        // we need this function to parse the symbol to respective version
        switch (tokenId) {
        case '4d8c508b-91c5-375b-92b0-ee702ed2dac5': {
            return 'USDT@ERC20';
        }
        case '218bc6f4-7927-3f8e-8568-3a3725b74361': {
            return 'USDT@POLYGON';
        }
        case 'b91e18ff-a9ae-3dc7-8679-e935d9a4b34b': {
            return 'USDT@TRC20';
        }
        case '9b180ab6-6abe-3dc0-a13f-04169eb34bfa': {
            return 'USDC@ERC20';
        }
        case '80b65786-7c75-3523-bc03-fb25378eae41': {
            return 'USDC@POLYGON';
        }
        case '30e340a7-3284-3f04-8594-fbdd8f2da79f': {
            return 'HMT@ERC20';
        }
        case '235d8ced-3d41-3c2f-8368-7dba52cb9868': {
            return 'HMT@POLYGON';
        }
        case '3e3152d4-6eee-36b3-9685-e8ba54db4a22': {
            return 'JPYC';
        }
        case '0ff3f325-4f34-334d-b6c0-a3bd8850fc06': {
            return 'JPYC-D';
        }
        case 'b7938396-3f94-4e0a-9179-d3440718156f': {
            return 'MATIC@POLYGON';
        }
        case '9682b8e9-6f16-3729-b07b-bc3bc56e5d79': {
            return 'MATIC@ERC20';
        }
        case 'f312d6a7-1b4d-34c0-bf84-75e657a3fcf3': {
            return 'BUSD@Binance';
        }
        case 'cfcd55cd-9f76-3941-81d6-9e7616cc1b83': {
            return 'BUSD@BEP20';
        }
        default: {
            break;
        }
        }
        return tokenSymbol;
    }

    mapAssetIdToSymbol (assetId: string): string {
        const assetMap: { [key: string]: string } = {
            'c94ac88f-4671-3976-b60a-09064f1811e8': 'XIN',
            'f5ef6b5d-cc5a-3d90-b2c0-a2fd386e7a3c': 'BOX',
            'b34633de-4012-38e3-88a9-1f41eafdf45a': 'sXIN-BOX',
            '4d8c508b-91c5-375b-92b0-ee702ed2dac5': 'USDT',
            '9c0e17c2-2997-35d3-9cc5-ca9e63d26167': 'sUSDT-BOX',
            'c6d0c728-2624-429b-8e0d-d9d19b6592fa': 'BTC',
            '132bc08d-40d0-3000-bb6b-0890ee394bab': 'sBTC-XIN',
            'a83cc367-72c5-3418-a2b0-b800d5c65e21': 'sBTC-BOX',
            '00608a54-c563-3e67-8312-80f4471219be': 'sUSDT-XIN',
            '43d61dcd-e413-450d-80b8-101d5e903357': 'ETH',
            '5af5eab5-ff6c-32c8-b555-32671e05f017': 'sETH-XIN',
            'd5e9440c-9aaf-3d2e-8eb8-63b3fc648bc3': 'sETH-BTC',
            '3edb734c-6d6f-32ff-ab03-4eb43640c758': 'PRS',
            '550ad4e2-e9fb-3cb4-92bd-934d75d49556': 'sPRS-XIN',
            '6cfe566e-4aad-470b-8c9a-2fd35b49c68d': 'EOS',
            'a9eafeea-d398-3bc7-8390-29479f438c8a': 'sEOS-XIN',
            'cb29bff4-90a3-3ab1-bff3-8bae433b735c': 'sEOS-BOX',
            '3c0805b2-fdaf-35c6-95af-d7a3f222f910': 'sUSDT-BTC',
            '6eece248-09db-3417-8f70-767896cf5217': 'WGT',
            '06bbb4b9-9006-3439-8d72-ef4b0bdde81e': 'sWGT-XIN',
            '9e0a6c12-f9c0-32b1-a190-8e7b82dd41bf': 'sETH-EOS',
            'b7647205-a04b-3ad3-aaa1-a8f5e8e66894': 'sEOS-BTC',
            'd0e65cba-3507-3b11-82fb-15cfad67a382': 'sPRS-EOS',
            '336d5d97-329c-330d-8e62-2b7c9ba40ea0': 'IQ',
            '6a927361-72da-36e8-939a-f1149e9a6286': 'sIQ-XIN',
            '2566bf58-c4de-3479-8c55-c137bb7fe2ae': 'ONE',
            'f5c24d3c-f0b2-3e3a-aea6-83f9e92335f2': 'sONE-XIN',
            'ef25abf1-72c0-3191-bccd-4532cb8557a4': 'sUSDT-EOS',
            '0d8b8f42-a958-3e66-961f-b59c25b67cc1': 'sIQ-EOS',
            '4c0a42a3-356b-3ae3-a17c-9377646efb04': 'sONE-EOS',
            '758d159f-1727-37f6-95a9-9ad72d5e1ba6': 'sONE-PRS',
            '31d2ea9c-95eb-3355-b65b-ba096853bc18': 'pUSD',
            'fffab09c-180e-3d19-9d49-47d4c4e40878': 'sUSDT-pUSD',
            'b3c2ae8e-c872-30cf-be73-b53494eda708': 'sBOX-pUSD',
            '1195a517-5314-3075-8d96-d6bc88a63e46': 'sBTC-pUSD',
            '5a19cf8e-29c6-3a24-bf4b-da64c458c323': 'sXIN-pUSD',
            '6770a1e5-6086-44d5-b60f-545f9d9e8ffd': 'DOGE',
            'f9cf0db4-30c9-356f-9264-e6ade1a1f021': 'sDOGE-BTC',
            'e1882f66-8fd4-37b3-a763-0ca9667e87c4': 'sDOGE-pUSD',
            '91166b9d-e545-3c6f-89e1-7f1c8bc22fe3': 'sUNI-pUSD',
            '965e5c6e-434c-3fa9-b780-c50f43cd955c': 'CNB',
            '882c5b24-732e-3408-8fae-46a8c9ea73f7': 'sDOGE-CNB',
            'c8772688-c252-3619-8529-9a63fea856bd': 'sCNB-XIN',
            '17f78d7c-ed96-40ff-980c-5dc62fecbc85': 'BNB',
            'bacb5ac8-2dd0-3d0f-aa12-006120cc5d43': 'sBNB-BTC',
            '8e4117c0-5e43-3c2f-81d3-15e3d3ac1b46': 'sBNB-pUSD',
            '83c8bfca-78ee-3845-9e6c-e3d69e7b381c': 'WBTC',
            '159648dc-eba7-3d0e-82ea-06995bee0537': 'sBTC-wBTC',
            'bc129ce0-6231-3a88-94bb-c9353abc24ae': 'sXIN-MOB',
            '4763c636-1d6b-3c74-8cba-17634f0fcad2': 'sETH-pUSD',
            'c996abc9-d94e-4494-b1cf-2a3fd3ac5714': 'ZEC',
            '7708398c-38e3-3aa7-8432-c1af36671f08': 'sXMR-ZEC',
            '1deb43dc-859a-39cf-8d3b-64b6ae479b5f': 'sXMR-XIN',
            '76d340c6-24c2-3111-8d55-90e358b5e02e': 'UQn',
            'b71d3e61-21bd-3a47-9c66-3db7bd1f58a8': 'sUSDT-UQn',
            '990c4c29-57e9-48f6-9819-7d986ea44985': 'SC',
            '6cd674b6-b761-3523-a90b-db3132e8ed7d': 'sSC-XIN',
            'bc5317f4-0dc1-3f19-b6f0-efa45cd6e247': 'sDOGE-UQn',
            '64692c23-8971-4cf4-84a7-4dd1271dd887': 'SOL',
            'e36f8fbb-9da2-327e-a110-7c190e6fa5c9': 'sSOL-EOS',
            '02e808ce-9e22-3dbb-80c7-614bccf039c9': 'sETH-SOL',
            'dcde18b9-f015-326f-b8b1-5b820a060e44': 'SHIB',
            '2c5eaec9-1ed3-3df0-94b1-f8c4a74262b2': 'sDOGE-SHIB',
            'd08f4f8c-f70d-32dc-a491-bd526b7237cb': 'sETH-USDT',
            'bdec3118-656a-3ec7-a397-6e2637a1d7bf': 'AMITUO',
            '1e7e5ac3-5c61-3938-826a-5ec1b6822c5a': 'sXIN-AMITUO',
            '156c76ae-c0a5-397c-aeee-d9fcbedb08bd': 'sMOB-USDT',
            'b80af5fd-85b8-3f00-b7c2-68d2c9f1137a': 'AAVE',
            '842086e5-4a1d-3c2f-85d7-5ae9f424482b': 'sAAVE-pUSD',
            'cb0775b5-76f9-34b5-95ce-d56b61d70b8f': 'sAAVE-BTC',
            'aa189c4c-99ca-39eb-8d96-71a8f6f7218a': 'AKITA',
            '6837adb8-36a2-3172-8f2a-83f9f40e8cf2': 'sDOGE-AKITA',
        };
        return assetMap[assetId] || '';
    }

    async fetchCurrencies (params = {}): Promise<Currencies> {
        //
        // @method
        // @name fswap#fetchCurrencies
        // @description retrieves data on all supported currencies for fswap
        // @see https://developers.pando.im/references/4swap/api.html#read-assets
        // @param {object} [params] extra parameters specific to the exchange API endpoint
        // @returns {object} an associative dictionary of currencies
        //
        const response = await this.fswapPublicGetAssets (params);
        const data = this.safeValue (response, 'data', {});
        const assets = Object.values (data);
        return this.parseCurrencies (assets);
    }

    parseCurrencies (assets: Dict): Currencies {
        const result = {};
        // [
        //   {
        //     "id": "c94ac88f-4671-3976-b60a-09064f1811e8",
        //     "name": "Mixin",
        //     "symbol": "XIN",
        //     "logo": "https://mixin-images.zeromesh.net/UasWtBZO0TZyLTLCFQjvE_UYekjC7eHCuT_9_52ZpzmCC-X-NPioVegng7Hfx0XmIUavZgz5UL-HIgPCBECc-Ws=s128",
        //     "chain_id": "43d61dcd-e413-450d-80b8-101d5e903357",
        //     "chain": {
        //       "id": "43d61dcd-e413-450d-80b8-101d5e903357",
        //       "name": "Ether",
        //       "symbol": "ETH",
        //       "logo": "https://mixin-images.zeromesh.net/zVDjOxNTQvVsA8h2B4ZVxuHoCF3DJszufYKWpd9duXUSbSapoZadC7_13cnWBqg0EmwmRcKGbJaUpA8wFfpgZA=s128",
        //       "chain_id": "43d61dcd-e413-450d-80b8-101d5e903357",
        //       "price": "3468.02",
        //       "tag": "unknown"
        //     },
        //     "price": "165.356218633992",
        //     "display_symbol": "XIN",
        //     "extra": "{\"name\":\"Mixin\",\"explorer\":\"https://mixin.one/snapshots\",\"intro\":{\"en\":[\"Mixin (XIN) is a smart-contract network designed to facilitate peer-to-peer (P2P) transactions with digital assets across blockchains.  Leveraging Directed Acyclic Graph (DAG) and Byzantine Fault-Tolerant protocols, Mixin aspires to help other blockchains achieve trillions of TPS, sub-second final confirmations, zero transaction fees, enhanced privacy, and unlimited extensibility. Mixin Messenger, the first dApp created on Mixin Network, combines Facebook Messenger-like features with a multi-currency mobile wallet. XIN is the native cryptocurrency of the Mixin Network, which also supports BTC, ETH, BCH, ETC, and more.\",\"The Mixin Kernel  now supports 24 blockchains, over 50,000 cryptocurrencies, and all manners of bots.\"],\"zh\":[\"XIN是Mixin平台的唯一代币，总量恒定为1,000,000。Mixin 是一个免费、快速的点对点跨链数字资产交易网络，可帮助其他区块链分布式账本获得超高TPS、亚秒级确认、零手续费、加强隐私、无限扩展的能力。Mixin网络使用PoS + Asynchronous BFT 共识机制，DAG数据储存，通过带惩罚机制的 PoS 去中心化网络，TEE 硬件加固，数万轻节点监督全节点防止作恶。\"]},\"website\":\"https://mixin.one\",\"issue\":\"2017/11/25\",\"total\":\"1000000\",\"circulation\":\"537721\"}",
        //     "tag": "unknown",
        //     "price_change": "0"
        //   }
        // ]
        for (let i = 0; i < assets.length; i++) {
            const asset = assets[i];
            const id = this.safeString (asset, 'id');
            const code = this.safeString (asset, 'symbol');
            const name = this.safeString (asset, 'name');
            const logo = this.safeString (asset, 'logo');
            const chain = this.safeValue (asset, 'chain', {});
            const chainId = this.safeString (chain, 'chain_id');
            const chainName = this.safeString (chain, 'name');
            const chainSymbol = this.safeString (chain, 'symbol');
            const chainLogo = this.safeString (chain, 'logo');
            const chainPrice = this.safeNumber (chain, 'price');
            const chainTag = this.safeString (chain, 'tag');
            const price = this.safeNumber (asset, 'price');
            const extra = this.safeValue (asset, 'extra');
            result[code] = {
                'id': id,
                'code': code,
                'name': name,
                'active': true,
                'precision': 8,
                'logo': logo,
                'chain': {
                    'id': chainId,
                    'name': chainName,
                    'symbol': chainSymbol,
                    'logo': chainLogo,
                    'price': chainPrice,
                    'tag': chainTag,
                },
                'price': price,
                'extra': extra,
                'limits': {
                    'amount': {
                        'min': undefined,
                        'max': undefined,
                    },
                    'withdrawal': {
                        'min': undefined,
                        'max': undefined,
                    },
                },
                'info': asset,
            };
        }
        return result;
    }

    async fetchTicker (symbol: string, params = {}): Promise<Ticker> {
        //
        // @method
        // @name fswap#fetchTicker
        // @description retrieves the ticker data for a specific market on fswap
        // @see https://developers.pando.im/references/4swap/api.html#read-pairs
        // @param {string} symbol unified symbol of the market to fetch the ticker for
        // @param {object} [params] extra parameters specific to the exchange API endpoint
        // @returns {object} a ticker structure
        //
        await this.loadMarkets ();
        const market = this.market (symbol);
        const response = await this.fswapPublicGetCmcPairs (params);
        const pairs = this.safeValue (response, 'data', {}).pairs || [];
        const pair = this.safeValue (pairs, market.id);
        if (!pair) {
            throw new ExchangeError (this.id + ' fetchTicker() could not find pair for symbol: ' + symbol);
        }
        return this.parseTicker (pair, market);
    }

    parseTicker (pair: Dict, market: Market = undefined): Ticker {
        // {
        //   "05c5ac01-31f9-4a69-aa8a-ab796de1d041_31d2ea9c-95eb-3355-b65b-ba096853bc18": {
        //     "base_id": "05c5ac01-31f9-4a69-aa8a-ab796de1d041",
        //     "base_name": "Monero",
        //     "base_symbol": "XMR",
        //     "quote_id": "31d2ea9c-95eb-3355-b65b-ba096853bc18",
        //     "quote_name": "Pando USD",
        //     "quote_symbol": "pUSD",
        //     "last_price": "148.2384060238058983",
        //     "base_volume": "0",
        //     "quote_volume": "0",
        //     "base_value": "924.95",
        //     "quote_value": "970.01",
        //     "volume_24h": "0",
        //     "fee_24h": "0",
        //     "depth_up_2": "9.65",
        //     "depth_down_2": "9.11"
        //   }
        // }
        const last = this.safeNumber (pair, 'last_price');
        const baseVolume = this.safeNumber (pair, 'base_volume');
        const quoteVolume = this.safeNumber (pair, 'quote_volume');
        return {
            'symbol': symbol,
            'timestamp': this.milliseconds (),
            'datetime': this.iso8601 (this.milliseconds ()),
            'high': undefined,
            'low': undefined,
            'bid': undefined,
            'bidVolume': undefined,
            'ask': undefined,
            'askVolume': undefined,
            'vwap': undefined,
            'open': undefined,
            'close': undefined,
            'last': last,
            'previousClose': undefined,
            'change': undefined,
            'percentage': undefined,
            'average': undefined,
            'baseVolume': baseVolume,
            'quoteVolume': quoteVolume,
            'info': pair,
        };
    }

    async fetchBalance (params = {}): Promise<Balances> {
        //
        // @method
        // @name fswap#fetchBalance
        // @description retrieves the balance for a specific account on fswap
        // @see https://developers.mixin.one/docs/api/safe-apis#get-utxo-list
        // @param {object} [params] extra parameters specific to the exchange API endpoint
        // @returns {object} a balance structure
        //
        const response = await this.mixinPrivateGetSafeSnapshots (params);
        const outputs = this.safeValue (response, 'data', []);
        return this.parseBalance (outputs);
    }

    parseBalance (outputs: any): Balances {
        // {
        //   "type": "kernel_output",
        //   "output_id": "77e0c5ba-3e83-3b96-889e-7fdd1066fa85",
        //   "transaction_hash": "8b6a6875ffcc26324a4961312293cd811b40b55f7afbf7244faf6e97016179fc",
        //   "output_index": 0,
        //   "amount": "0.01",
        //   "mask": "86eda37adf63a94e981d26b9e722461a47b709eef73f1c1dd86f6a9c028edb17",
        //   "keys": [
        //       "eb272feb82af89200ef963ce7262e7a2cef8da24048eca29924adc2a4c2a727b"
        //   ],
        //   "senders_hash": "",
        //   "senders_threshold": 0,
        //   "senders": [],
        //   "receivers_hash": "4359debc900a2e3805b7ac06012a5ff93cf90d130fdb0408769aef74587ee3ef",
        //   "receivers_threshold": 1,
        //   "receivers": [
        //       "f6487fa6-57b2-4c0a-9263-b9d9a3a914d8"
        //   ],
        //   "extra": "",
        //   "state": "unspent",
        //   "sequence": 89745,
        //   "created_at": "2023-12-07T10:46:40.930055Z",
        //   "updated_at": "2023-12-07T10:46:40.930055Z",
        //   "signed_by": "",
        //   "signed_at": "0001-01-01T00:00:00Z",
        //   "spent_at": "0001-01-01T00:00:00Z",
        //   "asset_id": "b7938396-3f94-4e0a-9179-d3440718156f",
        //   "signers": null,
        //   "request_id": "",
        //   "kernel_asset_id": "9f5cadff797f241bbe5623ec0a137011b76a6898a7589741cc0e665f7f32a337",
        //   "asset": "9f5cadff797f241bbe5623ec0a137011b76a6898a7589741cc0e665f7f32a337"
        // }

        const balances = outputs.reduce ((acc, output) => {
            const assetId = this.safeString (output, 'asset_id');
            const amount = this.safeNumber (output, 'amount');
            if (!acc[assetId]) {
                acc[assetId] = {
                    'free': 0,
                    'used': 0,
                    'total': 0,
                };
            }
            acc[assetId]['total'] += amount;
            acc[assetId]['free'] += amount;
            return acc;
        }, {} as { [key: string]: { free: number, used: number, total: number } });
        const result: Balances = { 'info': response };
        Object.keys (balances).forEach ((assetId) => {
            const currency = this.safeCurrencyCode (assetId);
            result[currency] = {
                'free': balances[assetId]['free'],
                'used': balances[assetId]['used'],
                'total': balances[assetId]['total'],
            };
        });
        return result;
    }

    async fetchOrder (id: string, symbol: Str = undefined, params = {}): Promise<Order> {
        //
        // @method
        // @name fswap#fetchOrder
        // @description retrieves the details of an order by its ID
        // @see https://developers.pando.im/references/4swap/api.html#get-orders-follow-id
        // @param {string} id the order ID to fetch
        // @param {object} [params] extra parameters specific to the exchange API endpoint
        // @returns {object} an order structure
        //
        const response = await this.fswapPrivateGetOrdersFollowId (
            this.extend ({
                'follow_id': id,
            }, params)
        );
        const order = this.safeValue (response, 'data', {});
        // Example API response:
        // {
        //   "data": {
        //     "id": "87ae5014-d20f-4cf1-b530-8771137e4e0e",
        //     "created_at": "2020-09-15T03:35:34Z",
        //     "user_id": "8017d200-7870-4b82-b53f-74bae1d2dad7",
        //     "state": "Done", // order status Trading/Rejected/Done
        //     ...
        //   }
        // }
        return this.parseOrder (order);
    }

    sign (path, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        //
        // @method
        // @name fswap#sign
        // @description signs the request using the exchange credentials
        // @param {string} path the endpoint path
        // @param {string} [api] the API type ('public' or 'private')
        // @param {string} [method] the HTTP method (default is 'GET')
        // @param {object} [params] extra parameters specific to the exchange API endpoint
        // @param {object} [headers] additional headers for the request
        // @param {string} [body] the body of the request
        // @returns {object} an object containing the signed request data (url, method, body, headers)
        //
        let url = this.urls['api'][api] + '/' + this.implodeParams (path, params);
        if (api === 'private') {
            this.checkRequiredCredentials ();
            const requestID = this.uuid ();
            const jwtToken = this.signAccessToken (method, url, {
                'app_id': this.uid,
                'session_id': this.login,
                'server_public_key': this.apiKey,
                'session_private_key': this.password,
                'spend_private_key': this.privateKey,
                'oauth_client_secret': this.secret,
            }, requestID);
            headers = {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + jwtToken,
                'X-Request-Id': requestID,
            };
            if (method === 'GET') {
                url += '?' + this.urlencode (params);
            } else {
                body = this.json (params);
            }
        } else {
            if (Object.keys (params).length) {
                url += '?' + this.urlencode (params);
            }
        }
        return { url, method, body, headers };
    }

    base64RawURLEncode (raw: Buffer | Uint8Array | string): string {
        return this.urlencodeBase64 (raw);
    }

    signToken (payload: Object, private_key: string): string {
        const header = this.base64RawURLEncode (this.json ({ 'alg': 'EdDSA', 'typ': 'JWT' }));
        const payloadStr = this.base64RawURLEncode (this.json (payload));
        const signData = eddsa (
            header + '.' + payloadStr,
            private_key,
            ed25519
        );
        const sign = this.base64RawURLEncode (signData);
        return header + '.' + payloadStr + '.' + sign;
    }

    signAuthenticationToken (methodRaw: string, uri: string, params = {}, requestID: string = '') {
        const app_id = this.safeString (params, 'app_id');
        const session_id = this.safeString (params, 'session_id');
        const session_private_key = this.safeString (params, 'session_private_key');
        let method = 'GET';
        if (methodRaw) {
            method = methodRaw.toUpperCase ();
        }
        let data = '';
        if (typeof params === 'object') {
            data = this.json (params);
        } else if (typeof params === 'string') {
            data = params;
        }
        const iat = Math.floor (Date.now () / 1000);
        const exp = iat + 3600;
        const sig = this.hash (method + uri + data, sha256, 'hex');
        const payload = {
            'uid': app_id,
            'sid': session_id,
            'iat': iat,
            'exp': exp,
            'jti': requestID,
            'sig': sig,
            'scp': 'FULL',
        };
        return this.signToken (payload, session_private_key);
    }

    signAccessToken (methodRaw: string | undefined, uri: string, params = {}, requestID: string = ''): string {
        const app_id = this.safeString (params, 'app_id');
        if (!app_id) {
            return '';
        }
        return this.signAuthenticationToken (methodRaw, uri, params, requestID);
    }
}
