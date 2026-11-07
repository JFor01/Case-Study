# Warehouse Route Optimizer

This service receives a list of products, loads their warehouse positions, and returns a picking order with its total travel distance.

## How route selection works

`Optimizer` checks the configured `RouteAlgorithm` strategies in order and uses the first one whose `canHandle` method returns `true`.

The default order is:

1. `ExactRouteAlgorithm` uses dynamic programming to find the shortest route. It declines requests that exceed its state or transition limits.
2. `NearestNeighborAlgorithm` is the fallback. It is fast and handles any request, but it does not guarantee the globally shortest route.

Both strategies choose one available position for each product. Distance is the sum of 3D legs from the starting point through the picks; the route does not return to the start.

## Add a route algorithm

1. Add a class that implements `RouteAlgorithm` from `app/algoritms/RouteAlgorithm.ts`.
2. Implement `canHandle` as a quick, read-only check. Implement `findShortestPath` for inputs the strategy accepts.
3. Register the new instance in the `Optimizer` constructor's strategy list. The first strategy that can handle a request wins. Keep the always-available nearest-neighbor strategy last unless it should be replaced.

You can also pass a custom strategy list to `new Optimizer([...])`.

## HTTP API

Send a `POST` request to `/products` with this JSON shape:

```json
{
  "products": ["product-1", "product-2"],
  "startingPosition": { "x": 0, "y": 0, "z": 0 }
}
```

The response contains `pickingOrder` entries with `productId` and `positionId`, plus the total `distance`.

The controller loads positions from the warehouse API. Configure its URL with `WAREHOUSE_API_URL` and its key with `WAREHOUSE_API_KEY`. The default URL is the case-study development API.

## Run locally

Install dependencies with `npm install`.

```sh
npm start
npm test
```

To use the included mock warehouse, run it in one terminal:

```sh
npx tsx mock/warehouseMock.ts
```

Then start the app against it in another terminal:

```sh
WAREHOUSE_API_URL=http://127.0.0.1:4000/case-study npm start
```

The HTTP server listens on `127.0.0.1:3000`. Example requests are in `http/post-products.http`.
