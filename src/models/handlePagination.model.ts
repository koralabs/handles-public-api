import { ModelException } from '../exceptions/ModelException';
import { ERROR_TEXT } from '../services/ogmios/constants';
import { isNumeric } from '../utils/util';

export type Sort = 'asc' | 'desc';

export class HandlePaginationModel {
    public page: number;
    public handlesPerPage: number;
    public sort: Sort;

    constructor(handlesPerPage: string = '100', sort: Sort = 'desc', page: string = '1') {
        this.validateHandlePagination(handlesPerPage, sort, page);
        this.handlesPerPage = parseInt(handlesPerPage);
        this.page = parseInt(page);
        this.sort = sort;
    }

    private validateHandlePagination(handlesPerPage: string, sort: Sort, page: string): void {
        if (!isNumeric(handlesPerPage)) {
            throw new ModelException(ERROR_TEXT.HANDLE_LIMIT_INVALID_FORMAT);
        }
        if (parseInt(handlesPerPage) > 1000) {
            throw new ModelException(ERROR_TEXT.HANDLE_LIMIT_EXCEEDED);
        }
        if (!isNumeric(page)) {
            throw new ModelException(ERROR_TEXT.HANDLE_PAGE_INVALID);
        }
        if (!['desc', 'asc'].includes(sort)) {
            throw new ModelException(ERROR_TEXT.HANDLE_SORT_INVALID);
        }
    }

}
