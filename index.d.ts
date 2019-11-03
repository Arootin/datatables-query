import { Model } from 'mongoose';

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

export type getSearchableFields = (params: AjaxDataRequest) => (string | number);

export type isNaNorUndefined = (args: any[]) => boolean;

export type buildFindParameters = (params: AjaxDataRequest) => FindParameters | null;

export type buildSortParameters = (params: AjaxDataRequest) => string | number | null;

export type buildSelectParameters = (params: AjaxDataRequest) => SelectParameters | null;

export type run = (model: Model<any>) => Promise<AjaxData>

export type datatablesQuery = (model: Model<any>) => { run: run}

export default datatablesQuery;
