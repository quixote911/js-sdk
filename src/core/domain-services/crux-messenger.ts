import {makeUUID4} from "blockstack/lib";
import {create} from "domain";
import {decodeToken, TokenVerifier} from "jsontokens";
import {createNanoEvents, DefaultEvents, Emitter} from "nanoevents";
import {BufferJSONSerializer, CruxId, InMemStorage, StorageService} from "../../packages";
import { ECIESEncryption } from "../../packages/encryption";
import {CruxUser} from "../entities";

import {
    ICruxIdCertificate,
    ICruxIdClaim,
    ICruxUserRepository,
    IKeyManager, IMessageSchema, IProtocolMessage,
    IPubSubClient,
    IPubSubClientFactory,
    ISecurePacket,
} from "../interfaces";

export class CertificateManager {
    public static make = async (idClaim: ICruxIdClaim): Promise<ICruxIdCertificate> => {
        const payload = idClaim.cruxId.toString();
        const signedProof = await idClaim.keyManager.signWebToken(payload);
        return {
                claim: idClaim.cruxId.toString(),
                proof: signedProof,
        };
    }
    public static verify = (certificate: ICruxIdCertificate, senderPubKey: any) => {
        const proof: any = decodeToken(certificate.proof).payload;
        const verified = new TokenVerifier("ES256K", senderPubKey).verify(certificate.proof);
        if (proof && proof === certificate.claim && verified) {
            return true;
        }
        return false;
    }
}

export class EncryptionManager {
    // Use ECIES to encrypt & decrypt
    public static encrypt = async (content: string, pubKeyOfRecipient: string): Promise<string> => {
        // TODO: Handle encoding properly (UTF-8 might not work in all scenarios)
        const toEncrypt = Buffer.from(content, "utf8");
        const encrypted = await ECIESEncryption.encrypt(toEncrypt, pubKeyOfRecipient);
        return BufferJSONSerializer.bufferObjectToJSONString(encrypted);
    }
    public static decrypt = async (encryptedContent: string, keyManager: IKeyManager): Promise<string> => {
        try {
            const decryptedContent = await keyManager.decryptMessage!(encryptedContent);
            return decryptedContent;
        } catch (e) {
            if (e.message === "Bad MAC") {
                throw new Error("Decryption failed");
            }
            throw e;
        }
    }
}

export enum EventBusEventNames {
    newMessage = "newMessage",
    error = "error",
}

export type Listener = ((dataReceived: any, senderId?: CruxId) => void);

export class BaseSocket {
    public socketId: string;
    public type: string;
    public client: IPubSubClient;
    public selfId: CruxId;
    constructor(type: string, client: IPubSubClient, selfId: CruxId) {
        if (!["send", "receive"].includes(type)) {
            throw Error("Type must be send or receive");
        }
        this.type = type;
        this.socketId = `socket:${type}:${makeUUID4()}`;
        this.client = client;
        this.selfId = selfId;
    }
}

export class SendSocket extends BaseSocket {
    public recipientId: CruxId;
    constructor(selfId: CruxId, recipientId: CruxId, client: IPubSubClient) {
        super("send", client, selfId);
        this.recipientId = recipientId;
    }
    public connect = async () => {
        await this.client.connect();
    }
    public send = (data: any) => {
        const recipientTopic = "topic_" + this.recipientId.toString();
        this.client.publish(recipientTopic, data);
    }
}

export class ReceiveSocket extends BaseSocket {
    public isConnected: boolean;
    private emitter: Emitter<DefaultEvents>;
    constructor(selfId: CruxId, client: IPubSubClient) {
        super("receive", client, selfId);
        this.emitter = createNanoEvents();
        this.isConnected = false;
    }
    public connect = async () => {
        const selfTopic = "topic_" + this.selfId;
        await this.client.connect();
        this.isConnected = true;
        return this.client.subscribe(selfTopic, (topic: any, data: any) => {
            console.log("CruxIdMessenger recd msg from pubsubClient", topic, data);
            this.emitter.emit("message", data);
        });
    }
    public receive = (listener: any) => {
        this.emitter.on("message", listener);
    }
}

export class CruxNetwork {
    private clientFactory: IPubSubClientFactory;
    constructor(clientFactory: IPubSubClientFactory) {
        this.clientFactory = clientFactory;
    }

