/**
 * Cryptopia node.js client.
 *
 * @license MIT
 * @author Shannon Carver
 * @author Łukasz Kurowski <crackcomm@gmail.com>
 */
import util from 'util';
import request from 'request';
import crypto from 'crypto';
import VError from 'verror';
import * as _ from 'underscore';

class Cryptopia {
  constructor(key, secret, hostname, timeout) {
    this.key = key
    this.secret = secret

    this.hostname = hostname || 'www.cryptopia.co.nz'
    this.server = `https://${this.hostname}`
    this.publicApiPath = 'api'
    this.privateApiPath = 'api'

    this.timeout = timeout || 20000
  }

  privateRequest(method, params) {
    const functionName = 'Cryptopia.privateRequest()';
    if (!this.key || !this.secret) {
      return Promise.reject(new VError('%s must provide key and secret to make this API request.', functionName))
    }

    if (!_.isObject(params)) {
      return Promise.reject(new VError('%s second parameter %s must be an object. If no params then pass an empty object {}', functionName, params))
    }

    const md5 = crypto.createHash('md5').update(JSON.stringify(params)).digest().toString('base64');
    const nonce = Math.floor(new Date().getTime() / 1000);
    const url = `${this.server}/${this.privateApiPath}/${method}`;
    const signature = `${this.key}POST${encodeURIComponent(url).toLowerCase()}${nonce}${md5}`;
    const hmacSignature = crypto.createHmac('sha256', new Buffer(this.secret, 'base64')).update(signature).digest().toString('base64');

    const headers = {
      'Authorization': `amx ${this.key}:${hmacSignature}:${nonce}`,
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(JSON.stringify(params)),
      'User-Agent': 'nodejs-7.5-api-client'
    };
    const options = {
      url,
      method: 'POST',
      headers,
      form: JSON.stringify(params)
    };

    const requestDesc = util.format('%s request to url %s with method %s and params %s',
      options.method, url, method, JSON.stringify(params));

    return executeRequest(options, requestDesc)
  }

  publicRequest(method, params) {
    const functionName = 'Cryptopia.publicRequest()';
    if (!_.isObject(params)) {
      return Promise.reject(new VError('%s second parameter %s must be an object. If no params then pass an empty object {}', functionName, params))
    }

    const options = {
      url: `${this.server}/${this.publicApiPath}/${method}`,
      method: 'GET',
      // headers,
      timeout: this.timeout,
      qs: params,
      json: {}        // request will parse the json response into an object
    };

    const requestDesc = util.format('%s request to url %s with parameters %s',
      options.method, options.url, JSON.stringify(params));

    return executeRequest(options, requestDesc)
      .then((resp) => {
        if (resp.Error) {
          throw new Error(resp.Error);
        }
        return resp.Data;
      })
  }

  //
  // Public Functions
  //


  getCurrencies() {
    return this.publicRequest('GetCurrencies/', {})
  }

  getTicker(pair) {
    return this.publicRequest(`GetMarket/${pair}`, { currencyPair: pair })
  }

  getOrderBook(pair, limit) {
    const params = {
      currencyPair: pair,
      limit: 1000,
    };

    if (!_.isUndefined(limit)) params.limit = limit

    return this.publicRequest(`GetMarketOrders/${pair}/${params.limit}`, params)
  }

  getTrades(pair, hours) {
    const params = {
      currencyPair: pair,
      hours: 24,
    };

    if (hours) params.hours = hours

    return this.publicRequest(`GetMarketHistory/${pair}/${params.hours}`, params)
  }

  getKline(symbol, type, size, since) {
    const params = { symbol };
    if (type) params.type = type
    if (size) params.size = size
    if (since) params.since = since

    return this.publicRequest('kline', params)
  }

  getLendDepth(symbol) {
    return this.publicRequest('kline', { symbol })
  }

  //
  // Private Functions
  //

  getBalance() {
    return this.privateRequest('GetBalance', {})
  }

  addTrade(symbol, type, amount, price) {
    const params = {
      symbol,
      type
    };

    if (amount) params.amount = amount
    if (price) params.price = price

    return this.privateRequest('trade', params)
  }

  addBatchTrades(symbol, type, orders) {
    return this.privateRequest('batch_trade', {
      symbol,
      type,
      orders_data: orders
    })
  }

  cancelOrder(symbol, order_id) {
    return this.privateRequest('cancel_order', {
      symbol,
      order_id
    })
  }

  getOrderInfo(symbol, order_id) {
    return this.privateRequest('order_info', {
      symbol,
      order_id
    })
  }

