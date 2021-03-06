import {
    CruxWalletClient,
    IAddressMapping,
    LocalStorage,
    ICruxWalletClientOptions,
    CruxClientError,
    ICruxIDState,
    IAssetMatcher,
    SubdomainRegistrationStatus,
    SubdomainRegistrationStatusDetail,
    CruxId,
    IAddress
} from "../index";
// TODO: add optional import statement to use the build

const doc = (document as {
    getElementById: Function,
    getElementsByName: Function,
    getElementsByClassName: Function
})



// Demo wallet artifacts

let walletClientName = "cruxdev"
// Value can be withoutInit or withInit
let mode = "withoutInit"
const btcAddress = "1HX4KvtPdg9QUYwQE1kNqTAjmNaDG7w82V"
const ethAddress = "0x0a2311594059b468c9897338b027c8782398b481"
const trxAddress = "TG3iFaVvUs34SGpWq8RG9gnagDLTe1jdyz"
const xrpAddress = "rpfKAA2Ezqoq5wWo3XENdLYdZ8YGziz48h"
const xrpSecIdentifier = "12345"
const lifeAddress = "0xd26114cd6ee289accf82350c8d8487fedb8a0c07"
const zrxAddress = "0xd26114cd6ee289accf82350c8d8487fedb8a0c07"

const sampleAddressMaps: {[walletClientName: string]: IAddressMapping} = {
    "cruxdev,guarda": {
        btc: {
            addressHash: btcAddress
        },
        eth: {
            addressHash: ethAddress
        },
        trx: {
            addressHash: trxAddress
        },
        xrp: {
            addressHash: xrpAddress,
            secIdentifier: xrpSecIdentifier
        },
        life: {
            addressHash: lifeAddress,
        },
    },
    "zel_dev": {
        bitcoin: {
            addressHash: btcAddress
        },
        ethereum: {
            addressHash: ethAddress
        },
        tron: {
            addressHash: trxAddress
        },
        ripple: {
            addressHash: xrpAddress,
            secIdentifier: xrpSecIdentifier
        },
        zrx: {
            addressHash: zrxAddress,
        }
    }
};

const supportedAssetGroups = {
    "cruxdev,guarda": [
        "ERC20_eth",
        "EOSToken_eos",
        "NEP5_neo",
        "TRC10_trx",
        "VIP180_vet"
    ],
    "zel_dev": [
        "ERC20_ethereum",
        "TRC10_tron",
    ],
};

const url = new URL(window.location.href);
mode = url.searchParams.get("mode") || mode;
walletClientName = url.searchParams.get("walletClientName") || walletClientName;
const sampleAddressMap = sampleAddressMaps[Object.keys(sampleAddressMaps).find((keyString) => keyString.split(',').includes(walletClientName))];
const sampleSupportedAssetGroups = supportedAssetGroups[Object.keys(supportedAssetGroups).find((keyString) => keyString.split(',').includes(walletClientName))];
const privateKey = url.searchParams.get("key");
// mascot6699@cruxdev.crux - ["cdf2d276caf0c9c34258ed6ebd0e60e0e8b3d9a7b8a9a717f2e19ed9b37f7c6f"]

