export class ModelException extends Error {
    public message: string;

    constructor(message: string) {
        super(message);
        this.message = message;
    }
}
