# Warehouse Route Optimizer

This service receives a list of products, loads their warehouse positions, and returns a picking order with its total travel distance.

## Run locally

Install dependencies with `npm install`.

To run the app against the configured warehouse API:

```sh
npm start
```
For using this, you need to provide your API key in the environment variable `X_API_KEY` in .env or in terminal.
Otherwise the server won't start.

Run the tests with:

```sh
npm test
```

The server listens on `127.0.0.1:3000`. Example requests are in `http/post-products.http`.
## HTTP API

Send a `POST` request to `/products` with this JSON shape:

```json
{
  "products": ["product-1", "product-2"],
  "startingPosition": { "x": 0, "y": 0, "z": 0 }
}
```

The response contains `pickingOrder` entries with `productId` and `positionId`, plus the total `distance`.

```json
{
  "pickingOrder": [
    { "productId": "product-2", "positionId": "position-202" },
    { "productId": "product-1", "positionId": "position-103" }
  ],
  "distance": 54.2
}
```

## How route selection works

`Optimizer` checks the configured `RouteAlgorithm` strategies in order and uses the first one whose `canHandle` method returns `true`.

The default order is:

1. `ExactRouteAlgorithm` uses dynamic programming to find the shortest route. It runs synchronously and declines requests that exceed its state or transition limits.
2. `NearestNeighborAlgorithm` is the fallback. It is fast and handles any request, but it does not guarantee the globally shortest route.

Both strategies choose one available position for each product. Distance is the sum of 3D legs from the starting point through the picks; the route does not return to the start.

## Add a route algorithm

1. Add a class that implements `RouteAlgorithm` from `src`.
2. Implement `canHandle` as a quick, read-only check. Implement `findShortestPath` for inputs the strategy accepts; it may return a result directly or a promise.
3. Register the new instance in the `Optimizer` constructor's strategy list. The first strategy that can handle a request wins. Keep the always-available nearest-neighbor strategy last unless it should be replaced.

You can also pass a custom strategy list to `new Optimizer([...])`.
