import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import type { ProductRequest } from "./dataModels/ProductRequest.js";
import type { Controller } from "./Controller.js";

export const API_PATH = "/products";

type Handler = Pick<Controller, "postRequest">;

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
    const isText = typeof body === "string";
    res.writeHead(status, {
        "Content-Type": isText ? "text/plain" : "application/json",
        ...headers,
    });
    res.end(isText ? body : JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks).toString("utf8");
}

export function createApp(controller: Handler): Server {
    return createServer(async (req: IncomingMessage, res: ServerResponse) => {
        if (req.url !== API_PATH) return send(res, 404, "Page not found\n");
        if (req.method !== "POST") {
            return send(res, 405, "This server accepts only a POST method\n", { Allow: "POST" });
        }

        let order: ProductRequest;
        try {
            order = JSON.parse(await readBody(req)) as ProductRequest;
        } catch {
            return send(res, 400, "Invalid JSON\n");
        }

        try {
            return send(res, 200, await controller.postRequest(order));
        } catch (err) {
            console.error(err);
            return send(res, 500, "Internal error\n");
        }
    });
}