  getOrdersInfo(symbol, type, order_id) {
    return this.privateRequest('orders_info', {
      symbol,
      type,
      order_id
    })
  }

  getAccountRecords(symbol, type, current_page, page_length) {
    return this.privateRequest('account_records', {
      symbol,
      type,
      current_page,
      page_length
    })
  }

  getTradeHistory(symbol, since) {
    return this.privateRequest('trade_history', {
      symbol,
      since
    })
  }

  getOrderHistory(symbol, status, current_page, page_length) {
    return this.privateRequest('order_history', {
      symbol,
      status,
      current_page,
      page_length
    })
  }

  addWithdraw(symbol, chargefee, trade_pwd, withdraw_address, withdraw_amount) {
    return this.privateRequest('withdraw', {
      symbol,
      chargefee,
      trade_pwd,
      withdraw_address,
      withdraw_amount
    })
  }

  cancelWithdraw(symbol, withdraw_id) {
    return this.privateRequest('cancel_withdraw', {
      symbol,
      withdraw_id
    })
  }
}

function executeRequest(options, requestDesc) {
  const functionName = 'Cryptopia.executeRequest()';

  return new Promise((resolve, reject) => {
    request(options, (err, response, data) => {
      let error;
      let returnObject = data;

      if (err) {
        error = new VError(err, '%s failed %s', functionName, requestDesc)
        error.name = err.code
      } else if (response.statusCode < 200 || response.statusCode >= 300) {
        error = new VError('%s HTTP status code %s returned from %s', functionName,
          response.statusCode, requestDesc)
        error.name = response.statusCode
      } else if (options.form) {
        try {
          returnObject = JSON.parse(data)
        }
        catch (e) {
          error = new VError(e, `Could not parse response from server: ${data}`)
        }
      }
      // if json request was not able to parse json response into an object
      else if (options.json && !_.isObject(data)) {
        error = new VError('%s could not parse response from %s\nResponse: %s', functionName, requestDesc, data)
      }

      if (_.has(returnObject, 'error_code')) {
        const errorMessage = mapErrorMessage(returnObject.error_code);

        error = new VError('%s %s returned error code %s, message: "%s"', functionName,
          requestDesc, returnObject.error_code, errorMessage)

        error.name = returnObject.error_code
      }

      if (error) {
        reject(error)
      } else {
        resolve(returnObject)
      }
    })
  })
}

const ERROR_CODES = {
  10000: 'Required parameter can not be null',
  10001: 'Requests are too frequent',
  10002: 'System Error',
  10003: 'Restricted list request, please try again later',
  10004: 'IP restriction',
  10005: 'Key does not exist',
  10006: 'User does not exist',
  10007: 'Signatures do not match',
  10008: 'Illegal parameter',
  10009: 'Order does not exist',
  10010: 'Insufficient balance',
  10011: 'Order is less than minimum trade amount',
  10012: 'Unsupported symbol (not btc_usd or ltc_usd)',
  10013: 'This interface only accepts https requests',
  10014: 'Order price must be between 0 and 1,000,000',
  10015: 'Order price differs from current market price too much',
  10016: 'Insufficient coins balance',
  10017: 'API authorization error',
  10026: 'Loan (including reserved loan) and margin cannot be withdrawn',
  10027: 'Cannot withdraw within 24 hrs of authentication information modification',
  10028: 'Withdrawal amount exceeds daily limit',
  10029: 'Account has unpaid loan, please cancel/pay off the loan before withdraw',
  10031: 'Deposits can only be withdrawn after 6 confirmations',
  10032: 'Please enabled phone/google authenticator',
  10033: 'Fee higher than maximum network transaction fee',
  10034: 'Fee lower than minimum network transaction fee',
  10035: 'Insufficient BTC/LTC',
  10036: 'Withdrawal amount too low',
  10037: 'Trade password not set',
  10040: 'Withdrawal cancellation fails',
  10041: 'Withdrawal address not approved',
  10042: 'Admin password error',
  10100: 'User account frozen',
  10216: 'Non-available API',
  503: 'Too many requests (Http)'
};

/**
 * Maps the Cryptopia error codes to error message
 * @param  {Integer}  error_code   Cryptopia error code
 * @return {String}                error message
 */
function mapErrorMessage(error_code) {
  if (!ERROR_CODES[error_code]) {
    return `Unknown Cryptopia error code: ${error_code}`
  }
  return ERROR_CODES[error_code]
}

export default Cryptopia;
