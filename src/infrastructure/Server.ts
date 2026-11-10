import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import type { ProductRequest } from "../app/dataModels/ProductRequest.js";
import { InvalidRouteRequestError } from "../app/InvalidRouteRequestError.js";
import { ProductUnavailableError } from "../app/ProductUnavailableError.js";
import type { Controller } from "./Controller.js";
import {ForbiddenError} from "../app/ForbiddenError.js";

export const API_PATH = "/products";

type Handler = Pick<Controller, "postRequest">;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}


export function createApp(controller: Handler): Server {
    return createServer(async (req: IncomingMessage, res: ServerResponse) => {
        // Reject unknown paths and methods before reading any body data.
        if (req.url !== API_PATH) return send(res, 404, "Page not found\n");
        if (req.method !== "POST") {
            return send(res, 405, "This server accepts only a POST method\n", { Allow: "POST" });
        }
        // Invalid JSON is a client error and must not reach the controller.
        let requestBody: unknown;
        try {
            requestBody = JSON.parse(await readBody(req)) as unknown;
        } catch {
            return send(res, 400, "Invalid JSON\n");
        }
        //validate the input body
        let order: ProductRequest;
        try {
            order = parseProductRequest(requestBody);
        } catch (err) {
            if (err instanceof InvalidRouteRequestError) {
                return send(res, 400, { error: err.message });
            }
            throw err;
        }

        // calculate a route, this is what handles the actual logic
        try {
            return send(res, 200, await controller.postRequest(order));
        } catch (err) {
            if (err instanceof InvalidRouteRequestError) {
                return send(res, 400, { error: err.message });
            }
            if (err instanceof ProductUnavailableError) {
                return send(res, 422, { error: err.message });
            }
            if(err instanceof ForbiddenError){
                return send(res,403,{error:err.message})
            }
            console.error(err);
            return send(res, 500, "Internal error\n");
        }
    });
}

// serialize JSON objects,send strings as a plain text.
function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
    const isText = typeof body === "string";
    res.writeHead(status, {
        "Content-Type": isText ? "text/plain" : "application/json",
        ...headers,
    });
    res.end(isText ? body : JSON.stringify(body));
}

// Node delivers request bodies as a stream, so collect its chunks before parsing.
async function readBody(req: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks).toString("utf8");
}


function parseProductRequest(value: unknown): ProductRequest {
    if (!isRecord(value)) throw new InvalidRouteRequestError("Request body must be a JSON object");
    if (
        !Array.isArray(value.products) ||
        value.products.some((product) => typeof product !== "string" || product.trim().length === 0)
    ) {
        throw new InvalidRouteRequestError("products must be an array of non-empty strings");
    }
    if (!isRecord(value.startingPosition)) {
        throw new InvalidRouteRequestError("startingPosition must contain numeric x, y, and z coordinates");
    }

    const { x, y, z } = value.startingPosition;
    if (
        typeof x !== "number" || !Number.isFinite(x) || x < 0 ||
        typeof y !== "number" || !Number.isFinite(y) || y < 0 ||
        typeof z !== "number" || !Number.isFinite(z) || z < 0
    ) {
        throw new InvalidRouteRequestError("startingPosition coordinates must be finite, non-negative numbers");
    }

    return { products: value.products, startingPosition: { x, y, z } };
}
