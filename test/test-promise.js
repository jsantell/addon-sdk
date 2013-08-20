/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const { Cc, Cu, Ci } = require('chrome');
const { defer, resolve, reject, all, promised } = require('sdk/core/promise');
const { setTimeout } = require('sdk/timers');
const { prefixURI, name } = require('@loader/options');
const promiseURI = prefixURI + name + '/lib/sdk/core/promise.js';

exports['test all observers are notified'] = function(assert, done) {
  let expected = 'Taram pam param!';
  let deferred = defer();
  let pending = 10, i = 0;

  function resolved(value) {
    assert.equal(value, expected, 'value resolved as expected: #' + pending);
    if (!--pending) done();
  }

  while (i++ < pending) deferred.promise.then(resolved);

  deferred.resolve(expected);
};

exports['test exceptions dont stop notifications'] = function(assert, done) {
  let threw = false, boom = Error('Boom!');
  let deferred = defer();

  let promise2 = deferred.promise.then(function() {
    threw = true;
    throw boom;
  });

  deferred.promise.then(function() {
    assert.ok(threw, 'observer is called even though previos one threw');
    promise2.then(function() {
      assert.fail('should not resolve');
    }, function(reason) {
      assert.equal(reason, boom, 'rejects to thrown error');
      done();
    });
  });

  deferred.resolve('go!');
};

exports['test subsequent resolves are ignored'] = function(assert, done) {
  let deferred = defer();
  deferred.resolve(1);
  deferred.resolve(2);
  deferred.reject(3);

  deferred.promise.then(function(actual) {
    assert.equal(actual, 1, 'resolves to first value');
  }, function() {
    assert.fail('must not reject');
  });
  deferred.promise.then(function(actual) {
    assert.equal(actual, 1, 'subsequent resolutions are ignored');
    done();
  }, function() {
    assert.fail('must not reject');
  });
};

exports['test subsequent rejections are ignored'] = function(assert, done) {
  let deferred = defer();
  deferred.reject(1);
  deferred.resolve(2);
  deferred.reject(3);

  deferred.promise.then(function(actual) {
    assert.fail('must not resolve');
  }, function(actual) {
    assert.equal(actual, 1, 'must reject to first');
  });
  deferred.promise.then(function(actual) {
    assert.fail('must not resolve');
  }, function(actual) {
    assert.equal(actual, 1, 'must reject to first');
    done();
  });
};

exports['test error recovery'] = function(assert, done) {
  let boom = Error('Boom!');
  let deferred = defer();

  deferred.promise.then(function() {
    assert.fail('rejected promise should not resolve');
  }, function(reason) {
    assert.equal(reason, boom, 'rejection reason delivered');
    return 'recovery';
  }).then(function(value) {
    assert.equal(value, 'recovery', 'error handled by a handler');
    done();
  });

  deferred.reject(boom);
};

exports['test error recovery with promise'] = function(assert, done) {
  let deferred = defer();

  deferred.promise.then(function() {
    assert.fail('must reject');
  }, function(actual) {
    assert.equal(actual, 'reason', 'rejected');
    let deferred = defer();
    deferred.resolve('recovery');
    return deferred.promise;
  }).then(function(actual) {
    assert.equal(actual, 'recovery', 'recorvered via promise');
    let deferred = defer();
    deferred.reject('error');
    return deferred.promise;
  }).then(null, function(actual) {
    assert.equal(actual, 'error', 'rejected via promise');
    let deferred = defer();
    deferred.reject('end');
    return deferred.promise;
  }).then(null, function(actual) {
    assert.equal(actual, 'end', 'rejeced via promise');
    done();
  });

  deferred.reject('reason');
};

exports['test propagation'] = function(assert, done) {
  let d1 = defer(), d2 = defer(), d3 = defer();

  d1.promise.then(function(actual) {
    assert.equal(actual, 'expected', 'resolves to expected value');
    done();
  });

  d1.resolve(d2.promise);
  d2.resolve(d3.promise);
  d3.resolve('expected');
};

exports['test chaining'] = function(assert, done) {
  let boom = Error('boom'), brax = Error('braxXXx');
  let deferred = defer();

  deferred.promise.then().then().then(function(actual) {
    assert.equal(actual, 2, 'value propagates unchanged');
    return actual + 2;
  }).then(null, function(reason) {
    assert.fail('should not reject');
  }).then(function(actual) {
    assert.equal(actual, 4, 'value propagates through if not handled');
    throw boom;
  }).then(function(actual) {
    assert.fail('exception must reject promise');
  }).then().then(null, function(actual) {
    assert.equal(actual, boom, 'reason propagates unchanged');
    throw brax;
  }).then().then(null, function(actual) {
    assert.equal(actual, brax, 'reason changed becase of exception');
    return 'recovery';
  }).then(function(actual) {
    assert.equal(actual, 'recovery', 'recovered from error');
    done();
  });

  deferred.resolve(2);
};

exports['test reject'] = function(assert, done) {
  let expected = Error('boom');

  reject(expected).then(function() {
    assert.fail('should reject');
  }, function(actual) {
    assert.equal(actual, expected, 'rejected with expected reason');
  }).then(done);
};

exports['test resolve to rejected'] = function(assert, done) {
  let expected = Error('boom');
  let deferred = defer();

  deferred.promise.then(function() {
    assert.fail('should reject');
  }, function(actual) {
    assert.equal(actual, expected, 'rejected with expected failure');
  }).then(done);

  deferred.resolve(reject(expected));
};

exports['test resolve'] = function(assert, done) {
  let expected = 'value';
  resolve(expected).then(function(actual) {
    assert.equal(actual, expected, 'resolved as expected');
  }).then(done);
};

