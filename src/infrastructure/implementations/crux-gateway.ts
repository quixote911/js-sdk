// @ts-ignore
import * as StrongPubsubClient from "strong-pubsub";
// @ts-ignore
import * as MqttAdapter from "strong-pubsub-mqtt";
import {CruxGateway} from "../../core/entities";
import {
    ICruxGatewayRepository,
    IGatewayIdentityClaim,
    IGatewayProtocolHandler,
    IPubSubProvider,
} from "../../core/interfaces";
import {CruxId, getRandomHexString} from "../../packages";

// ---------------- SETTING UP PROTOCOL HANDLERS ----------------------------

export class CruxGatewayPaymentsProtocolHandler implements IGatewayProtocolHandler {
    public getName(): string {
        return "CRUX.PAYMENT";
    }

    public validateMessage(gatewayMessage: any): boolean {
        return true;
    }
}

export const getProtocolHandler = (protocolHandlers: any, gatewayProtocol: string): IGatewayProtocolHandler => {
    const protocolHandlerByName: any = {};
    protocolHandlers.forEach( (protocolHandlerClass: any) => {
        const protocolHandlerObj = new protocolHandlerClass();
        protocolHandlerByName[protocolHandlerObj.getName()] = protocolHandlerObj;
    });
    const handler =  protocolHandlerByName[gatewayProtocol];
    if (!handler) {
        throw Error("Unsupported protocol");
    }
    return handler;
};

export interface ICruxGatewayRepositoryRepositoryOptions {
    defaultLinkServer: {
        host: string,
        port: number,
    };
    selfIdClaim?: IGatewayIdentityClaim;
}

export interface IStrongPubSubProviderConfig {
    clientOptions: {
        host: string,
        port: number,
        mqtt: {
            clean: boolean,
            clientId: string,
        },
    };
    subscribeOptions: {
        qos: number,
    };
}

export class StrongPubSubProvider implements IPubSubProvider {
    private client: StrongPubsubClient;
    private config: IStrongPubSubProviderConfig;
    constructor(config: IStrongPubSubProviderConfig) {
        this.config = config;
    }
    public publish(topic: string, data: any): void {
        this.ensureClient();
        this.client.publish(topic, data);
    }
    public subscribe(topic: string, callback: any): void {
        this.ensureClient();
        this.client.subscribe(topic, this.config.subscribeOptions);
        this.client.on("message", callback);
    }
    private connect() {
        this.client = new StrongPubsubClient(this.config.clientOptions, MqttAdapter);
    }
    private ensureClient() {
        if (!this.client) {
            this.connect();
        }
    }
}

export class CruxLinkGatewayRepository implements ICruxGatewayRepository {
    private options: ICruxGatewayRepositoryRepositoryOptions;
    private supportedProtocols: any;
    private selfCruxId?: CruxId;
    private selfClientId: string;
    constructor(options: ICruxGatewayRepositoryRepositoryOptions) {
        this.options = options;
        this.selfCruxId = options.selfIdClaim ? options.selfIdClaim.cruxId : undefined;
        this.selfClientId = "client_" + (this.selfCruxId ? this.selfCruxId.toString() : getRandomHexString(8));
        this.supportedProtocols = [ CruxGatewayPaymentsProtocolHandler ];
    }
    public openGateway(protocol: string): CruxGateway {
        // TODO: override this.options.cruxBridgeConfig as per receiver's config
        const pubsubProvider = new StrongPubSubProvider({
            clientOptions: {
                host: this.options.defaultLinkServer.host,
                port: this.options.defaultLinkServer.port,
                // tslint:disable-next-line:object-literal-sort-keys
                mqtt: {
                    clean: false,
                    clientId: this.selfClientId,
                },
            },
            subscribeOptions: {
                qos: 0,
            },
        });
        const protocolHandler = getProtocolHandler(this.supportedProtocols, protocol);
        return new CruxGateway(pubsubProvider, protocolHandler, this.options.selfIdClaim);
    }

}
