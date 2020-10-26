import {Comparators, Ops} from './comparators.js';
import DocumentReference from "./doc-reference.js";

const Utils = {
    getIn: function (object, path, usingDotNotation) {
        if (object == null) {
            return undefined;
        }
        if (!usingDotNotation) {
            return object[path];
        }

        if (typeof (path) === "string") {
            path = path.split(".");
        }

        if (!Array.isArray(path)) {
            throw new Error("path must be a string or array. Found " + typeof (path));
        }

        var index = 0,
            length = path.length;

        while (object != null && index < length) {
            object = object[path[index++]];
        }
        return (index && index === length) ? object : undefined;
    }
};

function sortHelper(prop1, prop2, desc) {
    if (Comparators.aeq(prop1, prop2)) return 0;

    if (Comparators.lt(prop1, prop2, false)) {
        return (desc) ? (1) : (-1);
    }

    if (Comparators.gt(prop1, prop2, false)) {
        return (desc) ? (-1) : (1);
    }

    // not lt, not gt so implied equality-- date compatible
    return 0;
}

/**
 * @private filtered
 * @private isInitialized
 * @private hasLimitFilter
 */
export default class ResultSet {
    /**
     * @param {Collection} collection
     */
    constructor(collection) {
        this.collection = collection;
        this.filtered = [];

        this.isInitialized = false;
        this.hasLimitFilter = false;
    }

    get() {
        let data = this.collection.data;

        // if this has no filters applied, just return collection.data
        if (!this.isInitialized) {
            if (this.filtered.length === 0) {
                return data.slice();
            } else {
                // filtered must have been set manually, so use it
                this.isInitialized = true;
            }
        }

        let fr = this.filtered;
        let len = fr.length;

        let result = [];

        for (let i = 0; i < len; i++) {
            // Clone record to prevent direct modification
            result.push(new DocumentReference({...data[fr[i]]}, this.collection.ref));
        }

        return result;
    }

    update(updateFunc) {
        if (!updateFunc || (typeof updateFunc !== 'function')) {
            throw new TypeError('Argument is not a function');
        }

        if (!this.isInitialized && this.filtered.length === 0) {
            this.filtered = Array.from(this.collection.data.keys());
        }

        let length = this.filtered.length,
            data = this.collection.data;

        for (let i = 0; i < length; i++) {
            let item = data[this.filtered[i]];
            updateFunc(item);
            this.collection.update(item);
        }

        return this;
    }

    remove() {
        if (!this.isInitialized && this.filtered.length === 0) {
            this.filtered = Array.from(this.collection.data.keys());
        }

        let length = this.filtered.length,
            data = this.collection.data();
        for (let i = 0; i < length; i++) {
            this.collection.remove(data[this.filtered[i]]);
        }

        this.filtered = [];
    }

    where(criteria, firstOnly = false) {
        if (this.collection.data.length === 0) {
            this.filtered = [];
            this.isInitialized = true;
            return this;
        }

        let queryObject = criteria || 'getAll',
            property,
            queryObjectOp,
            obj,
            operator,
            value,
            key,
            searchByIndex = false,
            result = [],
            filters = [];

        // flag if this was invoked via findOne()
        firstOnly = firstOnly || false;

        // Transform in $and query
        if (typeof queryObject === 'object') {
            for (let p in queryObject) {
                obj = {};
                obj[p] = queryObject[p];
                filters.push(obj);

                if (Object.hasOwnProperty.call(queryObject, p)) {
                    property = p;
                    queryObjectOp = queryObject[p];
                }
            }
            // if more than one expression in single query object,
            // convert implicit $and to explicit $and
            if (filters.length > 1) {
                return this.where({ '$and': filters }, firstOnly);
            }
        }

        // apply no filters if they want all
        if (!property || queryObject === 'getAll') {
            if (firstOnly) {
                if (this.isInitialized) {
                    this.filtered = this.filtered.slice(0, 1);
                } else {
                    this.filtered = (this.collection.data.length > 0) ? [0] : [];
                    this.isInitialized = true;
                }
            }

            return this;
        }

        // injecting $and and $or expression tree evaluation here.
        if (property === '$and' || property === '$or') {
            this[property](queryObjectOp);

            // for chained find with firstonly,
            if (firstOnly && this.filtered.length > 1) {
                this.filtered = this.filtered.slice(0, 1);
            }

            return this;
        }

        // see if query object is in shorthand mode (assuming eq operator)
        if (queryObjectOp === null || (typeof queryObjectOp !== 'object' || queryObjectOp instanceof Date)) {
            operator = '$eq';
            value = queryObjectOp;
        } else if (typeof queryObjectOp === 'object') {
            for (key in queryObjectOp) {
                if (Object.hasOwnProperty.call(queryObjectOp, key)) {
                    operator = key;
                    value = queryObjectOp[key];
                    break;
                }
            }
        } else {
            throw new Error('Do not know what you want to do.');
        }

        // opportunistically speed up $in searches from O(n*m) to O(n*log m)
        if (!searchByIndex && operator === '$in' && Array.isArray(value) && typeof Set !== 'undefined') {
            value = new Set(value);
            operator = '$inSet';
        }

        // the comparison function
        const fun = Ops[operator];

        let t = this.collection.data;
        // filter data length
        let i, len;

        // Query executed differently depending on :
        //    - whether the property being queried has an index defined
        //    - if chained, we handle first pass differently for initial filteredrows[] population
        //
        // For performance reasons, each case has its own if block to minimize in-loop calculations

        let filter, record;

        // If the filteredrows[] is already initialized, use it
        if (this.isInitialized) {
            filter = this.filtered;
            len = filter.length;
            let rowId;

            for (i = 0; i < len; i++) {
                rowId = filter[i];
                record = t[rowId];
                if (fun(record[property], value, record)) {
                    result.push(rowId);
                    if (firstOnly) {
                        this.filtered = result;
                        return this;
                    }
                }
            }
        }
        // first chained query so work against data[] but put results in filteredrows
        else {
            len = t.length;
            for (i = 0; i < len; i++) {
                record = t[i];

                if (fun(record[property], value, record)) {
                    result.push(i);
                    if (firstOnly) {
                        this.filtered = result;
                        this.isInitialized = true;
                        return this;
                    }
                }
            }
        }

        this.filtered = result;
        this.isInitialized = true; // next time work against filtered[]
        return this;
    }

