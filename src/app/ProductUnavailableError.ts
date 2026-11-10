/** A requested product has no position the picker can use. */
export class ProductUnavailableError extends Error {
    constructor(productId: string) {
        super(`No pickable position is available for product "${productId}". Check the product ID or its availability.`);
        this.name = "ProductUnavailableError";
    }
}