doc.getElementById('mode').textContent = `'${mode}'`;
[].forEach.call(doc.getElementsByClassName('walletClientName'), (el: HTMLElement) => { el.textContent = walletClientName })
doc.getElementById('currency').innerHTML = Object.keys(sampleAddressMap).map((currency) => { return `<option value="${currency}">${currency}</option>` }).join('\n')
doc.getElementById('userAddresses').textContent = Object.keys(sampleAddressMap).map((currency) => { let address = sampleAddressMap[currency].addressHash; let secIdentifier = sampleAddressMap[currency].secIdentifier; return `${currency.toUpperCase()} - ${address} ${secIdentifier ? `(${secIdentifier})` : '' }` }).join('\n')
doc.getElementById('publishAddresses').innerHTML = Object.keys(sampleAddressMap).map((currency) => { let address = sampleAddressMap[currency].addressHash; let secIdentifier = sampleAddressMap[currency].secIdentifier; return `<input type="checkbox" name="publishAddressOption" currency="${currency.toUpperCase()}" addressHash="${address}" secIdentifier="${secIdentifier}" checked>${currency.toUpperCase()}` }).join('\n')
doc.getElementById('publishPrivateAddresses').innerHTML = Object.keys(sampleAddressMap).map((currency) => { let address = sampleAddressMap[currency].addressHash; let secIdentifier = sampleAddressMap[currency].secIdentifier; return `<input type="checkbox" name="publishPrivateAddressOption" currency="${currency.toUpperCase()}" addressHash="${address}" secIdentifier="${secIdentifier}" checked>${currency.toUpperCase()}` }).join('\n')
doc.getElementById('assetMatcher_assetGroups').innerHTML = [...sampleSupportedAssetGroups].map((assetGroup) => `<option value="${assetGroup}">${assetGroup.toUpperCase()}</option>`).join('\n')


// --- @crux/js-sdk integration --- //
// defining cruxClientOptions
const cruxClientOptions: ICruxWalletClientOptions = {
    walletClientName: walletClientName,
    cacheStorage: new LocalStorage(),
    privateKey: privateKey || undefined,
    debugLogging: true,
}

// initialising the cruxClient
const cruxClient = new CruxWalletClient(cruxClientOptions)
// const cruxClient = new CruxClient(cruxClientOptions)

// SDK functional interface

const isCruxIDAvailable = async () => {
    let UIResponse: string = "checking availability ..."
    doc.getElementById('availability').textContent = UIResponse
    let cruxID = doc.getElementById('registrationId').value
    try {
        let available = await cruxClient.isCruxIDAvailable(cruxID)
        UIResponse = available ? "available" : "unavailable"
    } catch (e) {
        if (e instanceof CruxClientError) {
            UIResponse = `${e.errorCode}: ${e}`
        } else {
            UIResponse = e
        }

    } finally {
        doc.getElementById('availability').textContent = UIResponse
    }
}
const registerCruxID = async () => {
    let UIResponse: string = "registering your crux ID..."
    let cruxID = doc.getElementById('newSubdomain').value
    doc.getElementById('registrationAcknowledgement').textContent = UIResponse;
    try {
        await cruxClient.registerCruxID(cruxID)
        UIResponse = 'cruxID registration initiated!'
        try {
            const { success, failures } = await cruxClient.putAddressMap(sampleAddressMap)
            UIResponse += `\nsuccessfully published: ${JSON.stringify(success)}, \nFailed publishing: ${JSON.stringify(failures, undefined, 4)}`
        } catch (e_1) {
            if (e_1 instanceof CruxClientError) {
                UIResponse += `\n${e_1.errorCode}: ${e_1}`
            } else {
                UIResponse += '\n' + e_1
            }
        }
    } catch (e) {
        if (e instanceof CruxClientError) {
            UIResponse = `${e.errorCode}: ${e}`
        } else {
            UIResponse = e
        }
    } finally {
        doc.getElementById('registrationAcknowledgement').textContent = UIResponse
    }
}

