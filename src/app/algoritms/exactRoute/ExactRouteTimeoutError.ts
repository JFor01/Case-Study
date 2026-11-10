export class ExactRouteTimeoutError extends Error {
    constructor(timeoutMs: number) {
        super(`Exact route search exceeded its ${timeoutMs} ms time limit`);
        this.name = "ExactRouteTimeoutError";
    }
}
