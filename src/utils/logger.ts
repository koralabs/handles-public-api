export enum LogCategory {
    ERROR = 'ERROR',
    INFO = 'INFO'
}

export class Logger {
    static log(message: string, category: LogCategory = LogCategory.INFO) {
        console.log(message, category);
    }
}