exports['test promised with normal args'] = function(assert, done) {
  let sum = promised((x, y) => x + y );

  sum(7, 8).then(function(actual) {
    assert.equal(actual, 7 + 8, 'resolves as expected');
    done();
  });
};

exports['test promised with promise args'] = function(assert, done) {
  let sum = promised((x, y) => x + y );
  let deferred = defer();

  sum(11, deferred.promise).then(function(actual) {
    assert.equal(actual, 11 + 24, 'resolved as expected');
    done();
  });

  deferred.resolve(24);
};

exports['test promised error handleing'] = function(assert, done) {
  let expected = Error('boom');
  let f = promised(function() {
    throw expected;
  });

  f().then(function() {
    assert.fail('should reject');
  }, function(actual) {
    assert.equal(actual, expected, 'rejected as expected');
    done();
  });
};

exports['test return promise form promised'] = function(assert, done) {
  let f = promised(function() {
    return resolve(17);
  });

  f().then(function(actual) {
    assert.equal(actual, 17, 'resolves to a promise resolution');
    done();
  });
};

exports['test promised returning failure'] = function(assert, done) {
  let expected = Error('boom');
  let f = promised(function() {
    return reject(expected);
  });

  f().then(function() {
    assert.fail('must reject');
  }, function(actual) {
    assert.equal(actual, expected, 'rejects with expected reason');
    done();
  });
};

/*
 * Changed for compliance in Bug 881047, promises are now always async
 */
exports['test promises are always async'] = function (assert, done) {
  let runs = 0;
  resolve(1).then(val => ++runs);
  assert.equal(runs, 0, 'resolutions are called in following tick');
  done();
};

/*
 * Changed for compliance in Bug 881047, promised's are now non greedy
 */
exports['test promised are not greedy'] = function(assert, done) {
  let runs = 0;
  promised(() => ++runs)();
  assert.equal(runs, 0, 'promised does not run task right away');
  done();
};

exports['test arrays should not flatten'] = function(assert, done) {
  let a = defer();
  let b = defer();

  let combine = promised(function(str, arr) {
    assert.equal(str, 'Hello', 'Array was not flattened');
    assert.deepEqual(arr, [ 'my', 'friend' ]);
  });

  combine(a.promise, b.promise).then(done);


  a.resolve('Hello');
  b.resolve([ 'my', 'friend' ]);
};

exports['test `all` for all promises'] = function (assert, done) {
  all([
    resolve(5), resolve(7), resolve(10)
  ]).then(function (val) {
    assert.equal(
      val[0] === 5 &&
      val[1] === 7 &&
      val[2] === 10
    , true, 'return value contains resolved promises values');
    done();
  }, function () {
    assert.fail('should not call reject function');
  });
};

exports['test `all` aborts upon first reject'] = function (assert, done) {
  all([
    resolve(5), reject('error'), delayedResolve()
  ]).then(function (val) {
    assert.fail('Successful resolve function should not be called');
  }, function (reason) {
    assert.equal(reason, 'error', 'should reject the `all` promise');
    done();
  });

  function delayedResolve () {
    let deferred = defer();
    setTimeout(deferred.resolve, 50);
    return deferred.promise;
  }
};

exports['test `all` with array containing non-promise'] = function (assert, done) {
  all([
    resolve(5), resolve(10), 925
  ]).then(function (val) {
    assert.equal(val[2], 925, 'non-promises should pass-through value');
    done();
  }, function () {
    assert.fail('should not be rejected');
  });
};

exports['test `all` should resolve with an empty array'] = function (assert, done) {
  all([]).then(function (val) {
    assert.equal(Array.isArray(val), true, 'should return array in resolved');
    assert.equal(val.length, 0, 'array should be empty in resolved');
    done();
  }, function () {
    assert.fail('should not be rejected');
  });
};

exports['test `all` with multiple rejected'] = function (assert, done) {
  all([
    reject('error1'), reject('error2'), reject('error3')
  ]).then(function (value) {
    assert.fail('should not be successful');
  }, function (reason) {
    assert.equal(reason, 'error1', 'should reject on first promise reject');
    done();
  });
};

exports['test JSM Load and API'] = function (assert, done) {
  let { Promise } = Cu.import(promiseURI, {});
  testEnvironment(Promise, assert, done);
};

exports['test mozIJSSubScriptLoader exporting'] = function (assert, done) {
  let { Services } = Cu.import('resource://gre/modules/Services.jsm', {});
  let systemPrincipal = Services.scriptSecurityManager.getSystemPrincipal();
  let Promise = new Cu.Sandbox(systemPrincipal);
  let loader = Cc['@mozilla.org/moz/jssubscript-loader;1']
                 .getService(Ci.mozIJSSubScriptLoader);
  loader.loadSubScript(promiseURI, Promise);

  testEnvironment(Promise, assert, done);
};

function testEnvironment ({all, resolve, defer, reject, promised}, assert, done) {
  all([resolve(5), resolve(10), 925]).then(val => {
    assert.equal(val[0], 5, 'promise#all as SubScript works');
    assert.equal(val[1], 10, 'promise#all as SubScript works');
    assert.equal(val[2], 925, 'promise#all as SubScript works');
    return resolve(1000);
  }).then(value => {
    assert.equal(value, 1000, 'promise#resolve as SubScript works');
    return reject('testing reject');
  }).then(null, reason => {
    assert.equal(reason, 'testing reject', 'promise#reject as SubScript works');
    let deferred = defer();
    setTimeout(() => deferred.resolve('\\m/'), 10);
    return deferred.promise;
  }).then(value => {
    assert.equal(value, '\\m/', 'promise#defer as SubScript works');
    return promised(x => x * x)(5);
  }).then(value => {
    assert.equal(value, 25, 'promise#promised as SubScript works');
    done();
  });
};

require("test").run(exports);
