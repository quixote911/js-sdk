import { AssertionError, deepStrictEqual } from "assert";
import { getLogger } from "../..";
import config from "../../config";
import { ErrorHelper, PackageErrorCode } from "../error";
import { cachedFunctionCall, httpJSONRequest } from "../utils";

const log = getLogger(__filename);

export const fetchNameDetails = async (blockstackId: string, bnsNodes?: string[]): Promise<object|undefined> => {
    bnsNodes = bnsNodes || config.BLOCKSTACK.BNS_NODES;
    const nodeResponses = (bnsNodes as string[]).map((baseUrl) => bnsResolveName(baseUrl, blockstackId));
    log.debug(`BNS node responses:`, nodeResponses);

    const responsesArr: object[] = await Promise.all(nodeResponses);
    log.debug(`BNS resolved JSON array:`, responsesArr);
    let prev_res;
    let response: object;
    for (let i = 0; i < responsesArr.length; i++) {
        const res = responsesArr[i];
        if (i === 0) {
            prev_res = res;
        } else {
            try {
                deepStrictEqual(prev_res, res);
            } catch (e) {
                if (e instanceof AssertionError) {
                    throw ErrorHelper.getPackageError(PackageErrorCode.NameIntegrityCheckFailed);
                } else {
                    log.error(e);
                    throw e;
                }
            }
        }
        // TODO: unhandled else case
        if (i === responsesArr.length - 1) {
            response = responsesArr[0];
        }
    }
    // @ts-ignore
    return response;
};

const bnsResolveName = async (baseUrl: string, blockstackId: string): Promise<object> => {
    const options = {
        baseUrl,
        json: true,
        method: "GET",
        url: `/v1/names/${blockstackId}`,
    };
    let nameData;
    try {
        nameData = await cachedFunctionCall(`${options.baseUrl}${blockstackId}`, 3600, httpJSONRequest, [options], async (data) => Boolean(data && data.status && data.status !== "registered_subdomain"));
    } catch (error) {
        throw ErrorHelper.getPackageError(PackageErrorCode.BnsResolutionFailed, baseUrl, error);
    }
    return nameData;
};
