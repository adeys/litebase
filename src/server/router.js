const { match } = require('path-to-regexp');

class Route {
    constructor(path, method, handler) {
        this.path = path;
        this.method = method;
        this.handler = handler;

        this.match = match(this.path, {decode: decodeURIComponent});
    }

    /**
     * @param req
     * @return {Boolean}
     */
    matches(req) {
        let matches = this.match(req.url);

        if (!matches) {
            return false;
        }

        req.params = matches.params;
        return true;
    }

    /**
     * @param method
     * @return {boolean}
     */
    handlesMethod(method) {
        return method === this.method.toUpperCase();
    }
}

class Router {
    constructor() {
        this.routes = [];
        this.dispatch = this.dispatch.bind(this);
    }

    addRoute(path, method, handler) {
        this.routes.push(new Route(path, method, handler));
    }

    all(path, handler) {
        this.addRoute(path, undefined, handler);
    }

    get(path, handler) {
        this.addRoute(path, 'GET', handler);
    }

    post(path, handler) {
        this.addRoute(path, 'POST', handler);
    }

    dispatch(req, res, next) {
        let route;
        let matches = false;

        for (let i = 0; i < this.routes.length; i++) {
            route = this.routes[i];

            if (
                route.matches(req) &&
                (route.method === undefined || route.handlesMethod(req.method))
            ) {
                matches = true;
                break;
            }
        }

        if (!matches) {
            // Route not found
            next({code: 404, message: 'Resource Not Found'});
            return;
        }

        try {
            let handler = route.handler.bind(route);
            handler(req, res, next);
        } catch (e) {
            next(e);
        }
    }
}

module.exports = Router;