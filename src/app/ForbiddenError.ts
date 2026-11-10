/** A requested product has no position the picker can use. */
export class ForbiddenError extends Error {
    constructor() {
        super("Access forbidden by the warehouse server, check you X_API_KEY env variable ");
        this.name = "ForbiddenError";
    }
}