    public getReceiveSocket = (cruxId: CruxId, keyManager: IKeyManager): ReceiveSocket => {
        // TODO: Make clientFactory just deal with making client
        // make CruxNetwork deal with selecting parameters
        const client: IPubSubClient = this.clientFactory.getClient(cruxId, keyManager);
        return new ReceiveSocket(cruxId, client);
    }
    public getSendSocket = (recipientCruxId: CruxId, senderCruxId: CruxId, keyManager: IKeyManager): SendSocket => {
        const client: IPubSubClient = this.clientFactory.getClient(senderCruxId, keyManager, recipientCruxId);
        return new SendSocket(senderCruxId, recipientCruxId, client);
    }
}
// -------

class BaseSecureSocket extends BaseSocket {
    public secureContext: SecureContext;
    constructor(type: string, client: IPubSubClient, secureContext: SecureContext) {
        super(type, client, secureContext.selfIdClaim.cruxId);
        this.secureContext = secureContext;
    }
}

export class SecureSendSocket extends BaseSecureSocket {
    public sendSocket: SendSocket;
    constructor(sendSocket: SendSocket, secureContext: SecureContext) {
        super("send", sendSocket.client, secureContext);
        this.sendSocket = sendSocket;
    }
    public send = async (data: any) => {
        const encryptedSecurePacket = await this.secureContext.processOutgoing(data, this.sendSocket.recipientId);
        await this.sendSocket.connect();
        this.sendSocket.send(encryptedSecurePacket);
    }
}

export class SecureReceiveSocket extends BaseSecureSocket {
    public receiveSocket: ReceiveSocket;
    private emitter: Emitter<DefaultEvents>;
    private processor: (dataReceived: any) => Promise<void>;
    constructor(receiveSocket: ReceiveSocket, secureContext: SecureContext) {
        super("receive", receiveSocket.client, secureContext);
        this.receiveSocket = receiveSocket;
        this.emitter = createNanoEvents();
        this.processor = async (dataReceived: any) => {
            try {
                console.log("SecureReceiveSocket.receiveSocket.receive", dataReceived);
                const securePacket = await this.secureContext.processIncoming(dataReceived);
                console.log("securePacket made", dataReceived);
                this.emitter.emit("newMessage", securePacket.data, securePacket.certificate ? securePacket.certificate.claim : undefined);
            } catch (e) {
                this.emitter.emit("error", e);
            }
        };
        this.receiveSocket.receive(this.processor);
    }
    public receive = (listener: Listener) => {
        console.log("SecureReceiveSocket.receive - adding listener");
        this.emitter.on("newMessage", listener);
    }
    public onError = (handler: any) => {
        this.emitter.on("error", handler);
    }
}

export class SecureCruxNetwork {
    private cruxNetwork: CruxNetwork;
    private secureReceiveSocket?: SecureReceiveSocket;
    private secureContext: SecureContext;
    private emitter: Emitter<DefaultEvents>;
    private selfIdClaim: ICruxIdClaim;
    constructor(cruxUserRepo: ICruxUserRepository, pubsubClientFactory: IPubSubClientFactory, selfIdClaim: ICruxIdClaim) {
        console.log("SecureCruxNetwork Being Constructed for:", selfIdClaim.cruxId);
        this.cruxNetwork = new CruxNetwork(pubsubClientFactory);
        const storage = new InMemStorage();
        this.emitter = createNanoEvents();
        this.secureContext = new SecureContext(storage, selfIdClaim, cruxUserRepo);
        this.selfIdClaim = selfIdClaim;
    }
    public initialize = async () => {
        const receiveSocket = this.cruxNetwork.getReceiveSocket(this.selfIdClaim.cruxId, this.selfIdClaim.keyManager);
        await receiveSocket.connect();
        this.secureReceiveSocket = new SecureReceiveSocket(receiveSocket, this.secureContext);
        this.secureReceiveSocket.receive((msg, senderId) => {
            this.emitter.emit("newMessage", msg, senderId);
        });
        this.secureReceiveSocket.onError((e: any) => {
            this.emitter.emit("error", e);
        });
    }
    public send = async (recipientId: CruxId, data: any) => {
        const sendSocket: SendSocket = this.cruxNetwork.getSendSocket(recipientId, this.secureContext.selfIdClaim.cruxId, this.secureContext.selfIdClaim.keyManager);
        const secureSendSocket: SecureSendSocket = new SecureSendSocket(sendSocket, this.secureContext);
        await secureSendSocket.send(data);
    }
    public receive = (listener: Listener) => {
        this.emitter.on("newMessage", listener);
    }
    public onError = (listener: Listener) => {
        this.emitter.on("error", listener);
    }
}

