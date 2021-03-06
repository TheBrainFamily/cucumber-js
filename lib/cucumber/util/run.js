var Fiber = require('fibers');
var Promise = global.Promise;

require('meteor-promise').makeCompatible(Promise, Fiber);

var co = require('co');
var util = require('util');
var isGeneratorFn = require('is-generator').fn;

function run(fn, thisArg, argsArray, timeoutInMilliseconds, callback) {
  var Cucumber = require('../../cucumber');
  var timeoutId;

  function finish(error, result) {
    Cucumber.Util.Exception.unregisterUncaughtExceptionHandler(finish);
    if (timeoutId) {
      Cucumber.Util.RealTime.clearTimeout(timeoutId);
    }
    if (error && !(error instanceof Error)) {
      error = util.format(error);
    }
    callback(error, result);
    callback = function() {};
  }

  argsArray.push(finish);

  timeoutId = Cucumber.Util.RealTime.setTimeout(function(){
    finish('function timed out after ' + timeoutInMilliseconds + ' milliseconds');
  }, timeoutInMilliseconds);

  Cucumber.Util.Exception.registerUncaughtExceptionHandler(finish);
  Promise.async(function() {
    var result;
    try {
      if (isGeneratorFn(fn)) {
        result = co.wrap(fn).apply(thisArg, argsArray);
      } else {
        result = fn.apply(thisArg, argsArray);
      }
    } catch (error) {
      return finish(error);
    }

    var callbackInterface = fn.length === argsArray.length;
    var promiseInterface = result && typeof result.then === 'function';
    if (callbackInterface && promiseInterface) {
      finish('function accepts a callback and returns a promise');
    } else if (promiseInterface) {
      result.then(function (result) {
        finish(null, result);
      }, function (error) {
        finish(error || 'Promise rejected');
      });
    } else if (!callbackInterface) {
      finish(null, result);
    }
  })().catch(finish);
}

module.exports = run;
