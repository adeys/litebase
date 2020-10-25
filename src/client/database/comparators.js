export const Comparators = {
    aeq: aeqHelper,
    lt: ltHelper,
    gt: gtHelper
};

function assignIdx(prop1, prop2) {
    let t1, t2;

    switch (prop1) {
        case undefined: t1 = 1; break;
        case null: t1 = 1; break;
        case false: t1 = 3; break;
        case true: t1 = 4; break;
        case "": t1 = 5; break;
        default: t1 = (prop1 === prop1) ? 9 : 0; break;
    }

    switch (prop2) {
        case undefined: t2 = 1; break;
        case null: t2 = 1; break;
        case false: t2 = 3; break;
        case true: t2 = 4; break;
        case "": t2 = 5; break;
        default: t2 = (prop2 === prop2) ? 9 : 0; break;
    }

    return [t1, t2];
}

function aeqHelper(prop1, prop2) {
    let cv1, cv2, t1, t2;

    if (prop1 === prop2) return true;

    // 'falsy' and Boolean handling
    if (!prop1 || !prop2 || prop1 === true || prop2 === true || prop1 !== prop1 || prop2 !== prop2) {
        // dates and NaN conditions (typed dates before serialization)
        [t1, t2] = assignIdx(prop1, prop2);

        // one or both is edge case
        if (t1 !== 9 || t2 !== 9) {
            return (t1 === t2);
        }
    }

    // Handle 'Number-like' comparisons
    cv1 = Number(prop1);
    cv2 = Number(prop2);

    // if one or both are 'number-like'...
    if (cv1 === cv1 || cv2 === cv2) {
        return (cv1 === cv2);
    }

    // not strict equal nor less than nor gt so must be mixed types, convert to string and use that to compare
    cv1 = prop1.toString();
    cv2 = prop2.toString();

    return (cv1 == cv2);
}

/** Helper function for determining 'less-than' conditions for ops, sorting, and binary indices.
 *     In the future we might want $lt and $gt ops to use their own functionality/helper.
 *     Since binary indices on a property might need to index [12, NaN, new Date(), Infinity], we
 *     need this function (as well as gtHelper) to always ensure one value is LT, GT, or EQ to another.
 */
function ltHelper(prop1, prop2, equal) {
    let cv1, cv2, t1, t2;

    // if one of the params is falsy or strictly true or not equal to itself
    // 0, 0.0, "", NaN, null, undefined, not defined, false, true
    if (!prop1 || !prop2 || prop1 === true || prop2 === true || prop1 !== prop1 || prop2 !== prop2) {
        [t1, t2] = assignIdx(prop1, prop2);

        // one or both is edge case
        if (t1 !== 9 || t2 !== 9) {
            return (t1 === t2) ? equal : (t1 < t2);
        }
    }

    // if both are numbers (string encoded or not), compare as numbers
    cv1 = Number(prop1);
    cv2 = Number(prop2);

    if (cv1 === cv1 && cv2 === cv2) {
        if (cv1 < cv2) return true;
        if (cv1 > cv2) return false;
        return equal;
    }

    if (cv1 === cv1 && cv2 !== cv2) {
        return true;
    }

    if (cv2 === cv2 && cv1 !== cv1) {
        return false;
    }

    if (prop1 < prop2) return true;
    if (prop1 > prop2) return false;
    if (prop1 === prop2) return equal;

    // not strict equal nor less than nor gt so must be mixed types, convert to string and use that to compare
    cv1 = prop1.toString();
    cv2 = prop2.toString();

    if (cv1 < cv2) {
        return true;
    }

    if (cv1 === cv2) {
        return equal;
    }

    return false;
}

function gtHelper(prop1, prop2, equal) {
    let cv1, cv2, t1, t2;

    // 'falsy' and Boolean handling
    if (!prop1 || !prop2 || prop1 === true || prop2 === true || prop1 !== prop1 || prop2 !== prop2) {
        [t1, t2] = assignIdx(prop1, prop2);

        // one or both is edge case
        if (t1 !== 9 || t2 !== 9) {
            return (t1 === t2) ? equal : (t1 > t2);
        }
    }

    // if both are numbers (string encoded or not), compare as numbers
    cv1 = Number(prop1);
    cv2 = Number(prop2);
    if (cv1 === cv1 && cv2 === cv2) {
        if (cv1 > cv2) return true;
        if (cv1 < cv2) return false;
        return equal;
    }

    if (cv1 === cv1 && cv2 !== cv2) {
        return false;
    }

    if (cv2 === cv2 && cv1 !== cv1) {
        return true;
    }

    if (prop1 > prop2) return true;
    if (prop1 < prop2) return false;
    if (prop1 === prop2) return equal;

    // not strict equal nor less than nor gt so must be dates or mixed types
    // convert to string and use that to compare
    cv1 = prop1.toString();
    cv2 = prop2.toString();

    if (cv1 > cv2) {
        return true;
    }

    if (cv1 === cv2) {
        return equal;
    }

    return false;
}

