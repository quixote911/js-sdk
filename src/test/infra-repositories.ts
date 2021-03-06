import { expect } from 'chai';
import sinon from "sinon";
import 'mocha';
import { BlockstackCruxDomainRepository } from "../infrastructure/implementations/blockstack-crux-domain-repository";
import { BlockstackCruxUserRepository } from "../infrastructure/implementations/blockstack-crux-user-repository";
import { CruxSpec } from "../core/entities/crux-spec";
import { CruxDomainId, CruxId } from "../packages/identity-utils";
import { DomainRegistrationStatus, CruxDomain } from '../core/entities/crux-domain';
import { BasicKeyManager } from '../infrastructure/implementations/basic-key-manager';
import * as blkStkService from "../infrastructure/services/blockstack-service";
import * as gs from "../infrastructure/services/gaia-service";
import { CruxUser, SubdomainRegistrationStatus, SubdomainRegistrationStatusDetail } from '../core/entities/crux-user';
import WebCrypto from "node-webcrypto-ossl";
import {getCruxdevCruxDomain, CustomMatcher, patchMissingDependencies} from './test-utils';

patchMissingDependencies()

describe('Infrastructure Repositories Test', () => {
    let sandbox: sinon.SinonSandbox;
    let mockBlockstackService;
    let mockGaiaService;
    let staticMocksBlockstackService;
    let staticMocksGaiaService;
    // fixtures
    const cruxdevRegistrationStatus = DomainRegistrationStatus.REGISTERED;
    const cruxdevAssetMapping = {};
    const cruxdevAssetList = [];
    const cruxdevClientConfig = {
        assetMapping: cruxdevAssetMapping,
        assetList: cruxdevAssetList,
    }
    const cruxdevClientConfigJson = {
        "payload": {
            "issuer": {
                "publicKey": "03c2156930598a7e4832ebb8b435abcc657b1f14b7953b2145ae25268dd6141c1f"
            },
            "subject": {
                "publicKey": "03c2156930598a7e4832ebb8b435abcc657b1f14b7953b2145ae25268dd6141c1f"
            },
            "claim": cruxdevClientConfig
        }
    };
    const cruxdevConfigNameDetails = {
        "address": "1ATf5YwcEARWMCZdS8x3BXmkodkvnMW4Tf",
        "blockchain": "bitcoin",
        "did": "did:stack:v0:SWkf7PikxXchsWM5yZw7jRvKTQzMcdb5Pc-0",
        "last_txid": "bfa29d44fd31e4307c9fc0229964aaec1a6efc014e4c94681e2372f5f7d474ec",
        "status": "registered_subdomain",
        "zonefile": "$ORIGIN _config\n$TTL 3600\n_https._tcp URI 10 1 https://hub.cruxpay.com",
        "zonefile_hash": "776172a0bc8400a4046d0325dd87e78b48a2f66b"
    }
    before(() => { sandbox = sinon.createSandbox(); })
    beforeEach(() => {
        // mocking static methods
        staticMocksBlockstackService = {
            getRegisteredBlockstackNamesByAddress: sandbox.stub(blkStkService.BlockstackService, 'getRegisteredBlockstackNamesByAddress').throws("unhandled in getRegisteredBlockstackNamesByAddress mocks"),
            getNameDetails: sandbox.stub(blkStkService.BlockstackService, 'getNameDetails').throws("unhandled in getNameDetails mocks"),
            getGaiaHubFromZonefile: sandbox.stub(blkStkService.BlockstackService, 'getGaiaHubFromZonefile').throws("unhandled in getGaiaHubFromZonefile mocks"),
            getDomainRegistrationStatusFromNameDetails: sandbox.stub(blkStkService.BlockstackService, 'getDomainRegistrationStatusFromNameDetails').throws("unhandled in getDomainRegistrationStatusFromNameDetails mocks"),
            getCruxUserInformationFromSubdomainStatus: sandbox.stub(blkStkService.BlockstackService, 'getCruxUserInformationFromSubdomainStatus').throws("unhandled in getCruxUserInformationFromSubdomainStatus mocks"),
        }
        staticMocksGaiaService = {
            getGaiaReadUrl: sandbox.stub(gs.GaiaService, 'getGaiaReadUrl').throws("unhandled in getGaiaReadUrl mocks"),
            getContentFromGaiaHub: sandbox.stub(gs.GaiaService, 'getContentFromGaiaHub').throws("unhandled in getContentFromGaiaHub mocks"),
        }
        // mocking public methods
        mockBlockstackService = {
            getNameDetails: sandbox.stub().throws("unhandled in getNameDetails mocks"),
            getGaiaHub: sandbox.stub().throws("unhandled in getGaiaHub mocks"),
            getDomainRegistrationStatus: sandbox.stub().throws("unhandled in getDomainRegistrationStatus mocks"),
            getCruxDomainIdWithConfigKeyManager: sandbox.stub().throws("unhandled in getCruxDomainIdWithConfigKeyManager mocks"),
            getCruxIdWithKeyManager: sandbox.stub().throws("unhandled in getCruxIdWithKeyManager mocks"),
            isCruxIdAvailable: sandbox.stub().throws("unhandled in isCruxIdAvailable mocks"),
            registerCruxId: sandbox.stub().throws("unhandled in registerCruxId mocks"),
            getCruxIdInformation: sandbox.stub().throws("unhandled in getCruxIdInformation mocks"),
        }
        mockGaiaService = {
            getContentFromGaiaHub: sandbox.stub().throws("unhandled in getContentFromGaiaHub mocks"),
            uploadContentToGaiaHub: sandbox.stub().throws("unhandled in uploadContentToGaiaHub mocks"),
            connectToGaiaHubAsync: sandbox.stub().throws("unhandled in connectToGaiaHubAsync mocks"),
            makeV1GaiaAuthTokenAsync: sandbox.stub().throws("unhandled in makeV1GaiaAuthTokenAsync mocks"),
            generateContentTokenFileAsync: sandbox.stub().throws("unhandled in generateContentTokenFileAsync mocks"),
        }
        sandbox.stub(blkStkService, 'BlockstackService').returns(mockBlockstackService);
        sandbox.stub(gs, 'GaiaService').returns(mockGaiaService);
    })
    afterEach(() => { sandbox.restore(); })
    describe('Testing BlockstackCruxUserRepository', () => {
        let blockstackCruxUserRepository: BlockstackCruxUserRepository;
        // fixtures
        const cruxGaiaHub = "https://hub.cruxpay.com";
        const walletClientName = "cruxdev";
        const cruxdevDomainId = new CruxDomainId(walletClientName);
        const cruxdevConfigCruxId = new CruxId({
            subdomain: "_config",
            domain: walletClientName,
        })
        const testUserCruxIdString = "mascot6699@cruxdev.crux";
        const testUserSubdomain = "mascot6699";
        const testUserCruxId = CruxId.fromString(testUserCruxIdString);
        const testUserPrivKey = "cdf2d276caf0c9c34258ed6ebd0e60e0e8b3d9a7b8a9a717f2e19ed9b37f7c6f";
        const testUserKeyManager = new BasicKeyManager(testUserPrivKey);
        const testUserNameDetails = {
            "address": "1HkXFmLCg4zmPZyf2W5hbpV79EHwG52cEA",
            "blockchain": "bitcoin",
            "did": "did:stack:v0:Se3XHc7MQSBxusm7Zw4n9idfo1XN3p6b3B-0",
            "last_txid": "32521d18c1727c31dfe879f5d0d0833f4061bd642f6bd2fedf802e547a58c7c4",
            "status": "registered_subdomain",
            "zonefile": "$ORIGIN mascot6699\n$TTL 3600\n_https._tcp URI 10 1 https://hub.cruxpay.com",
            "zonefile_hash": "69c818f265a38101e495de03bc88afcd1ea428b2"
        }
        const cruxdevConfigNameDetails = {
            "address": "1ATf5YwcEARWMCZdS8x3BXmkodkvnMW4Tf",
            "blockchain": "bitcoin",
            "did": "did:stack:v0:SWkf7PikxXchsWM5yZw7jRvKTQzMcdb5Pc-0",
            "last_txid": "bfa29d44fd31e4307c9fc0229964aaec1a6efc014e4c94681e2372f5f7d474ec",
            "status": "registered_subdomain",
            "zonefile": "$ORIGIN _config\n$TTL 3600\n_https._tcp URI 10 1 https://hub.cruxpay.com",
            "zonefile_hash": "776172a0bc8400a4046d0325dd87e78b48a2f66b"
        }
        const newUserSubdomain = "newuser";
        const newUserCruxId = CruxId.fromString("newuser@cruxdev.crux");
        const unregisteredCruxId = CruxId.fromString("alice@cruxdev.crux");
        const randomPrivKey = "95611bcefd15913cba2c673ef61ba56d1a48de1d3df383222ddcb715e41e8ffb";
        const randomKeyManager = new BasicKeyManager(randomPrivKey);
        beforeEach(() => {
            blockstackCruxUserRepository = new BlockstackCruxUserRepository({
                blockstackInfrastructure: CruxSpec.blockstack.infrastructure,
                cruxDomain: getCruxdevCruxDomain(),
            })
        })
        it('New CruxUser Creation', async () => {
            mockBlockstackService.getCruxIdWithKeyManager.resolves();
            mockGaiaService.uploadContentToGaiaHub.resolves("https://gaia.cruxpay.com/174UBkUY4rte5jvRKzP7xJjGSRyTE6NcqA/cruxdev_cruxpay.json");
            mockBlockstackService.registerCruxId.withArgs(sinon.match(CustomMatcher.ID(newUserCruxId)), cruxGaiaHub, randomKeyManager).resolves({
                registrationStatus: {
                    status: SubdomainRegistrationStatus.PENDING,
                    statusDetail: SubdomainRegistrationStatusDetail.PENDING_REGISTRAR,
                }
            })
            const cruxUser = await blockstackCruxUserRepository.create(newUserSubdomain, randomKeyManager);
            expect(cruxUser).is.instanceOf(CruxUser);
            sinon.assert.match(cruxUser.cruxID, CustomMatcher.ID(newUserCruxId));
            expect(cruxUser.info).is.eql({
                registrationStatus: {
                    status: SubdomainRegistrationStatus.PENDING,
                    statusDetail: SubdomainRegistrationStatusDetail.PENDING_REGISTRAR,
                }
            })
            expect(mockBlockstackService.registerCruxId.calledOnceWithExactly(sinon.match(CustomMatcher.ID(newUserCruxId)), CruxSpec.blockstack.infrastructure.gaiaHub, randomKeyManager)).to.be.true;
        })
        it('Finding an existing CruxUser by ID', async ()=>{
            mockBlockstackService.isCruxIdAvailable.withArgs(sinon.match(CustomMatcher.ID(testUserCruxId))).resolves(false);
            const cruxUserAvailable = await blockstackCruxUserRepository.isCruxIdAvailable(testUserSubdomain);
            expect(cruxUserAvailable).is.eql(false);
        })
        it('Finding a new CruxUser by ID', async ()=>{
            mockBlockstackService.isCruxIdAvailable.withArgs(sinon.match(CustomMatcher.ID(newUserCruxId))).resolves(true);
            const cruxUserAvailable = await blockstackCruxUserRepository.isCruxIdAvailable(newUserSubdomain);
            expect(cruxUserAvailable).is.eql(true);
        })
        it('Getting registered CruxUser by ID', async ()=>{
            mockBlockstackService.getCruxIdInformation.withArgs(testUserCruxId, undefined, false).resolves({
                ownerAddress: testUserNameDetails.address,
                registrationStatus: {
                    status: SubdomainRegistrationStatus.DONE,
                    statusDetail: SubdomainRegistrationStatusDetail.DONE,
                },
                transactionHash: testUserNameDetails.last_txid,
            })
            mockBlockstackService.getGaiaHub.withArgs(testUserCruxId).resolves(cruxGaiaHub);
            mockBlockstackService.getNameDetails.withArgs(testUserCruxId).resolves(testUserNameDetails);
            mockGaiaService.getContentFromGaiaHub.withArgs(testUserNameDetails.address, "cruxdev_cruxpay.json").resolves({
                "payload": {
                    "subject": "0362f171a40ab5e6ad22275ec166f15a232b83a571bab9c30622ed2963f1da4c08",
                    "claim": {
                        "d78c26f8-7c13-4909-bf62-57d7623f8ee8": {
                            "addressHash": "1bEuiLiVDaTJo2poFMfWZFp9SYdhRuUhX",
                        },
                        "abe0030a-d8e3-4518-879f-cd9939b7d8ab": {
                            "addressHash": "rpfKAA2Ezqoq5wWo3XENdLYdZ8YGziz48h",
                        },
                        "4e4d9982-3469-421b-ab60-2c0c2f05386a": {
                            "addressHash": "0x0a2311594059b468c9897338b027c8782398b481",
                        }
                    }
                }
            });
            mockBlockstackService.getDomainRegistrationStatus.withArgs(sinon.match(CustomMatcher.ID(cruxdevDomainId))).resolves(cruxdevRegistrationStatus);
            mockBlockstackService.getGaiaHub.withArgs(sinon.match(CustomMatcher.ID(cruxdevConfigCruxId))).resolves(cruxGaiaHub);
            mockBlockstackService.getNameDetails.withArgs(sinon.match(CustomMatcher.ID(cruxdevConfigCruxId))).resolves(cruxdevConfigNameDetails);
            mockGaiaService.getContentFromGaiaHub.withArgs(cruxdevConfigNameDetails.address, "cruxdev_client-config.json").resolves(cruxdevClientConfigJson);
            const cruxUser = await blockstackCruxUserRepository.getByCruxId(testUserCruxId);
            expect(cruxUser).is.instanceOf(CruxUser);
            sinon.assert.match(cruxUser.cruxID, sinon.match(CustomMatcher.ID(testUserCruxId)));
            expect(cruxUser.info).is.eql({
                ownerAddress: testUserNameDetails.address,
                registrationStatus: {
                    status: SubdomainRegistrationStatus.DONE,
                    statusDetail: SubdomainRegistrationStatusDetail.DONE,
                },
                transactionHash: testUserNameDetails.last_txid,
            })
            expect(mockBlockstackService.getCruxIdInformation.calledOnceWithExactly(testUserCruxId, undefined, false)).to.be.true;
        })
        it('Getting registered CruxUser by ID with tag', async ()=>{
            mockBlockstackService.getCruxIdInformation.withArgs(testUserCruxId, "testtag", false).resolves({
                ownerAddress: testUserNameDetails.address,
                registrationStatus: {
                    status: SubdomainRegistrationStatus.DONE,
                    statusDetail: SubdomainRegistrationStatusDetail.DONE,
                },
                transactionHash: testUserNameDetails.last_txid,
            })
            mockBlockstackService.getGaiaHub.withArgs(testUserCruxId, "testtag").resolves(cruxGaiaHub);
            mockBlockstackService.getNameDetails.withArgs(testUserCruxId, "testtag").resolves(testUserNameDetails);
            mockGaiaService.getContentFromGaiaHub.withArgs(testUserNameDetails.address, "cruxdev_cruxpay.json").resolves({
                "payload": {
                    "subject": "0362f171a40ab5e6ad22275ec166f15a232b83a571bab9c30622ed2963f1da4c08",
                    "claim": {
                        "d78c26f8-7c13-4909-bf62-57d7623f8ee8": {
                            "addressHash":"1HX4KvtPdg9QUYwQE1kNqTAjmNaDG7w82V",
                        }
                    }
                }
            });
            mockBlockstackService.getDomainRegistrationStatus.withArgs(sinon.match(CustomMatcher.ID(cruxdevDomainId))).resolves(cruxdevRegistrationStatus);
            mockBlockstackService.getGaiaHub.withArgs(sinon.match(CustomMatcher.ID(cruxdevConfigCruxId))).resolves(cruxGaiaHub);
            mockBlockstackService.getNameDetails.withArgs(sinon.match(CustomMatcher.ID(cruxdevConfigCruxId))).resolves(cruxdevConfigNameDetails);
            mockGaiaService.getContentFromGaiaHub.withArgs(cruxdevConfigNameDetails.address, "cruxdev_client-config.json").resolves(cruxdevClientConfigJson);
            const cruxUser = await blockstackCruxUserRepository.getByCruxId(testUserCruxId, "testtag");
            expect(cruxUser).is.instanceOf(CruxUser);
            sinon.assert.match(cruxUser.cruxID, sinon.match(CustomMatcher.ID(testUserCruxId)));
            expect(cruxUser.info).is.eql({
                ownerAddress: testUserNameDetails.address,
                registrationStatus: {
                    status: SubdomainRegistrationStatus.DONE,
                    statusDetail: SubdomainRegistrationStatusDetail.DONE,
                },
                transactionHash: testUserNameDetails.last_txid,
            });
            expect(cruxUser.getAddressMap()).is.eql({
                "d78c26f8-7c13-4909-bf62-57d7623f8ee8": {
                    "addressHash":"1HX4KvtPdg9QUYwQE1kNqTAjmNaDG7w82V",
                }
            });
            expect(mockBlockstackService.getCruxIdInformation.calledOnceWithExactly(testUserCruxId, "testtag", false)).to.be.true;
        })
        it('Getting unregistered CruxUser by ID', async ()=>{
            mockBlockstackService.getCruxIdInformation.withArgs(unregisteredCruxId).resolves({
                registrationStatus: {
                    status: SubdomainRegistrationStatus.NONE,
                    statusDetail: SubdomainRegistrationStatusDetail.NONE,
                }
            })
            const cruxUser = await blockstackCruxUserRepository.getByCruxId(unregisteredCruxId);
            expect(cruxUser).is.eql(undefined);
        })
        it('Getting a CruxUser by key', async ()=>{
            mockBlockstackService.getCruxIdWithKeyManager.withArgs(testUserKeyManager, sinon.match(CustomMatcher.ID(cruxdevDomainId))).resolves(testUserCruxId);
            mockBlockstackService.getCruxIdInformation.withArgs(testUserCruxId).resolves({
                ownerAddress: testUserNameDetails.address,
                registrationStatus: {
                    status: SubdomainRegistrationStatus.DONE,
                    statusDetail: SubdomainRegistrationStatusDetail.DONE,
                },
                transactionHash: testUserNameDetails.last_txid,
            })
            mockBlockstackService.getGaiaHub.withArgs(testUserCruxId).resolves(cruxGaiaHub);
            mockBlockstackService.getNameDetails.withArgs(testUserCruxId).resolves(testUserNameDetails);
            mockGaiaService.getContentFromGaiaHub.withArgs(testUserNameDetails.address, "cruxdev_cruxpay.json").resolves({
                "payload": {
                    "subject": "0362f171a40ab5e6ad22275ec166f15a232b83a571bab9c30622ed2963f1da4c08",
                    "claim": {
                        "d78c26f8-7c13-4909-bf62-57d7623f8ee8": {
                            "addressHash": "1bEuiLiVDaTJo2poFMfWZFp9SYdhRuUhX",
                        },
                        "abe0030a-d8e3-4518-879f-cd9939b7d8ab": {
                            "addressHash": "rpfKAA2Ezqoq5wWo3XENdLYdZ8YGziz48h",
                        },
                        "4e4d9982-3469-421b-ab60-2c0c2f05386a": {
                            "addressHash": "0x0a2311594059b468c9897338b027c8782398b481",
                        }
                    }
                }
            });
            const cruxUser = await blockstackCruxUserRepository.getWithKey(testUserKeyManager);
            expect(cruxUser).is.instanceOf(CruxUser);
            expect(cruxUser.info).is.eql({
                ownerAddress: testUserNameDetails.address,
                registrationStatus: {
                    status: SubdomainRegistrationStatus.DONE,
                    statusDetail: SubdomainRegistrationStatusDetail.DONE,
                },
                transactionHash: testUserNameDetails.last_txid,
            })
        })
    })
    describe('Testing BlockstackCruxDomainRepository', () => {
        let blockstackCruxDomainRepository: BlockstackCruxDomainRepository;
        // fixtures
        const cruxGaiaHub = "https://hub.cruxpay.com";
        // "cruxdev" fixtures
        const cruxdevDomainString = "cruxdev";
        const cruxdevCruxDomainId = new CruxDomainId(cruxdevDomainString);
        const cruxdevConfigSubdomainPrivateKey = "d4a7eab17471d190a0d6cfa00546dceeac88f333b8a2d16fb4464e1e57ac188f";    // random-private-key;
        const cruxdevConfigKeyManager = new BasicKeyManager(cruxdevConfigSubdomainPrivateKey)
        // "testcase" fixtures
        const testcaseDomainString = "testcase";
        const testcaseCruxDomainId = new CruxDomainId(testcaseDomainString);
        beforeEach(() => {
            blockstackCruxDomainRepository = new BlockstackCruxDomainRepository({
                blockstackInfrastructure: CruxSpec.blockstack.infrastructure,
            })
        })
        describe('Finding availability of CruxDomain by DomainId', () => {
            it('"cruxdev" should be unavailable', async () => {
                mockBlockstackService.getDomainRegistrationStatus.withArgs(cruxdevCruxDomainId).resolves(DomainRegistrationStatus.REGISTERED);
                const availability = await blockstackCruxDomainRepository.isCruxDomainIdAvailable(cruxdevCruxDomainId);
                expect(availability).to.be.false;
                expect(mockBlockstackService.getDomainRegistrationStatus.calledOnce).to.be.true;
                expect(mockBlockstackService.getDomainRegistrationStatus.calledWithExactly(cruxdevCruxDomainId)).to.be.true;
            })
            it('"testcase" should be available', async () => {
                mockBlockstackService.getDomainRegistrationStatus.withArgs(testcaseCruxDomainId).resolves(DomainRegistrationStatus.AVAILABLE);
                const availability = await blockstackCruxDomainRepository.isCruxDomainIdAvailable(testcaseCruxDomainId);
                expect(availability).to.be.true;
                expect(mockBlockstackService.getDomainRegistrationStatus.calledOnce).to.be.true;
                expect(mockBlockstackService.getDomainRegistrationStatus.calledWithExactly(testcaseCruxDomainId)).to.be.true;
            })
        })
        describe('Getting the CruxDomain by DomainId', () => {
            it('"cruxdev" should resolve proper CruxDomain object', async () => {
                // mocks
                mockBlockstackService.getNameDetails.resolves(cruxdevConfigNameDetails);
                mockBlockstackService.getGaiaHub.resolves(cruxGaiaHub);
                mockBlockstackService.getDomainRegistrationStatus.withArgs(cruxdevCruxDomainId).resolves(DomainRegistrationStatus.REGISTERED);
                mockGaiaService.getContentFromGaiaHub.resolves(cruxdevClientConfigJson);
                // call
                const cruxDomain = await blockstackCruxDomainRepository.get(cruxdevCruxDomainId);
                // expectations
                expect(cruxDomain).is.instanceOf(CruxDomain);
                expect(cruxDomain.status === cruxdevRegistrationStatus).to.be.true;
                expect(cruxDomain.config).is.eql(cruxdevClientConfig);
                expect(mockBlockstackService.getDomainRegistrationStatus.calledOnceWithExactly(cruxdevCruxDomainId)).to.be.true;
                expect(mockBlockstackService.getNameDetails.calledOnce).to.be.true;
                expect(mockBlockstackService.getGaiaHub.calledOnce).to.be.true;
                expect(mockGaiaService.getContentFromGaiaHub.calledOnceWithExactly(cruxdevConfigNameDetails.address, "cruxdev_client-config.json")).to.be.true;
            })
            it('"testcase" should resolve undefined', async () => {
                mockBlockstackService.getDomainRegistrationStatus.withArgs(testcaseCruxDomainId).resolves(DomainRegistrationStatus.AVAILABLE);
                const cruxDomain = await blockstackCruxDomainRepository.get(testcaseCruxDomainId);
                expect(cruxDomain).is.undefined;
                expect(mockBlockstackService.getDomainRegistrationStatus.calledOnce).to.be.true;
                expect(mockBlockstackService.getDomainRegistrationStatus.calledWithExactly(testcaseCruxDomainId)).to.be.true;
                expect(mockBlockstackService.getNameDetails.notCalled).to.be.true;
                expect(mockBlockstackService.getGaiaHub.notCalled).to.be.true;
                expect(mockGaiaService.getContentFromGaiaHub.notCalled).to.be.true;
            })
        })
        describe('Getting a CruxDomain with configKeyManager', () => {
            it('"cruxdev" is available on the configKeyManager provided', async () => {
                mockBlockstackService.getNameDetails.resolves(cruxdevConfigNameDetails);
                mockBlockstackService.getGaiaHub.resolves(cruxGaiaHub);
                mockBlockstackService.getCruxDomainIdWithConfigKeyManager.withArgs(sinon.match(cruxdevConfigKeyManager)).resolves(cruxdevCruxDomainId);
                mockGaiaService.getContentFromGaiaHub.resolves(cruxdevClientConfigJson);
                const cruxDomain = await blockstackCruxDomainRepository.getWithConfigKeyManager(cruxdevConfigKeyManager);
                expect(cruxDomain).is.instanceOf(CruxDomain);
                expect(cruxDomain.status === cruxdevRegistrationStatus).to.be.true;
                expect(cruxDomain.config).is.eql(cruxdevClientConfig);
                expect(mockBlockstackService.getCruxDomainIdWithConfigKeyManager.calledOnceWith(cruxdevConfigKeyManager)).to.be.true;
                expect(mockBlockstackService.getNameDetails.calledOnce).to.be.true;
                expect(mockBlockstackService.getGaiaHub.calledOnce).to.be.true;
                expect(mockGaiaService.getContentFromGaiaHub.calledOnceWithExactly(cruxdevConfigNameDetails.address, "cruxdev_client-config.json")).to.be.true;
            })
            it('No domain available on the configKeyManager provided', async () => {
                mockBlockstackService.getCruxDomainIdWithConfigKeyManager.resolves(undefined);
                const randomKeyManager = new BasicKeyManager("392555374ccf6c13a3f0a794dc94658861fe4a1c568169eb8bdf89c421968023");
                const cruxDomain = await blockstackCruxDomainRepository.getWithConfigKeyManager(randomKeyManager);
                expect(cruxDomain).is.undefined;
                expect(mockBlockstackService.getNameDetails.notCalled).to.be.true;
                expect(mockBlockstackService.getGaiaHub.notCalled).to.be.true;
                expect(mockGaiaService.getContentFromGaiaHub.notCalled).to.be.true;
            })
        })
        describe('Saving changes to a CruxDomain', () => {
            it('returned cruxDomain object matches the edited instance given as parameter', async () => {
                // fixtures
                const newAssetMap = { "tbtc": "d78c26f8-7c13-4909-bf62-57d7623f8ee8" };
                const newAssetList = [{
                    "assetId": "d78c26f8-7c13-4909-bf62-57d7623f8ee8",
                    "symbol": "BTC",
                    "name": "Bitcoin",
                    "assetType": null,
                    "decimals": 8,
                    "assetIdentifierName": null,
                    "assetIdentifierValue": null,
                    "parentAssetId": null
                }];
                // mocks
                mockBlockstackService.getNameDetails.resolves(cruxdevConfigNameDetails);
                mockBlockstackService.getGaiaHub.resolves(cruxGaiaHub);
                mockBlockstackService.getDomainRegistrationStatus.withArgs(cruxdevCruxDomainId).resolves(DomainRegistrationStatus.REGISTERED);
                mockGaiaService.getContentFromGaiaHub.resolves(cruxdevClientConfigJson);
                mockGaiaService.uploadContentToGaiaHub.resolves("https://gaia.cruxpay.com/1ATf5YwcEARWMCZdS8x3BXmkodkvnMW4Tf/cruxdev_client-config.json");
                // callling the method
                const cruxDomain = await blockstackCruxDomainRepository.get(cruxdevCruxDomainId);
                cruxDomain.config.assetMapping = newAssetMap;
                const updatedCruxDomain = await blockstackCruxDomainRepository.save(cruxDomain, cruxdevConfigKeyManager);
                // expectations
                expect(updatedCruxDomain).to.be.instanceOf(CruxDomain);
                expect(updatedCruxDomain.config.assetMapping['tbtc']).to.be.equal("d78c26f8-7c13-4909-bf62-57d7623f8ee8");
                expect(mockBlockstackService.getDomainRegistrationStatus.calledOnceWithExactly(cruxdevCruxDomainId)).to.be.true;
                expect(mockBlockstackService.getNameDetails.calledOnce).to.be.true;
                expect(mockBlockstackService.getGaiaHub.calledTwice).to.be.true;
                expect(mockGaiaService.getContentFromGaiaHub.calledOnceWithExactly(cruxdevConfigNameDetails.address, "cruxdev_client-config.json")).to.be.true;
                expect(mockGaiaService.uploadContentToGaiaHub.calledOnceWith("cruxdev_client-config.json", sinon.match({assetMapping: newAssetMap, assetList: newAssetList}), cruxdevConfigKeyManager)).to.be.true;
            })
        })

    })

});