const sendPaymentRequest = async (walletSymbol: string, recipientCruxId: string, amount: string, toAddress: IAddress) => {
    let UIResponse: string = "Send Message..."
    // walletSymbol = doc.getElementById('walletSymbol').value ? doc.getElementById('walletSymbol').value : walletSymbol;
    // recipientCruxId = doc.getElementById('recipientCruxId').value ? doc.getElementById('recipientCruxId').value : recipientCruxId;
    // amount = doc.getElementById('amount').value ? doc.getElementById('amount').value : amount;
    // toAddress = doc.getElementById('toAddress').value ? doc.getElementById('toAddress').value : toAddress;
    let data = doc.getElementById('data').value;
    recipientCruxId = doc.getElementById('recipientCruxId').value ? doc.getElementById('recipientCruxId').value : recipientCruxId;
    doc.getElementById('sendPaymentRequestAcknowledgment').textContent = UIResponse;
    try {
        UIResponse = 'Trying Sending Message...'
        try {
            await cruxClient.secureCruxNetwork!.send(CruxId.fromString(recipientCruxId), data);
            // await cruxClient.sendPaymentRequest(walletSymbol, recipientCruxId, amount, toAddress);
            UIResponse += `\n Payment request sent successfully`;
        } catch (e_1) {
            if (e_1 instanceof CruxClientError) {
                UIResponse += `\n${e_1.errorCode}: ${e_1}`
            } else {
                UIResponse += '\n' + e_1
            }
        }
    } catch (e) {
        if (e instanceof CruxClientError) {
            UIResponse = `${e.errorCode}: ${e}`
        } else {
            UIResponse = e
        }
    } finally {
        doc.getElementById('sendPaymentRequestAcknowledgment').textContent = UIResponse
    }
}
const recievePaymentRequests = async () => {
    await cruxClient.init();
    let UIResponse: string = "Waiting for messages..."
    doc.getElementById('paymentRequestAcknowledgment').textContent = UIResponse;
    try {
        try {
            cruxClient.secureCruxNetwork!.receive((msg: any, senderId: any) => {
                UIResponse += `\n${senderId} sent a message : ${msg}`;
                doc.getElementById('paymentRequestAcknowledgment').textContent = UIResponse
            });
            cruxClient.secureCruxNetwork!.onError((err)=>{console.log("ERROR in secureCruxNetwork.listen", err)});
        } catch (e_1) {
            if (e_1 instanceof CruxClientError) {
                UIResponse += `\n${e_1.errorCode}: ${e_1}`
            } else {
                UIResponse += '\n' + e_1
            }
        }
    } catch (e) {
        if (e instanceof CruxClientError) {
            UIResponse = `${e.errorCode}: ${e}`
        } else {
            UIResponse = e
        }
    } finally {
        doc.getElementById('paymentRequestAcknowledgment').textContent = UIResponse
    }
}


