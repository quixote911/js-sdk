// import { CruxClient, IAddressMapping, ICruxIDState, ICruxClientOptions, errors, storage } from "../index";
import { CruxPay } from "../index";
const { storage, errors } = CruxPay;

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
const wallet_btc_address = "1HX4KvtPdg9QUYwQE1kNqTAjmNaDG7w82V"
const wallet_eth_address = "0x0a2311594059b468c9897338b027c8782398b481"
const wallet_trx_address = "TG3iFaVvUs34SGpWq8RG9gnagDLTe1jdyz"
const wallet_xrp_address = "rpfKAA2Ezqoq5wWo3XENdLYdZ8YGziz48h"
const wallet_xrp_sec_identifier = "12345"

const sampleAddressMap = {
    btc: {
        addressHash: wallet_btc_address
    },
    eth: {
        addressHash: wallet_eth_address
    },
    trx: {
        addressHash: wallet_trx_address
    },
    xrp: {
        addressHash: wallet_xrp_address,
        secIdentifier: wallet_xrp_sec_identifier
    }
};

const url = new URL(window.location.href);
mode = url.searchParams.get("mode") || mode;
walletClientName = url.searchParams.get("walletClientName") || walletClientName;

doc.getElementById('mode').textContent = `'${mode}'`;
[].forEach.call(doc.getElementsByClassName('walletClientName'), (el: HTMLElement) => { el.textContent = walletClientName })
doc.getElementById('currency').innerHTML = Object.keys(sampleAddressMap).map((currency) => { return `<option value="${currency}">${currency}</option>` }).join('\n')
doc.getElementById('userAddresses').textContent = Object.keys(sampleAddressMap).map((currency) => { let address = sampleAddressMap[currency].addressHash; let secIdentifier = sampleAddressMap[currency].secIdentifier; return `${currency.toUpperCase()} - ${address} ${secIdentifier ? `(${secIdentifier})` : '' }` }).join('\n')
doc.getElementById('publishAddresses').innerHTML = Object.keys(sampleAddressMap).map((currency) => { let address = sampleAddressMap[currency].addressHash; let secIdentifier = sampleAddressMap[currency].secIdentifier; return `<input type="checkbox" name="publishAddressOption" currency="${currency.toUpperCase()}" addressHash="${address}" secIdentifier="${secIdentifier}" checked>${currency.toUpperCase()}` }).join('\n')


// --- @crux/js-sdk integration --- //
// defining cruxClientOptions
const cruxClientOptions = {
    walletClientName: walletClientName,
    cacheStorage: new storage.LocalStorage(),
    // privateKey: "cdf2d276caf0c9c34258ed6ebd0e60e0e8b3d9a7b8a9a717f2e19ed9b37f7c6f",
}

// initialising the cruxClient
const cruxClient = new CruxPay.CruxClient(cruxClientOptions)


// SDK functional interface

