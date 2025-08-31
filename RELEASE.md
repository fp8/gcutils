# gcutils - Google Cloud Utilities

## 0.5.0 [2025-08-31]

* Changed the package name from `@farport` and `@fp8`, essentially open sourcing this package
* Exposed `createError` helper function
* Added generic support for `Publisher.publishJson` and `Subscriber.listenJson`
* Changed the `fetch` to `fetcher` that uses native `fetch` method
* Removed the unexposed `fetchJson` method
* Added `.getAccessToken` method to `GCloudMetadata` class

#### BREAKING

* `BStore` and `BStoreRx`'s constructor now takes `options` as first param. The `errorHandler`
  is one of the options entry.

## 0.4.0 [2025-08-19]

* Added support for pubsub with `PubSubService`, `Publisher` and `Subscriber`
* Depricated `RxJsRetryError` in favour of `RetryError`
* Updated `retry` to return result from `action` callback

#### BREAKING

* `retry` now will simply return the result of action and retry upon any error.
  In the previous version, retry when the result is undefined or null.

## 0.3.6 [2025-07-12]

* Added GcloudMetadata class

## 0.3.5 [2025-06-24]

* Fixed the package json node version to >=20

## 0.3.4 [2025-06-21]

* Allow createEntity override for FirebaseService methods in addition to the one in the constructore for following methods:
  - `.get`
  - `.getByPath`
  - `.query`
* Improved test coverages

## 0.3.2 [2025-06-18]

* Updated `FirestoreServiceSettings` to accept a `createEntityCallback` to be used by `createEntity` function
* Make `AbstractFirestore.firestore` public readonly
* Make `createCollection`, `createDocument`, `getDocumentRef` and `setDocumentRef` of `AbstractFirestore` public readonly

## 0.3.1 [2025-06-10]

* Renamed `toValidate` to `toSkipValidation` in Firestore.get, getDocumentRef and CreateEntity
* Added a delete method for FirestoreService

## 0.3.0 [2025-03-24]

* Bug fix: The `GCUtilsError` now correctly handle `GaxiosError`

## 0.2.0 [2025-03-23]

### BStore

* Constructor now accept the error handler callback to manage error event of stream operation
* Stream operation no longer throw exception as this will result in node uncaughtException

#### Breaking

* `BStore.createReadableStream` no longer support `attachErrorHandler` arg as caller should
  use error handler callback or listen to error event instead.

## 0.1.0 [2024-04-01]

Initial release helper classes:

* `BStore` with promise interface
* `BStoreRx` with RxJS interface
* `FirestoreService` with promise interface
* `SecretsService` with promise interface
