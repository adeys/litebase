export default class DataSnapshot {
    constructor(key, value) {
        this.key = key;
        this.fullData = value;
        let {meta, ...fields} = value;

        this._value = {...fields};
        this._meta = meta;

    }

    getData() {
        return this._value;
    }

    get meta() {
        return this._meta;
    }
}