class SessionStore {
    private storage: StorageService;
    constructor(storage: StorageService) {
        this.storage = storage;
    }
}

export class SecureContext {
    public selfIdClaim: ICruxIdClaim;
    private sessionStore: SessionStore;
    private cruxUserRepo: ICruxUserRepository;
    // Has access to storage and PKI
    constructor(storage: StorageService, selfIdClaim: ICruxIdClaim, cruxUserRepo: ICruxUserRepository) {
        this.selfIdClaim = selfIdClaim;
        this.sessionStore = new SessionStore(storage);
        this.cruxUserRepo = cruxUserRepo;
    }
    public processOutgoing = async (data: any, recipientId: CruxId) => {
        // const secureSessionState = this.sessionStore.getSessionState(recipientId);
        // secureSession.writeMessage(data);
        const certificate = this.selfIdClaim ? await CertificateManager.make(this.selfIdClaim) : undefined;
        const securePacket: ISecurePacket = {
            certificate,
            data,
        };
        const serializedSecurePacket = JSON.stringify(securePacket);

        const recipientCruxUser: CruxUser | undefined = await this.cruxUserRepo.getByCruxId(recipientId);
        if (!recipientCruxUser) {
            throw Error("No Such CRUX User Found");
        }
        return await EncryptionManager.encrypt(serializedSecurePacket, recipientCruxUser.publicKey!);
    }
    public processIncoming = async (dataReceived: string) => {
        let serializedSecurePacket: string;
        try {
            serializedSecurePacket = await EncryptionManager.decrypt(dataReceived, this.selfIdClaim!.keyManager);
        } catch (e) {
            throw e;
        }
        const securePacket: ISecurePacket = JSON.parse(serializedSecurePacket);
        let senderUser: CruxUser | undefined;
        if (securePacket.certificate) {
            senderUser = await this.cruxUserRepo.getByCruxId(CruxId.fromString(securePacket.certificate.claim));
            if (!senderUser) {
                throw new Error("Claimed sender user in certificate does not exist");
            }
            const isVerified = CertificateManager.verify(securePacket.certificate, senderUser.publicKey!);
            if (!isVerified) {
                throw new Error("Could not validate identity");
            }
        }
        return securePacket;
    }
}

// ---------

export class CruxProtocolMessenger {
    private secureMessenger: SecureCruxNetwork;
    private schemaByMessageType: any;
    private emitter: Emitter<DefaultEvents>;

    constructor(secureMessenger: SecureCruxNetwork, protocol: IMessageSchema[]) {
        this.secureMessenger = secureMessenger;
        this.schemaByMessageType = protocol.reduce((newObj, x) => Object.assign(newObj, {[x.messageType]: x.schema}), {});
        // tslint:disable-next-line:no-empty
        this.emitter = createNanoEvents();
        this.secureMessenger.receive((msg: IProtocolMessage, senderId?: CruxId) => {
            this.handleNewMessage(msg, senderId);
        });
        this.secureMessenger.onError((e: Error) => {
            console.log("this.secureMessenger.onError inside CruxProtocolMessenger", e);
            this.emitter.emit("error", e);
        });
    }
    public initialize = async () => {
        return this.secureMessenger.initialize();
    }
    public send = async (message: IProtocolMessage, recipientCruxId: CruxId): Promise<void> => {
        this.validateMessage(message);
        await this.secureMessenger.send(recipientCruxId, message);
    }
    public on = (messageType: string, callback: (data: any, senderId?: CruxId) => void) => {
        this.getSchema(messageType);
        this.emitter.on(messageType, callback);
    }
    public validateMessage = (message: IProtocolMessage): void => {
        const schema = this.getSchema(message.type);
        this.validateContent(message.content, schema);
    }

    private handleNewMessage = (message: IProtocolMessage, senderId?: CruxId) => {
        try {
            this.validateMessage(message);
        } catch (e) {
            this.emitter.emit("error", e);
            return;
        }
        this.emitter.emit(message.type, message.content, senderId);
    }

    private getSchema = (messageType: string): any => {
        const schema = this.schemaByMessageType[messageType];
        if (!schema) {
            throw Error("Did not recognize message type");
        }
        return schema;
    }
    private validateContent = (content: any, schema: any): void => {
        // @ts-ignore
        const result = schema.validate(content);
        if (result.error) {
            throw new Error("Could not validate message as per schema- " + result.error.message);
        }
    }
}
