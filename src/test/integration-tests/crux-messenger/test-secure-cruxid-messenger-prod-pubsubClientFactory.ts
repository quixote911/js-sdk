import * as chai from "chai";
import sinon from "sinon";
import chaiAsPromised from "chai-as-promised";
import 'mocha';
import {SecureCruxIdMessenger, CertificateManager} from "../../../core/domain-services";
import {BasicKeyManager, CruxNetPubSubClientFactory} from "../../../infrastructure/implementations";
import {InMemoryCruxUserRepository, MockUserStore, patchMissingDependencies} from "../../test-utils";
import {getMockUserBar123CSTestWallet, getMockUserFoo123CSTestWallet} from "../../crux-messenger/utils";

patchMissingDependencies();

chai.use(chaiAsPromised);
chai.should();
const expect = require('chai').expect;


describe('Test Secure Crux Messenger - Prod pubsubClientFactory', function() {
    beforeEach(async function() {
        const HOST = "broker.hivemq.com";
        const PORT = 8000;
        const path = '/mqtt';
        const userStore = new MockUserStore();
        const user1Data = getMockUserFoo123CSTestWallet();
        const user2Data = getMockUserBar123CSTestWallet();
        this.user1Data = user1Data;
        this.user2Data = user2Data;
        userStore.store(user1Data.cruxUser);
        userStore.store(user2Data.cruxUser);
        this.inmemUserRepo = new InMemoryCruxUserRepository(userStore);
        this.pubsubClientFactory = new CruxNetPubSubClientFactory({
            defaultLinkServer: {
                host: HOST,
                port: PORT,
                path: path
            }
        });
    });

    it('Basic Send Receive Test - Prod pubsubClientFactory', function() {
        const testmsg = 'HelloWorld';
        return new Promise(async (resolve, reject) => {
            const user1Messenger = new SecureCruxIdMessenger(this.inmemUserRepo, this.pubsubClientFactory, {
                cruxId: this.user1Data.cruxUser.cruxID,
                keyManager: new BasicKeyManager(this.user1Data.pvtKey)
            });

            const user2Messenger = new SecureCruxIdMessenger(this.inmemUserRepo, this.pubsubClientFactory, {
                cruxId: this.user2Data.cruxUser.cruxID,
                keyManager: new BasicKeyManager(this.user2Data.pvtKey)
            });
            user2Messenger.listen((msg) => {
                expect(msg).equals(testmsg)
                resolve(msg)
            },(err) => {
                reject(err)
            });
            await user1Messenger.send(testmsg, this.user2Data.cruxUser.cruxID);
        });

    });
})
