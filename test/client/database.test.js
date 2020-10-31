import mocha from 'mocha';
import chai from 'chai';

import Database from "../../src/client/database/index.js";
import client from "./mockWebSocket.js";
import CollectionReference from "../../src/client/database/collection-reference.js";

const {describe, it, beforeEach} = mocha;
const {expect} = chai;

let database;

beforeEach(() => {
    database = new Database('');
    database.client = client;
    database.connect();
});

describe('Database', () => {
    describe('Web Socket client', () => {
        it('should connect successfully', () => {
            expect(database.client.isConnected()).to.be.equals(true);
        });
    });

    describe('getRef', () => {
        it('should return a CollectionReference', () => {
            let users = database.getRef('users');
            expect(users).to.be.instanceOf(CollectionReference);
        });

        it('should create a new reference if not exists', () => {
            expect(database.refs.size).to.be.equals(0);
            database.getRef('users');
            expect(database.refs.size).to.be.equals(1);
        });

        it('should returns a collection if exists', () => {
            let ref = database.getRef('users');
            expect(database.getRef('users')).to.be.equals(ref);
        });
    });
});