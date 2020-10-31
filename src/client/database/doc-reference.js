import Deferred from '../utils.js';

/**
 * @private _key
 * @private _meta
 * @private _value
 */
export default class DocumentReference {
    /**
     * @param {*|null} rawData
     * @param {CollectionReference} parent
     */
    constructor(rawData, parent) {
        this._init(rawData);
        this.parent = parent;
    }

    /**
     * @private
     * @param rawData
     */
    _init(rawData) {
        let data = rawData || {};
        let {_id, meta, ...fields} = data;
        this._key = _id;
        this._meta = meta;
        this._value = rawData !== null ? {...fields} : null;
    }

    get meta() {
        return this._meta;
    }

    get key() {
        return this._key;
    }

    getData() {
        return this._value;
    }

    get value() {
        return {_id: this._key, ...this._value};
    }

    get exists() {
        return this._value !== null;
    }

    // Data management
    /**
     * @param {*} fields
     * @param {boolean} merge
     * @return {Promise<void>}
     */
    set(fields, merge = true) {
        if (!this.exists) {
            throw new Error('Cannot perform write operations on non existing document reference');
        }

        this._value = !merge ? fields : Object.assign(this._value, fields);

        let deferred = new Deferred();
        let callback = deferred.wrapCallback(() => {});
        this.parent.update(this.value, callback);

        return deferred.promise;
    }
    /**
     * @return {Promise<void>}
     */
    delete() {
        if (!this.exists) {
            throw new Error('Cannot perform delete operations on non existing document reference');
        }

        let deferred = new Deferred();
        let callback = deferred.wrapCallback(() => {});

        this.parent.remove(this._key, callback);
        this._init(null);

        return deferred.promise;
    }
}