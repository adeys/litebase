export default class Deferred {
    constructor() {
        this.promise = null;
        this.resolve = null;
        this.reject = null;
    }

    wrapCallback(callback) {
        this.promise = new Promise(((resolve, reject) => {
            this.resolve = resolve;
            this.reject = reject;
        }));

        return (err) => {
            try {
                callback(err);
                this.resolve.call(null, err);
            }  catch (e) {
                this.reject.call(null, e);
            }
        };
    }
};
