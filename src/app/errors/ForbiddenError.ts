/** A requested product has no position the picker can use. */
export class ForbiddenError extends Error {
    constructor() {
        super("Warehouse authentication failed");
        this.name = "ForbiddenError";
    }
}
