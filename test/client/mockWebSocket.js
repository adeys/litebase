import sinon from "sinon";

import WebSocketClient from "../../src/client/ws-client.js";

sinon.useFakeTimers();

let client = new WebSocketClient('');

const webSocket = {
    addEventListener: sinon.fake(),
    send: sinon.fake(),
    close: sinon.fake(),
    readyState: 1
};

// Stub connect method
const connectStub = sinon.stub(client, 'connect');
connectStub.callsFake(() => {
    client.socket = webSocket;
    client._configureSocket();
});

// Stub isConnected method
const isConnectedStub = sinon.stub(client, 'isConnected');
isConnectedStub.returns(true);

export default client;