const resolveCurrencyAddressForCruxID = async () => {
    let cruxID = doc.getElementById('receiverVirtualAddress').value
    let walletCurrencySymbol = doc.getElementById('currency').value
    let UIResponse: string = `resolving cruxID (${cruxID}) ${walletCurrencySymbol} address ...`
    doc.getElementById('addresses').textContent = UIResponse
    try {
        let resolvedAddress = await cruxClient.resolveCurrencyAddressForCruxID(cruxID, walletCurrencySymbol)
        UIResponse = JSON.stringify(resolvedAddress, undefined, 4)
    } catch (e) {
        if (e instanceof CruxClientError) {
            UIResponse = `${e.errorCode}: ${e}`
        } else {
            UIResponse = e
        }
    } finally {
        doc.getElementById('addresses').textContent = UIResponse
    }

}
const resolveAssetAddressForCruxID = async () => {
    let cruxID = doc.getElementById('receiverVirtualAddress').value
    let UIResponse: string = `resolving cruxID (${cruxID}) with the given assetMatcher...`
    let assetMatcher: IAssetMatcher = {
        assetGroup: doc.getElementById('assetMatcher_assetGroups').value,
        assetIdentifierValue: doc.getElementById('assetMatcher_assetIdentifierValue').value || undefined,
    };
    doc.getElementById('addresses').textContent = UIResponse
    try {
        let resolvedAddress = await cruxClient.resolveAssetAddressForCruxID(cruxID, assetMatcher);
        UIResponse = JSON.stringify(resolvedAddress, undefined, 4)
    } catch (e) {
        if (e instanceof CruxClientError) {
            UIResponse = `${e.errorCode}: ${e}`
        } else {
            UIResponse = e
        }
    } finally {
        doc.getElementById('addresses').textContent = UIResponse
    }

}
const getAssetMap = async () => {
    let UIResponse: string = "fetching assetMap ..."
    doc.getElementById('assetMap').textContent = UIResponse;
    try {
        let assetMap = await cruxClient.getAssetMap()
        UIResponse = JSON.stringify(assetMap, undefined, 4)
    } catch (e) {
        if (e instanceof CruxClientError) {
            UIResponse = `${e.errorCode}: ${e}`
        } else {
            UIResponse = e
        }
    } finally {
        doc.getElementById('assetMap').textContent = UIResponse
    }
}
const getAddressMap = async () => {
    let UIResponse: string = "fetching addressMap ..."
    doc.getElementById('addressMap').textContent = UIResponse;
    try {
        let addressMap = await cruxClient.getAddressMap()
        UIResponse = JSON.stringify(addressMap, undefined, 4)
    } catch (e) {
        if (e instanceof CruxClientError) {
            UIResponse = `${e.errorCode}: ${e}`
        } else {
            UIResponse = e
        }
    } finally {
        doc.getElementById('addressMap').textContent = UIResponse
    }
}
const getEnabledAssetGroups = async () => {
    let UIResponse: string = "fetching enabled assetGroups..."
    doc.getElementById('enabledAssetGroups').textContent = UIResponse;
    try {
        let addressMap = await cruxClient.getEnabledAssetGroups()
        UIResponse = JSON.stringify(addressMap, undefined, 4)
    } catch (e) {
        if (e instanceof CruxClientError) {
            UIResponse = `${e.errorCode}: ${e}`
        } else {
            UIResponse = e
        }
    } finally {
        doc.getElementById('enabledAssetGroups').textContent = UIResponse
    }
}
const putAddressMap = async () => {
    let UIResponse: string = "Publishing your selected addresses..."
    let addressMap: IAddressMapping = {};
    [].forEach.call(doc.getElementsByName('publishAddressOption'), (el: HTMLInputElement) => {
        if (el.checked) {
            addressMap[el.attributes['currency'].nodeValue] = {
                addressHash: el.attributes['addressHash'].nodeValue,
                secIdentifier: el.attributes['secIdentifier'].nodeValue === "undefined" ? undefined : el.attributes['secIdentifier'].nodeValue
            }
        }
    });
    doc.getElementById('putAddressMapAcknowledgement').textContent = UIResponse
    try {
        let {success, failures} = await cruxClient.putAddressMap(addressMap)
        UIResponse = `successfully published: ${JSON.stringify(success)}, \nFailed publishing: ${JSON.stringify(failures, undefined, 4)}`
    } catch (e) {
        if (e instanceof CruxClientError) {
            UIResponse = `${e.errorCode}: ${e}`
        } else {
            UIResponse = e
        }
    } finally {
        doc.getElementById('putAddressMapAcknowledgement').textContent = UIResponse
    }
}
const putPrivateAddressMap = async () => {
    let UIResponse: string = ""
    let cruxID = doc.getElementById('privateUserVirtualAddress').value.split(",");
    let addressMap: IAddressMapping = {};
    [].forEach.call(doc.getElementsByName('publishPrivateAddressOption'), (el: HTMLInputElement) => {
        if (el.checked) {
            addressMap[el.attributes['currency'].nodeValue] = {
                addressHash: el.attributes['addressHash'].nodeValue,
                secIdentifier: el.attributes['secIdentifier'].nodeValue === "undefined" ? undefined : el.attributes['secIdentifier'].nodeValue
            }
        }
    });
    try {
        doc.getElementById('putPrivateAddressMapAcknowledgement').textContent = "Publishing your selected addresses PRIVATELY..."
        let {success, failures} = await cruxClient.putPrivateAddressMap(cruxID, addressMap)
        UIResponse = `successfully published: ${JSON.stringify(success)}, \nFailed publishing: ${JSON.stringify(failures, undefined, 4)}`
    } catch (e) {
        if (e instanceof CruxClientError) {
            UIResponse = `${e.errorCode}: ${e}`
        } else {
            UIResponse = e
        }
    } finally {
        doc.getElementById('putPrivateAddressMapAcknowledgement').textContent = UIResponse
    }
}
const putEnabledAssetGroups = async () => {
    let UIResponse: string = "Publishing your assetGroups configuration..."
    doc.getElementById('putEnabledAssetGroupsAcknowledgement').textContent = UIResponse
    try {
        const enabledAssetGroups = await cruxClient.putEnabledAssetGroups()
        UIResponse = `successfully enabledAssetGroups: [${enabledAssetGroups}]`
    } catch (e) {
        if (e instanceof CruxClientError) {
            UIResponse = `${e.errorCode}: ${e}`
        } else {
            UIResponse = e
        }
    } finally {
        doc.getElementById('putEnabledAssetGroupsAcknowledgement').textContent = UIResponse
    }
}
const getCruxIDState = async (): Promise<ICruxIDState> => {
    let UIResponse: string = "getting CruxIDState ..."
    let cruxIDStatus: ICruxIDState = {cruxID: null, status: {status: SubdomainRegistrationStatus.NONE, statusDetail: SubdomainRegistrationStatusDetail.NONE}}
    doc.getElementById('cruxIDStatus').textContent = UIResponse
    try {
        cruxIDStatus = await cruxClient.getCruxIDState()
        UIResponse = JSON.stringify(cruxIDStatus, undefined, 4)
    } catch (e) {
        if (e instanceof CruxClientError) {
            UIResponse = `${e.errorCode}: ${e}`
        } else {
            UIResponse = e
        }
    } finally {
        doc.getElementById('cruxIDStatus').textContent = UIResponse
    }
    return cruxIDStatus
}

