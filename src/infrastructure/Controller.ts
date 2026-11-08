import type { ProductRequest } from "../app/dataModels/ProductRequest.js";
import type { ProductResponse } from "../app/dataModels/ProductResponse.js";
import type { Position } from "../app/dataModels/Position.js";
import type { Service } from "./Service.js";

export interface ControllerConfig {
    baseUrl: string; // this is to mainly handle quick switches from mock to real endpoint
    apiKey: string;
}

export class Controller {
    constructor(
        private readonly service: Pick<Service, "optimizeRoute">,
        private readonly config: ControllerConfig,
    ) {}

    public async postRequest(request: ProductRequest): Promise<ProductResponse> {
        const positions = await Promise.all(
            request.products.map((productId) => this.fetchPositions(productId)),
        );
        return this.service.optimizeRoute(request, positions);
    }

    private async fetchPositions(productId: string): Promise<Position[]> {
        const url = `${this.config.baseUrl}/products/${encodeURIComponent(productId)}/positions`;
        const res = await fetch(url, { headers: { "x-api-key": this.config.apiKey } });
        if (!res.ok) {
            throw new Error(`Positions for ${productId} failed: ${res.status} ${res.statusText}`);
        }
        return (await res.json()) as Position[];
    }
}