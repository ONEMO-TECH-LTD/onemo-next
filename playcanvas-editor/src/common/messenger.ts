import { Events } from '@playcanvas/observer';

/**
 * No-op transport replacing PlayCanvas cloud WebSocket messenger.
 * Collaboration events never fire; api.globals.messenger remains wired for type compatibility.
 */
class Messenger extends Events {
    private _url = '';

    constructor() {
        super();
    }

    get isConnected() {
        return false;
    }

    get isAuthenticated() {
        return false;
    }

    connect(_url: string) {
        this._url = _url;
    }

    reconnect() {}

    authenticate(_accessToken: string, _type: string) {}

    send(_msg: { name: string; [key: string]: unknown }) {}

    close(_args?: { code?: number; reason?: string }) {}

    projectWatch(_id: string) {}

    projectUnwatch(_id: string) {}

    organizationWatch(_id: string) {}

    organizationUnwatch(_id: string) {}
}

export { Messenger };
