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
        let data = rawData || {};
        let {_id, meta, ...fields} = data;
        this._key = _id;
        this._meta = meta;
        this._value = rawData !== null ? {...fields} : null;

        this.parent = parent;
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
    set(fields, overwrite = false) {
        if (!this.exists) {
            throw new Error('Cannot perform write operations on non existing document reference');
        }

        this._value = overwrite ? fields : Object.assign(this._value, fields);

        this.parent.update(this.value);
    }

    delete() {
        if (!this.exists) {
            throw new Error('Cannot perform delete operations on non existing document reference');
        }

        this.parent.remove(this._key);
    }
}