const addToBlacklist = async (fullCruxIDs: string[]):Promise< {success: string[], failures: string[]}> => {
    return cruxClient.addToBlacklist(fullCruxIDs);
}

function handleCruxIDStatus(cruxIDStatus) {
    if (cruxIDStatus.status && ["DONE", "PENDING"].includes(cruxIDStatus.status.status)) {
        [].forEach.call(doc.getElementsByClassName('unregistered'), (el: HTMLElement) => {
            el.style.display = "none"
        });
        [].forEach.call(doc.getElementsByClassName('registered'), (el: HTMLElement) => {
            el.style.display = "block"
        });
    }
    // add hook to enable registered elements
    doc.getElementById('init').style.display = "none"
}

function initError(error) {
    let message = "CruxClient Initialization Error: \n" + error;
    alert(message);
    console.log(error);
    doc.getElementById('init').innerHTML = message;
}

// on page load
getCruxIDState()
    .then((cruxIDStatus) => {
        handleCruxIDStatus(cruxIDStatus);
    }).catch((error) => {
        initError(error)
    })
recievePaymentRequests();

// Declaring global variables to be accessible for (button clicks or debugging purposes)
declare global {
    interface Window {
        cruxClient: CruxWalletClient;
        wallet: CruxWalletClient;
        isCruxIDAvailable: Function;
        registerCruxID: Function;
        resolveCurrencyAddressForCruxID: Function;
        resolveAssetAddressForCruxID: Function;
        getAssetMap: Function;
        getAddressMap: Function;
        putAddressMap: Function;
        putPrivateAddressMap: Function;
        getEnabledAssetGroups: Function;
        putEnabledAssetGroups: Function;
        getCruxIDState: Function;
        addToBlacklist: Function;
        sendPaymentRequest: Function;
        recievePaymentRequests: Function;
    }
}

window.wallet = cruxClient;
window.isCruxIDAvailable = isCruxIDAvailable;
window.registerCruxID = registerCruxID;
window.resolveCurrencyAddressForCruxID = resolveCurrencyAddressForCruxID;
window.resolveAssetAddressForCruxID = resolveAssetAddressForCruxID;
window.getAssetMap = getAssetMap;
window.getAddressMap = getAddressMap;
window.putAddressMap = putAddressMap;
window.putPrivateAddressMap = putPrivateAddressMap;
window.getEnabledAssetGroups = getEnabledAssetGroups;
window.putEnabledAssetGroups = putEnabledAssetGroups;
window.getCruxIDState = getCruxIDState;
window.addToBlacklist = addToBlacklist;
window.addToBlacklist = addToBlacklist;
window.cruxClient = cruxClient;
window.sendPaymentRequest = sendPaymentRequest;
window.recievePaymentRequests = recievePaymentRequests;
window.CruxId = CruxId;
