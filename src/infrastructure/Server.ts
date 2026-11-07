import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import type { ProductRequest } from "../app/dataModels/ProductRequest.js";
import type { Controller } from "./Controller.js";

export const API_PATH = "/products";


type Handler = Pick<Controller, "postRequest">;

// Objects are serialized as JSON; string bodies are sent as plain text.
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

export function createApp(controller: Handler): Server {
    return createServer(async (req: IncomingMessage, res: ServerResponse) => {
        // Reject unknown paths and methods before reading any body data.
        if (req.url !== API_PATH) return send(res, 404, "Page not found\n");
        if (req.method !== "POST") {
            return send(res, 405, "This server accepts only a POST method\n", { Allow: "POST" });
        }
        // Invalid JSON is a client error and must not reach the controller.
        let order: ProductRequest;
        try {
            order = JSON.parse(await readBody(req)) as ProductRequest;
        } catch {
            return send(res, 400, "Invalid JSON\n");
        }

        // calculate a route. Unexpected errors become a generic server error.
        try {
            return send(res, 200, await controller.postRequest(order));
        } catch (err) {
            console.error(err);
            return send(res, 500, "Internal error\n");
        }
    });
}
