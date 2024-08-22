import { eddsa } from './base/functions.js';
import { Currencies, Market } from './base/types.js';
import { sha256 } from './static_dependencies/noble-hashes/sha256.js';
import { Balances, Exchange, Order, Ticker } from './base/Exchange.js';
import { ed25519 } from './static_dependencies/noble-curves/ed25519.js';
import { BadRequest, ExchangeError, ExchangeNotAvailable, InsufficientFunds, InvalidAddress, InvalidOrder } from './base/errors.js';

export default class fswap extends Exchange {
    describe () {
        return this.deepExtend (super.describe (), {
            'id': 'fswap',
            'name': '4swap',
            'rateLimit': 100,
            'version': 'v1',
            'hostname': 'api.4swap.org',
            'urls': {
                'logo': 'https://mixin-images.zeromesh.net/A2jrSrBJzt0QA4uxeLVlgt67uaXKt8NvBhGzNeLOxxZfwRMz2FjlcMfmM5ZFoXXiynj_6vzsxZiLVloxW478pIdBnLWBJJ8SJu8y=s256',
                'api': {
                    '4swap': 'https://{hostname}/api', // 4swap API base URL
                    'mixin': 'https://api.mixin.one', // Mixin API base URL
                },
                'doc': 'https://developers.pando.im/references/4swap/api.html',
            },
            'has': {
                'fetchMarkets': true,
                'fetchTicker': true,
                'fetchOrderBook': false,
                'fetchTrades': true,
                'fetchBalance': true,
                'createOrder': true,
                'cancelOrder': false,
                'fetchOrder': true,
                'fetchOpenOrders': false,
                'fetchClosedOrders': false,
                'swap': true,
            },
            'api': {
                'public': {
                    'fswap': {
                        'get': {
                            'info': 1,
                            'assets': 1,
                            'pairs': 1,
                            'cmc/pairs': 1,
                            'stats/markets': 1,
                            'stats/markets/{base}/{quote}': 1,
                            'stats/markets/{base}/{quote}/kline/v2': 1,
                            'transactions': 1,
                            'transactions/{base}/{quote}': 1,
                        },
                    },
                },
                'private': {
                    'fswap': {
                        'get': {
                            'orders/{follow_id}': 1,
                            'transactions/{base}/{quote}/mine': 1,
                        },
                        'post': {
                            'actions': 1,
                        },
                    },
                    'mixin': {
                        'get': {
                            'safe/snapshots': 1,
                        },
                    },
                },
            },
            'fees': {
                'trading': {
                    'taker': this.parseNumber ('0.0030'),
                    'maker': this.parseNumber ('0.0030'),
                },
                'spot': {
                    'taker': this.parseNumber ('0.0030'),
                    'maker': this.parseNumber ('0.0030'),
                },
                'stablecoin': {
                    'taker': this.parseNumber ('0.0004'),
                    'maker': this.parseNumber ('0.0004'),
                },
                'swap': {
                    'taker': this.parseNumber ('0.0030'),
                    'maker': this.parseNumber ('0.0030'),
                },
            },
            // Mixin keystore mapped to ccxt credentials
            // {
            //   "app_id": "uid",
            //   "session_id": "login",
            //   "server_public_key": "apiKey",
            //   "session_private_key": "password",
            //   "spend_private_key": "privateKey",
            //   "oauth_client_secret": "secret"
            // }
            'requiredCredentials': {
                'uid': true,
                'login': true,
                'apiKey': true,
                'password': true,
                'privateKey': true,
                'secret': true,
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
        /**
         * @method
         * @name fswap#fetchMarkets
         * @description retrieves data on all markets for fswap
         * @see https://developers.pando.im/references/4swap/api.html#get-pairs
         * @param {object} [params] extra parameters specific to the exchange API endpoint
         * @returns {object[]} an array of objects representing market data
         */
        const response = await this.fswapPublicGetPairs (params);
        const markets = this.safeValue (response, 'data', {});
        const pairs = this.safeValue (markets, 'pairs', []);
        // {
        //   "ts": 1627697766503,
        //   "data": {
        //     "pairs": [
        //       {
        //         "base_id": "05c5ac01-31f9-4a69-aa8a-ab796de1d041",
        //         "quote_id": "31d2ea9c-95eb-3355-b65b-ba096853bc18",
        //         "base_symbol": "XMR",
        //         "quote_symbol": "pUSD",
        //         "last_price": "235.830040473787049",
        //         "base_volume": "1.87552947",
        //         "quote_volume": "439.96755122"
        //       },
        //       ...
        //     ]
        //   }
        // }
        const result = [];
        for (let i = 0; i < pairs.length; i++) {
            const market = pairs[i];
            const baseId = this.safeString (market, 'base_id');
            const quoteId = this.safeString (market, 'quote_id');
            const base = this.safeCurrencyCode (this.safeString (market, 'base_symbol'));
            const quote = this.safeCurrencyCode (this.safeString (market, 'quote_symbol'));
            result.push ({
                'id': baseId + '/' + quoteId,
                'symbol': base + '/' + quote,
                'base': base,
                'quote': quote,
                'baseId': baseId,
                'quoteId': quoteId,
                'precision': {
                    'amount': 8,
                    'price': 8,
                },
                'limits': {
                    'amount': {
                        'min': undefined,
                        'max': undefined,
                    },
                    'price': {
                        'min': undefined,
                        'max': undefined,
                    },
                },
                'info': market,
            });
        }
        return result;
    }

    async fetchCurrencies (params = {}): Promise<Currencies> {
        /**
         * @method
         * @name fswap#fetchCurrencies
         * @description retrieves data on all supported currencies for fswap
         * @see https://developers.pando.im/references/4swap/api.html#get-assets
         * @param {object} [params] extra parameters specific to the exchange API endpoint
         * @returns {object} an associative dictionary of currencies
         */
        const response = await this.fswapPublicGetAssets (params);
        const assets = this.safeValue (response, 'data', {}).assets || [];
        // {
        //   "ts": 1724319058242,
        //   "data": {
        //     "assets": [
        //     {
        //       "id": "c94ac88f-4671-3976-b60a-09064f1811e8",
        //       "name": "Mixin",
        //       "symbol": "XIN",
        //       "logo": "https://mixin-images.zeromesh.net/UasWtBZO0TZyLTLCFQjvE_UYekjC7eHCuT_9_52ZpzmCC-X-NPioVegng7Hfx0XmIUavZgz5UL-HIgPCBECc-Ws=s128",
        //       "chain_id": "43d61dcd-e413-450d-80b8-101d5e903357",
        //       "chain": {
        //       "id": "43d61dcd-e413-450d-80b8-101d5e903357",
        //       "name": "Ether",
        //       "symbol": "ETH",
        //       "logo": "https://mixin-images.zeromesh.net/zVDjOxNTQvVsA8h2B4ZVxuHoCF3DJszufYKWpd9duXUSbSapoZadC7_13cnWBqg0EmwmRcKGbJaUpA8wFfpgZA=s128",
        //       "chain_id": "43d61dcd-e413-450d-80b8-101d5e903357",
        //       "price": "3468.02",
        //       "tag": "unknown"
        //       },
        //       "price": "165.356218633992",
        //       "display_symbol": "XIN",
        //       "extra": "{\"name\":\"Mixin\",\"explorer\":\"https://mixin.one/snapshots\",\"intro\":{\"en\":[\"Mixin (XIN) is a smart-contract network designed to facilitate peer-to-peer (P2P) transactions with digital assets across blockchains."]},\"website\":\"https://mixin.one\",\"issue\":\"2017/11/25\",\"total\":\"1000000\",\"circulation\":\"537721\"}",
        //       "tag": "unknown",
        //       "price_change": "0"
        //     },
        //     ...
        //   }
        // }
        const result = {};
        for (let i = 0; i < assets.length; i++) {
            const asset = assets[i];
            const code = this.safeCurrencyCode (this.safeString (asset, 'symbol'));
            const id = this.safeString (asset, 'id');
            const chain = this.safeValue (asset, 'chain', {});
            result[code] = {
                'id': id,
                'code': code,
                'name': this.safeString (asset, 'name'),
                'active': true,
                'precision': 8,
                'logo': this.safeString (asset, 'logo'),
                'chain': {
                    'id': this.safeString (chain, 'chain_id'),
                    'name': this.safeString (chain, 'name'),
                    'symbol': this.safeString (chain, 'symbol'),
                    'logo': this.safeString (chain, 'logo'),
                    'price': this.safeNumber (chain, 'price'),
                    'tag': this.safeString (chain, 'tag'),
                },
                'price': this.safeNumber (asset, 'price'),
                'extra': this.safeValue (asset, 'extra'),
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
        /**
         * @method
         * @name fswap#fetchTicker
         * @description retrieves the ticker data for a specific market on fswap
         * @see https://developers.pando.im/references/4swap/api.html#get-pairs
         * @param {string} symbol unified symbol of the market to fetch the ticker for
         * @param {object} [params] extra parameters specific to the exchange API endpoint
         * @returns {object} a ticker structure
         */
        await this.loadMarkets ();
        const market = this.market (symbol);
        const response = await this.fswapPublicGetPairs (params);
        const pairs = this.safeValue (response, 'data', {}).pairs || [];
        const pair = this.safeValue (pairs, market.id);
        if (!pair) {
            throw new ExchangeError (this.id + ' fetchTicker() could not find pair for symbol: ' + symbol);
        }
        // Example API response:
        // {
        //   "ts": 1627697766503,
        //   "data": {
        //     "pairs": [
        //       {
        //         "base_id": "05c5ac01-31f9-4a69-aa8a-ab796de1d041",
        //         "quote_id": "31d2ea9c-95eb-3355-b65b-ba096853bc18",
        //         "base_symbol": "XMR",
        //         "quote_symbol": "pUSD",
        //         "last_price": "235.830040473787049",
        //         "base_volume": "1.87552947",
        //         "quote_volume": "439.96755122"
        //       },
        //       ...
        //     ]
        //   }
        // }
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
            'last': this.safeNumber (pair, 'last_price'),
            'previousClose': undefined,
            'change': undefined,
            'percentage': undefined,
            'average': undefined,
            'baseVolume': this.safeNumber (pair, 'base_volume'),
            'quoteVolume': this.safeNumber (pair, 'quote_volume'),
            'info': pair,
        };
    }

    async fetchBalance (params = {}): Promise<Balances> {
        /**
         * @method
         * @name fswap#fetchBalance
         * @description retrieves the balance for a specific account on fswap
         * @see https://developers.pando.im/references/4swap/api.html#get-assets
         * @param {object} [params] extra parameters specific to the exchange API endpoint
         * @returns {object} a balance structure
         */
        const response = await this.fswapPrivateGetBalance (params);
        const balances = this.safeValue (response, 'data', {}).balances || [];
        // Example API response:
        // {
        //   "ts": 1627697766503,
        //   "data": {
        //     "balances": [
        //       {
        //         "asset_id": "c6d0c728-2624-429b-8e0d-d9d19b6592fa",
        //         "free": "100.00",
        //         "used": "50.00",
        //         "total": "150.00"
        //       },
        //       ...
        //     ]
        //   }
        // }
        const result: Balances = { 'info': response };
        for (let i = 0; i < balances.length; i++) {
            const balance = balances[i];
            const currency = this.safeCurrencyCode (balance.asset_id);
            const account = this.account ();
            account.free = this.safeNumber (balance, 'free');
            account.used = this.safeNumber (balance, 'used');
            account.total = this.safeNumber (balance, 'total');
            result[currency] = account;
        }
        return this.safeBalance (result);
    }

    async fetchOrder (id: string, params = {}): Promise<Order> {
        /**
         * @method
         * @name fswap#fetchOrder
         * @description retrieves the details of an order by its ID
         * @see https://developers.pando.im/references/4swap/api.html#get-orders-follow-id
         * @param {string} id the order ID to fetch
         * @param {object} [params] extra parameters specific to the exchange API endpoint
         * @returns {object} an order structure
         */
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

    sign (path: string, api = 'public', method = 'GET', params = {}, headers = undefined, body = undefined) {
        /**
         * @method
         * @name fswap#sign
         * @description signs the request using the exchange credentials
         * @param {string} path the endpoint path
         * @param {string} [api] the API type ('public' or 'private')
         * @param {string} [method] the HTTP method (default is 'GET')
         * @param {object} [params] extra parameters specific to the exchange API endpoint
         * @param {object} [headers] additional headers for the request
         * @param {string} [body] the body of the request
         * @returns {object} an object containing the signed request data (url, method, body, headers)
         */
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
                'Authorization': `Bearer ${jwtToken}`,
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

    isValidUUID (uuid: string): boolean {
        const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return regex.test (uuid);
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
        return [ header, payloadStr, sign ].join ('.');
    }

    signAuthenticationToken (
        methodRaw: string | undefined,
        uri: string,
        params: { [key: string]: any },
        requestID: string
    ): string {
        if (!params.session_id || !this.isValidUUID (params.session_id)) return '';
        let method = 'GET';
        if (methodRaw) method = methodRaw.toUpperCase ();
        let data: string = '';
        if (typeof params === 'object') {
            data = this.json (params);
        } else if (typeof params === 'string') {
            data = params;
        }
        const iat = Math.floor (Date.now () / 1000);
        const exp = iat + 3600;
        const sig = this.hash (method + uri + data, sha256, 'hex');
        const payload = {
            'uid': params.app_id,
            'sid': params.session_id,
            iat,
            exp,
            'jti': requestID,
            sig,
            'scp': 'FULL',
        };
        return this.signToken (payload, params.session_private_key);
    }

    signAccessToken (
        methodRaw: string | undefined,
        uri: string,
        params: { [key: string]: any },
        requestID: string
    ): string {
        if (!this.isValidUUID (params.app_id)) return '';
        return this.signAuthenticationToken (methodRaw, uri, params, requestID);
    }
}
