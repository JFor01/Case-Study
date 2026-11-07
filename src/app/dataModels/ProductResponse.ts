export type ProductResponse = {
    pickingOrder : {
        productId : string,
        positionId : string
    }[],
    distance : number
}