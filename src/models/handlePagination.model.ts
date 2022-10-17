import { ModelException } from '../exceptions/ModelException';
import { isNumeric } from '../utils/util';

export type Sort = 'asc' | 'desc';

export class HandlePaginationModel {
    cursor?: string;
    private _limit: string = '0';
    private _sort: string = 'desc';

    constructor(limit: string, sort: Sort, cursor?: string) {
        this.limit = limit;
        this.sort = sort;
        this.cursor = cursor;
    }

    getLimitNumber() {
        return parseInt(this.limit);
    }

    get limit(): string {
        return this._limit;
    }

    set limit(value: string) {
        if (!isNumeric(value)) {
            throw new ModelException('Limit must be a number');
        }

        if (parseInt(value) > 1000) {
            throw new ModelException('Limit exceeded');
        }

        this._limit = value;
    }

    get sort(): 'asc' | 'desc' {
        return this._sort as 'asc' | 'desc';
    }

    set sort(value) {
        if (!['desc', 'asc'].includes(value)) {
            throw new ModelException('Sort must be desc or asc');
        }

        this._sort = value;
    }
}
