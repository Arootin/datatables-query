/**
 * Method getSearchableFields
 * Returns an array of fieldNames based on DataTable params object
 * All columns in params.columns that have .searchable == true field will have the .data
 * param returned in an String array. The .data property is used because in angular
 * frontend DTColumnBuilder.newColumn('str') puts 'str' in the
 * data field, instead of the name field.
 * @param params
 * @returns {Array}
 */
function getSearchableFields(params) {
    return params.columns
        .filter((column) => JSON.parse(column.searchable))
        .map((column) => column.data);
}

/**
 * Method isNaNorUndefined
 * Checks if any of the passed params is NaN or undefined.
 * Used to check DataTable's properties draw, start and length
 * @returns {boolean}
 */
function isNaNorUndefined(...args) {
    return args.some((arg) => Number.isNaN(arg) || (!arg && arg !== 0));
}

/**
 * Methdd buildFindParameters
 * Builds a MongoDB find expression based on DataTables param object
 * - If no search text if provided (in params.search.value) an empty object is
 * returned, meaning all data in DB will be returned.
 * - If only one column is searchable (that means, only
 * one params.columns[i].searchable equals true) a normal one field regex MongoDB query
 * is returned, that is {`fieldName`: new Regex(params.search.value, 'i'}
 * - If multiple columns are searchable, an $or MongoDB is returned, that is:
 * ```
 * {
 *     $or: [
 *         {`searchableField1`: new Regex(params.search.value, 'i')},
 *         {`searchableField2`: new Regex(params.search.value, 'i')}
 *     ]
 * }
 * ```
 * and so on.<br>
 * All search are by regex so the field param.search.regex is ignored.
 * @param params DataTable params object
 * @returns {*}
 */
function buildFindParameters(params) {
    if (
        !params
        || !params.columns
        || !params.search
        || (!params.search.value && params.search.value !== '')
    ) {
        return null;
    }

    const searchText = params.search.value;
    const findParameters = {};
    const searchOrArray = [];

    if (searchText === '') {
        return findParameters;
    }

    const searchRegex = new RegExp(searchText, 'i');

    const searchableFields = getSearchableFields(params);

    if (searchableFields.length === 1) {
        findParameters[searchableFields[0]] = searchRegex;
        return findParameters;
    }

    searchableFields.forEach((field) => {
        const orCondition = {};
        orCondition[field] = searchRegex;
        searchOrArray.push(orCondition);
    });

    findParameters.$or = searchOrArray;

    return findParameters;
}

/**
 * Method buildSortParameters
 * Based on DataTable parameters, this method returns a MongoDB ordering parameter
 * for the appropriate field
 * The params object must contain the following properties:
 * order: Array containing a single object
 * order[0].column: A string parseable to an Integer,
 * that references the column index of the reference field
 * order[0].dir: A string that can be either 'asc' for
 * ascending order or 'desc' for descending order
 * columns: Array of column's description object
 * columns[i].data: The name of the field in MongoDB. If the index i is
 * equal to order[0].column, and
 * the column is orderable, then this will be the returned search param
 * columns[i].orderable: A string (either 'true' or 'false') that
 * denotes if the given column is orderable
 * @param params
 * @returns {*}
 */
function buildSortParameters(params) {
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

    if (params.columns[sortColumn].orderable === 'false') {
        return null;
    }

    const sortField = params.columns[sortColumn].data;

    if (!sortField) {
        return null;
    }

    if (sortOrder === 'asc') {
        return sortField;
    }

    return `-${sortField}`;
}

function buildSelectParameters(params) {
    if (!params || !params.columns || !Array.isArray(params.columns)) {
        return null;
    }

    return params.columns
        .map((col) => col.data)
        .reduce((selectParams, field) => ({ ...selectParams, [field]: 1 }), {});
}

/**
 * Run wrapper function
 * Serves only to the Model parameter in the wrapped run function's scope
 * @param {Object} Model Mongoose Model Object, target of the search
 * @returns {function()} the actual run function with Model in its scope
 */
function run(Model) {
    /**
     * Method Run
     * The actual run function
     * Performs the query on the passed Model object, using the DataTable params argument
     * @param {Object} params DataTable params object
     */
    return async function runQuery(params) {
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
        const data = await Model.find(findParameters)
            .select(selectParameters)
            .limit(length)
            .skip(start)
            .sort(sortParameters);

        return {
            draw,
            recordsTotal,
            recordsFiltered,
            data,
        };
    };
}

/**
 * Module datatablesQuery
 * Performs queries in the given Mongoose Model object, following DataTables conventions for
 * search and pagination.
 * The only interesting exported function is `run`. The others are exported only to allow
 * unit testing.
 * @param Model
 * @returns {{run: *}}
 */
function datatablesQuery(Model) {
    return { run: run(Model) };
}

module.exports = datatablesQuery;
