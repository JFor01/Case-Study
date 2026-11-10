/** Authentcication from upstream server failed*/
export class ForbiddenError extends Error {
    constructor() {
        super("Warehouse authentication failed");
        this.name = "ForbiddenError";
    }
}
