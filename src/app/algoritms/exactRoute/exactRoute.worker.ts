import { parentPort, workerData } from "node:worker_threads";
import { ExactRouteSolver } from "./ExactRouteSolver.js";
import type { Point } from "../../dataModels/Point.js";
import type { Position } from "../../dataModels/Position.js";
import type { ProductResponse } from "../../dataModels/ProductResponse.js";

type ExactRouteWorkerData = {
    positions: Map<string, Position[]>;
    start: Point;
};

type ExactRouteWorkerMessage =
    | { result: ProductResponse }
    | { error: string };

if (parentPort === null) {
    throw new Error("Exact route worker must have a parent port");
}

try {
    const { positions, start } = workerData as ExactRouteWorkerData;
    const result = new ExactRouteSolver().findShortestPath(positions, start);
    parentPort.postMessage({ result } satisfies ExactRouteWorkerMessage);
} catch (error) {
    const message = error instanceof Error ? error.message : "Exact route calculation failed";
    parentPort.postMessage({ error: message } satisfies ExactRouteWorkerMessage);
} finally {
    parentPort.close();
}
