'use strict';

export interface AjaxDataRequest {
    draw: number;
    start: number;
    length: number;
    data: any;
    order: AjaxDataRequestOrder[];
    columns: AjaxDataRequestColumn[];
    search: AjaxDataRequestSearch;
}

export interface AjaxDataRequestSearch {
    value: string;
    regex: boolean;
}

export interface AjaxDataRequestOrder {
    column: number;
    dir: string;
}

export interface AjaxDataRequestColumn {
    data: string | number;
    name: string;
    searchable: boolean;
    orderable: boolean;
    search: AjaxDataRequestSearch;
}

export interface AjaxData {
    draw?: number;
    recordsTotal?: number;
    recordsFiltered?: number;
    data: any;
    error?: string;
}

interface FindParameters {
    [key: string]: object;
}

interface SelectParameters {
    [key: string]: 1;
}

function getSearchableFields(params: AjaxDataRequest): (string | number)[] {
    return params.columns
        .filter((column: AjaxDataRequestColumn) => JSON.parse(String(column.searchable)))
        .map((column: AjaxDataRequestColumn) => column.data);
}

function isNaNorUndefined(...args: any[]) {
    return args.some((arg) => Number.isNaN(arg) || (!arg && arg !== 0));
}

function buildFindParameters(params: AjaxDataRequest): FindParameters | null {
    if (
        !params
        || !params.columns
        || !params.search
        || (!params.search.value && params.search.value !== '')
    ) {
        return null;
    }

    const searchText: string = params.search.value;
    const findParameters: FindParameters = {};
    const searchOrArray: object[] = [];

    if (searchText === '') {
        return findParameters;
    }

    const searchRegex: RegExp = new RegExp(searchText, 'i');

    const searchableFields = getSearchableFields(params);

    if (searchableFields.length === 1) {
        findParameters[searchableFields[0]] = searchRegex;
        return findParameters;
    }

    searchableFields.forEach((field) => {
        const orCondition: any = {};
        orCondition[field] = searchRegex;
        searchOrArray.push(orCondition);
    });

    findParameters.$or = searchOrArray;

    return findParameters;
}

function buildSortParameters(params: AjaxDataRequest): string | number | null {
    if (!params || !Array.isArray(params.order) || params.order.length === 0) {
        return null;
    }

    const sortColumn = Number(params.order[0].column);
    const sortOrder = params.order[0].dir;

    if (
        isNaNorUndefined(sortColumn)
        || !Array.isArray(params.columns)
        || sortColumn >= params.columns.length
    ) {
        return null;
    }

    if (String(params.columns[sortColumn].orderable) === 'false') {
        return null;
    }

    const sortField: string | number = params.columns[sortColumn].data;

    if (!sortField) {
        return null;
    }

    if (sortOrder === 'asc') {
        return sortField;
    }

    return `-${sortField}`;
}

function buildSelectParameters(params: AjaxDataRequest): SelectParameters | null {
    if (!params || !params.columns || !Array.isArray(params.columns)) {
        return null;
    }

    return params.columns
        .map((col) => col.data)
        .reduce((selectParams, field) => ({ ...selectParams, [field]: 1 }), {});
}

function run(Model) {
    return async function runQuery(params: AjaxDataRequest) {
        const draw = Number(params.draw);
        const start = Number(params.start);
        const length = Number(params.length);
        const findParameters = buildFindParameters(params);
        const sortParameters = buildSortParameters(params);
        const selectParameters = buildSelectParameters(params);

        // check params
        if (isNaNorUndefined(draw, start, length)) {
            throw new Error(
                'Some parameters are missing or in a wrong state. '
                + 'Could be any of draw, start or length',
            );
        }
        if (!findParameters || !sortParameters || !selectParameters) {
            throw new Error(
                'Invalid findParameters or sortParameters or selectParameters',
            );
        }

        // fetchRecordsTotal
        const recordsTotal = await Model.estimatedDocumentCount();
        // fetchRecordsFiltered
        const recordsFiltered = await Model.countDocuments(findParameters);

        // run query
        const results = await Model.find(findParameters)
            .select(selectParameters)
            .limit(length)
            .skip(start)
            .sort(sortParameters);

        return {
            draw,
            recordsTotal,
            recordsFiltered,
            data: results,
        };
    };
}

function datatablesQuery(Model) {
    return { run: run(Model) };
}

export default datatablesQuery;