const isCruxIDAvailable = async () => {
    let UIResponse: string = ""
    doc.getElementById('availability').textContent = "checking availability ..."
    let cruxID = doc.getElementById('registrationId').value
    try {
        let available = await cruxClient.isCruxIDAvailable(cruxID)
        UIResponse = available ? "available" : "unavailable"
    } catch (e) {
        if (e instanceof errors.CruxClientError) {
            UIResponse = `${e.errorCode}: ${e}`
        } else {
            UIResponse = e
        }

    } finally {
        doc.getElementById('availability').textContent = UIResponse
    }
}
const registerCruxID = async () => {
    let UIResponse: string = ""
    let cruxID = doc.getElementById('newSubdomain').value
    try {
        await cruxClient.registerCruxID(cruxID)
        UIResponse = 'cruxID registration initiated!'
        try {
            const { success, failures } = await cruxClient.putAddressMap(sampleAddressMap)
            UIResponse += `\nsuccessfully published: ${JSON.stringify(success)}, \nFailed publishing: ${JSON.stringify(failures, undefined, 4)}`
        } catch (e_1) {
            if (e_1 instanceof errors.CruxClientError) {
                UIResponse += `\n${e_1.errorCode}: ${e_1}`
            } else {
                UIResponse += '\n' + e_1
            }
        }
    } catch (e) {
        if (e instanceof errors.CruxClientError) {
            UIResponse = `${e.errorCode}: ${e}`
        } else {
            UIResponse = e
        }
    } finally {
        doc.getElementById('registrationAcknowledgement').textContent = UIResponse
    }
}
const resolveCurrencyAddressForCruxID = async () => {
    let UIResponse: string = ""
    let cruxID = doc.getElementById('receiverVirtualAddress').value
    let walletCurrencySymbol = doc.getElementById('currency').value
    doc.getElementById('addresses').textContent = `resolving cruxID (${cruxID}) ${walletCurrencySymbol} address ...`
    try {
        let resolvedAddress = await cruxClient.resolveCurrencyAddressForCruxID(cruxID, walletCurrencySymbol)
        UIResponse = JSON.stringify(resolvedAddress, undefined, 4)
    } catch (e) {
        if (e instanceof errors.CruxClientError) {
            UIResponse = `${e.errorCode}: ${e}`
        } else {
            UIResponse = e
        }
    } finally {
        doc.getElementById('addresses').textContent = UIResponse
    }

}
const getAssetMap = async () => {
    let UIResponse: string = ""
    try {
        let assetMap = await cruxClient.getAssetMap()
        UIResponse = JSON.stringify(assetMap, undefined, 4)
    } catch (e) {
        if (e instanceof errors.CruxClientError) {
            UIResponse = `${e.errorCode}: ${e}`
        } else {
            UIResponse = e
        }
    } finally {
        doc.getElementById('assetMap').textContent = UIResponse
    }
}
const getAddressMap = async () => {
    let UIResponse: string = ""
    try {
        let addressMap = await cruxClient.getAddressMap()
        UIResponse = JSON.stringify(addressMap, undefined, 4)
    } catch (e) {
        if (e instanceof errors.CruxClientError) {
            UIResponse = `${e.errorCode}: ${e}`
        } else {
            UIResponse = e
        }
    } finally {
        doc.getElementById('addressMap').textContent = UIResponse
    }
}
const putAddressMap = async () => {
    let UIResponse: string = ""
    let addressMap = {};
    [].forEach.call(doc.getElementsByName('publishAddressOption'), (el: HTMLInputElement) => {
        if (el.checked) {
            addressMap[el.attributes['currency'].nodeValue] = {
                addressHash: el.attributes['addressHash'].nodeValue,
                secIdentifier: el.attributes['secIdentifier'].nodeValue === "undefined" ? undefined : el.attributes['secIdentifier'].nodeValue
            }
        }
    });
    try {
        doc.getElementById('putAddressMapAcknowledgement').textContent = "Publishing your selected addresses..."
        let {success, failures} = await cruxClient.putAddressMap(addressMap)
        UIResponse = `successfully published: ${JSON.stringify(success)}, \nFailed publishing: ${JSON.stringify(failures, undefined, 4)}`
    } catch (e) {
        if (e instanceof errors.CruxClientError) {
            UIResponse = `${e.errorCode}: ${e}`
        } else {
            UIResponse = e
        }
    } finally {
        doc.getElementById('putAddressMapAcknowledgement').textContent = UIResponse
    }
}
const getCruxIDState = async () => {
    let UIResponse: string = ""
    let cruxIDStatus = {cruxID: null, status: {status: "NONE", statusDetail: ""}}
    try {
        cruxIDStatus = await cruxClient.getCruxIDState()
        UIResponse = JSON.stringify(cruxIDStatus, undefined, 4)
    } catch (e) {
        if (e instanceof errors.CruxClientError) {
            UIResponse = `${e.errorCode}: ${e}`
        } else {
            UIResponse = e
        }
    } finally {
        doc.getElementById('cruxIDStatus').textContent = UIResponse
    }
    return cruxIDStatus
}

function handleCruxIDStatus(cruxIDStatus) {
    if (cruxIDStatus.status.status === "DONE") {
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

if (mode === "withoutInit") {
    console.log("withoutInit mode");
    getCruxIDState()
        .then((cruxIDStatus) => {
            handleCruxIDStatus(cruxIDStatus);
        }).catch((error) => {
            initError(error)
        })
} else {
    console.log("withInit mode");
    cruxClient.init()
        .then(async () => {
            let cruxIDStatus = await getCruxIDState();
            handleCruxIDStatus(cruxIDStatus);
        }).catch((error) => {
            initError(error)
        })
}

// Declaring global variables to be accessible for (button clicks or debugging purposes)
declare global {
    interface Window {
        wallet: CruxPay.CruxClient;
        isCruxIDAvailable: Function;
        registerCruxID: Function;
        resolveCurrencyAddressForCruxID: Function;
        getAssetMap: Function;
        getAddressMap: Function;
        putAddressMap: Function;
        getCruxIDState: Function;
    }
}

window.wallet = cruxClient;
window.isCruxIDAvailable = isCruxIDAvailable;
window.registerCruxID = registerCruxID;
window.resolveCurrencyAddressForCruxID = resolveCurrencyAddressForCruxID;
window.getAssetMap = getAssetMap;
window.getAddressMap = getAddressMap;
window.putAddressMap = putAddressMap;
window.getCruxIDState = getCruxIDState;