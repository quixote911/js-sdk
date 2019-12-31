import { CruxDomain } from "../../core/entities/crux-domain";
import { DomainRegistrationStatus } from "../../core/entities/crux-domain";
import { ICruxDomainRepository, ICruxDomainRepositoryOptions } from "../../core/interfaces/crux-domain-repository";
import { IKeyManager } from "../../core/interfaces/key-manager";
import { IClientConfig } from "../../packages/configuration-service";
import { ErrorHelper, PackageErrorCode } from "../../packages/error";
import { CruxDomainId } from "../../packages/identity-utils";
import { getLogger } from "../../packages/logger";
import { StorageService } from "../../packages/storage";
import { BlockstackService } from "../services/blockstack-service";
const log = getLogger(__filename);
export interface IBlockstackCruxDomainRepositoryOptions extends ICruxDomainRepositoryOptions {
    bnsNodes?: string[];
    cacheStorage?: StorageService;
}
export class BlockstackCruxDomainRepository implements ICruxDomainRepository {
    private _cacheStorage?: StorageService;
    private _bnsNodes: string[];
    constructor(options?: IBlockstackCruxDomainRepositoryOptions) {
        this._cacheStorage = options && options.cacheStorage;
        this._bnsNodes = options && options.bnsNodes && [...new Set([...BlockstackService.infrastructure.bnsNodes, ...options.bnsNodes])] || BlockstackService.infrastructure.bnsNodes;
        log.info("BlockstackCruxDomainRepository initialised");
    }
    public find = async (domainId: CruxDomainId): Promise<boolean> => {
        const domainRegistrationStatus = await this._getDomainRegistrationStatus(domainId.components.domain, this._bnsNodes);
        return domainRegistrationStatus === DomainRegistrationStatus.AVAILABLE ? true : false;
    }
    public create = async (domainId: CruxDomainId, keyManager: IKeyManager): Promise<CruxDomain> => {
        // TODO: register the domain on bitcoin blockchain and _config subdomain on domain provided SubdomainRegistrar service
        throw ErrorHelper.getPackageError(null, PackageErrorCode.IsNotSupported);
    }
    public get = async (domainId: CruxDomainId): Promise<CruxDomain|undefined> => {
        const domainRegistrationStatus = await this._getDomainRegistrationStatus(domainId.components.domain, this._bnsNodes);
        if (domainRegistrationStatus === DomainRegistrationStatus.AVAILABLE) {
            return;
        }
        const domainClientConfig = await this._getClientConfig(domainId.components.domain, this._bnsNodes);
        return new CruxDomain(domainId, domainRegistrationStatus, domainClientConfig);
    }
    public save = async (cruxDomain: CruxDomain, configKeyManager: IKeyManager): Promise<CruxDomain> => {
        await this._putClientConfig(cruxDomain.domainId.components.domain, cruxDomain.config, this._bnsNodes, configKeyManager);
        return cruxDomain;
    }
    public getWithKey = async (keyManager: IKeyManager, domainId?: CruxDomainId): Promise<CruxDomain|undefined> => {
        const associatedDomain = await BlockstackService.restoreDomain(keyManager, this._bnsNodes, domainId && domainId.components.domain);
        if (!associatedDomain) {
            return;
        }
        const domainClientConfig = await this._getClientConfig(associatedDomain, this._bnsNodes);
        return new CruxDomain(new CruxDomainId(associatedDomain), DomainRegistrationStatus.REGISTERED, domainClientConfig);
    }
    private _getDomainRegistrationStatus = async (domain: string, bnsNodes: string[]) => {
        return BlockstackService.getDomainRegistrationStatus(domain, bnsNodes, this._cacheStorage);
    }
    private _getClientConfig = async (domain: string, bnsNodes: string[]) => {
        return BlockstackService.getClientConfig(domain, bnsNodes, this._cacheStorage);
    }
    private _putClientConfig = async (domain: string, clientConfig: IClientConfig, bnsNodes: string[], keyManager: IKeyManager) => {
        return BlockstackService.putClientConfig(domain, clientConfig, bnsNodes, keyManager, this._cacheStorage);
    }
}