    /**
     * @private
     * @param {Array} expressionArray
     * @return {ResultSet}
     */
    $and(expressionArray) {
        // we have already implementing method chaining in this (our Resultset class)
        // so lets just progressively apply user supplied and filters
        for (let i = 0, len = expressionArray.length; i < len; i++) {
            if (this.count() === 0) {
                return this;
            }
            this.where(expressionArray[i]);
        }
        return this;
    }

    /**
     * @private
     * @param {Array} expressionArray
     * @return {ResultSet}
     */
    $or(expressionArray) {
        let fr = null,
            docset = [],
            idxset = [],
            idx = 0;

        // If filter is already initialized, then we query against only those items already in filter.
        // This means no index utilization for fields, so hopefully its filtered to a smallish filtered.
        for (let ei = 0, elen = expressionArray.length; ei < elen; ei++) {
            // we need to branch existing query to run each filter separately and combine results
            fr = this.branch().find(expressionArray[ei]).filtered;
            let frlen = fr.length;

            // add any document 'hits'
            for (let fri = 0; fri < frlen; fri++) {
                idx = fr[fri];
                if (idxset[idx] === undefined) {
                    idxset[idx] = true;
                    docset.push(idx);
                }
            }
        }

        this.filtered = docset;
        this.isInitialized = true;

        return this;
    }
    
    count() {
        return this.isInitialized
            ? this.filtered.length
            : this.collection.data.length;
    }

    branch() {
        let result = new Resultset(this.collection);

        if (this.filtered.length > 0) {
            result.filteredrows = this.filtered.slice();
        }
        result.filterInitialized = this.isInitialized;

        return result;
    }

    filter(filterCallback) {
        this.filtered = this.filtered.filter(key => {
            let child = this.collection.data[key];
            return !!filterCallback(child);
        });

        return this;
    }

    limitToFirst(limit) {
        if (typeof limit !== 'number' || limit < 0) {
            throw new TypeError('ResultSet.limitToFirst argument must be a positive number.');
        }

        if (this.hasLimitFilter) {
            throw new Error('ResultSet.limitToFirst or ResultSet.limitToLast has been previously called. Limit result twice is not supported.');
        }

        this.hasLimitFilter = true;

        limit = Math.floor(limit);
        this.filtered = this.filtered.slice(0, limit);
        return this;
    }

    limitToLast(limit) {
        if (typeof limit !== 'number' || limit < 0) {
            throw new TypeError('ResultSet.limitToLast argument must be a positive number.');
        }

        if (this.hasLimitFilter) {
            throw new Error('ResultSet.limitToFirst or ResultSet.limitToLast has been previously called. Limit result twice is not supported.');
        }
        this.hasLimitFilter = true;

        limit = Math.floor(limit);
        let len = this.filtered.length;
        this.filtered = this.filtered.slice(len < limit ? 0 : len - limit);
        return this;
    }

    /**
     * @param {string} key
     * @param {boolean} desc
     */
    orderBy(key, desc = true) {
        if (!this.isInitialized) {
            this.isInitialized = true;
            this.filtered = Array.from(this.collection.data.keys());
        }

        // otherwise use loki sort which will return same results if column is indexed or not
        const wrappedComparer =
            (function (prop, desc, data) {
                let val1, val2, arr;
                return function (a, b) {
                    if (~prop.indexOf('.')) {
                        arr = prop.split('.');
                        val1 = Utils.getIn(data[a], arr, true);
                        val2 = Utils.getIn(data[b], arr, true);
                    } else {
                        val1 = data[a][prop];
                        val2 = data[b][prop];
                    }
                    return sortHelper(val1, val2, desc);
                };
            })(key, desc, this.collection.data);

        this.filtered.sort(wrappedComparer);

        return this;
    }
}