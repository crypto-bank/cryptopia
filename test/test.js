/**
 * Example cryptopia client usage.
 */
import Cryptopia from '../src/index';

// Either pass your API key and secret as the first and second parameters to examples.js. eg
// node examples.js your-api-key your-api-secret
//
// Or enter them below.
// WARNING never commit your API keys into a public repository.
var key = process.argv[2] || 'your-api-key';
var secret = process.argv[3] || 'your-api-secret';

// Test public data APIs
var publicClient = new Cryptopia()
var privateClient = new Cryptopia(key, secret)

publicClient.getCurrencies()
  .catch(err => console.error(err))
  .then((data) => console.log(data))