/**
 * Operators
 *
 * @type {{$and: Ops.$and, $between: Ops.$between, $gte: (function(*=, *=): boolean), $exists: Ops.$exists, $containsString: (function(*=, *=): boolean|boolean), $or: Ops.$or, $containsAny: Ops.$containsAny, $in: (function(*=, *): boolean), $dteq: (function(*=, *=): boolean), $lte: (function(*=, *=): boolean), $lt: (function(*=, *=): boolean), $contains: Ops.$contains, $where: (function(*=, *): boolean), $eq: (function(*, *): boolean), $gt: (function(*=, *=): boolean), $containsNone: (function(*=, *=): boolean), $aeq: (function(*, *): boolean), $ne: Ops.$ne, $nin: (function(*=, *): boolean), $not: (function(*=, *=, *=): boolean)}}
 */
export const Ops = {
    // comparison operators
    // a is the value in the collection
    // b is the query value
    $eq: function (a, b) {
        return a === b;
    },

    // abstract/loose equality
    $aeq: function (a, b) {
        return a == b;
    },

    $ne: function (a, b) {
        // ecma 5 safe test for NaN
        if (b !== b) {
            // ecma 5 test value is not NaN
            return (a === a);
        }

        return a !== b;
    },
    // date equality / loki abstract equality test
    $dteq: function (a, b) {
        return Comparators.aeq(a, b);
    },

    // loki comparisons: return identical unindexed results as indexed comparisons
    $gt: function (a, b) {
        return Comparators.gt(a, b, false);
    },

    $gte: function (a, b) {
        return Comparators.gt(a, b, true);
    },

    $lt: function (a, b) {
        return Comparators.lt(a, b, false);
    },

    $lte: function (a, b) {
        return Comparators.lt(a, b, true);
    },

    // ex : coll.find({'orderCount': {$between: [10, 50]}});
    $between: function (a, vals) {
        if (a === undefined || a === null) return false;
        return (Comparators.gt(a, vals[0], true) && Comparators.lt(a, vals[1], true));
    },

    $in: function (a, b) {
        return b.indexOf(a) !== -1;
    },

    $inSet: function(a, b) {
        return b.has(a);
    },

    $nin: function (a, b) {
        return b.indexOf(a) === -1;
    },

    $containsString: function (a, b) {
        return (typeof a === 'string') && (a.indexOf(b) !== -1);
    },

    $containsNone: function (a, b) {
        return !LokiOps.$containsAny(a, b);
    },

    $containsAny: function (a, b) {
        let checkFn = containsCheckFn(a);
        if (checkFn !== null) {
            return (Array.isArray(b)) ? (b.some(checkFn)) : (checkFn(b));
        }
        return false;
    },

    $contains: function (a, b) {
        let checkFn = containsCheckFn(a);
        if (checkFn !== null) {
            return (Array.isArray(b)) ? (b.every(checkFn)) : (checkFn(b));
        }
        return false;
    },

    $where: function (a, b) {
        return b(a) === true;
    },

    // field-level logical operators
    // a is the value in the collection
    // b is the nested query operation (for '$not')
    //   or an array of nested query operations (for '$and' and '$or')
    $not: function (a, b, record) {
        return !doQueryOp(a, b, record);
    },

    $and: function (a, b, record) {
        for (let idx = 0, len = b.length; idx < len; idx += 1) {
            if (!doQueryOp(a, b[idx], record)) {
                return false;
            }
        }
        return true;
    },

    $or: function (a, b, record) {
        for (var idx = 0, len = b.length; idx < len; idx += 1) {
            if (doQueryOp(a, b[idx], record)) {
                return true;
            }
        }
        return false;
    },

    $exists: function (a, b) {
        if (b) {
            return a !== undefined;
        } else {
            return a === undefined;
        }
    }
};

function doQueryOp(val, op, record) {
    for (let p in op) {
        if (Object.hasOwnProperty.call(op, p)) {
            return LokiOps[p](val, op[p], record);
        }
    }
    return false;
}

function containsCheckFn(a) {
    if (typeof a === 'string' || Array.isArray(a)) {
        return function (b) {
            return a.indexOf(b) !== -1;
        };
    } else if (typeof a === 'object' && a !== null) {
        return function (b) {
            return Object.hasOwnProperty.call(a, b);
        };
    }
    return null;
}

export default {Comparators, Ops};