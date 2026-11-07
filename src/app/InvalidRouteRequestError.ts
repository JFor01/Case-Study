/** Error for invalid fields supplied in a route request. */
export class InvalidRouteRequestError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InvalidRouteRequestError";
    }
}
