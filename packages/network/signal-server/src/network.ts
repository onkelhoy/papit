import { UUID, generateUUID } from "./util";

type Network = {
    name: string;
    private: boolean;
    host: string;
}

const networks = new Map<UUID, Readonly<Network>>();
function create(network: Network) {
    const id = generateUUID();
    networks.set(id, network);

    return network;
}

export function remove(host: string) {
    Array
        .from(networks.entries())
        .forEach(([id, network]) => {
            if (network.host === host) networks.delete(id);
        });
}

export {
    create as createNetwork,
    remove as removeNetworkByHost,
}