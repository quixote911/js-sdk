import { CruxClient, IAddressMapping } from "../index";
// TODO: add optional import statement to use the build

let doc = (document as {
    getElementById: Function,
    getElementsByClassName: Function
})



// Demo wallet artifacts

let walletClientName = "cruxdev"
let encryptionKey = "fookey"
const wallet_btc_address = "1HX4KvtPdg9QUYwQE1kNqTAjmNaDG7w82V"
const wallet_eth_address = "0x0a2311594059b468c9897338b027c8782398b481"

let sampleAddressMap: IAddressMapping = {
    BTC: {
        addressHash: wallet_btc_address
    },
    ETH: {
        addressHash: wallet_eth_address
    }
};

let url = new URL(window.location.href);
encryptionKey = url.searchParams.get("overrideEncryptionKey") || encryptionKey;
walletClientName = url.searchParams.get("walletClientName") || walletClientName;

doc.getElementById('encryptionKey').textContent = `'${encryptionKey}'`;
[].forEach.call(doc.getElementsByClassName('walletClientName'), (el: HTMLElement) => { el.textContent = walletClientName })
doc.getElementById('userAddresses').textContent = Object.keys(sampleAddressMap).map((currency) => { console.log(sampleAddressMap); let address = sampleAddressMap[currency].addressHash; return `${currency.toUpperCase()} - ${address}` }).join('\n')




// --- @crux/js-sdk integration --- //


// defining cruxClientOptions
let cruxClientOptions = {
    getEncryptionKey: () => encryptionKey,
    walletClientName: walletClientName
}

// initialising the cruxClient
let cruxClient = new CruxClient(cruxClientOptions)
cruxClient.init().then(async () => {
    await getCruxIDState()
    doc.getElementById('init').style.display = "none"
}).catch((error) => {
    let message = "CruxClient Initialization Error: \n" + error
    alert(message)
    doc.getElementById('init').innerHTML = message
})


// SDK functional interface

const isCruxIDAvailable = async () => {
    let UIResponse: string = ""
    doc.getElementById('availability').textContent = "checking availability ..."
    let cruxID = doc.getElementById('registrationId').value
    try {
        let available = await cruxClient.isCruxIDAvailable(cruxID)
        UIResponse = available ? "available" : "unavailable"
    } catch (e) {
        UIResponse = e
    } finally {
        doc.getElementById('availability').textContent = UIResponse
    }
}
const registerCruxID = async () => {
    let UIResponse: string = ""
    let cruxID = doc.getElementById('newSubdomain').value
    let newAddressMap = sampleAddressMap
    try {
        await cruxClient.registerCruxID(cruxID, newAddressMap)
        UIResponse = "cruxID registration initiated!"
    } catch (e) {
        UIResponse = e
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
        UIResponse = e
    } finally {
        doc.getElementById('addresses').textContent = UIResponse
    }

}
const getAddressMap = async () => {
    let UIResponse: string = ""
    try {
        let addressMap = await cruxClient.getAddressMap()
        UIResponse = JSON.stringify(addressMap, undefined, 4)
    } catch (e) {
        UIResponse = e
    } finally {
        doc.getElementById('addressMap').textContent = UIResponse
    }    
}
const putAddressMap = async () => {
    let UIResponse: string = ""
    try {
        let acknowledgement = await cruxClient.putAddressMap(sampleAddressMap)
        UIResponse = acknowledgement ? "successfully published addresses!" : acknowledgement.toString()
    } catch (e) {
        UIResponse = e
    } finally {
        doc.getElementById('putAddressMapAcknowledgement').textContent = UIResponse
    }    
}
const getCruxIDState = async () => {
    let UIResponse: string = ""
    try {
        let cruxIDStatus = await cruxClient.getCruxIDState()
        UIResponse = JSON.stringify(cruxIDStatus, undefined, 4)
    } catch (e) {
        UIResponse = e
    } finally {
        doc.getElementById('cruxIDStatus').textContent = UIResponse
    }    
}
const updatePassword = async () => { 
    let UIResponse: string = ""
    let oldEncryptionKey = doc.getElementById('oldEncryptionKey').value
    let newEncryptionKey = doc.getElementById('newEncryptionKey').value
    try {
        await cruxClient.updatePassword(oldEncryptionKey, newEncryptionKey)
        UIResponse = 'updated password successfully!'
    } catch (e) {
        UIResponse = e
    } finally {
        doc.getElementById('passwordUpdateAcknowledgement').textContent = UIResponse
    }
}


// Declaring global variables to be accessible for (button clicks or debugging purposes)
declare global {
    interface Window {
        wallet: CruxClient;
        isCruxIDAvailable: Function;
        registerCruxID: Function;
        resolveCurrencyAddressForCruxID: Function;
        getAddressMap: Function;
        putAddressMap: Function;
        getCruxIDState: Function;
        updatePassword: Function;
    }
}

window.wallet = cruxClient;
window.isCruxIDAvailable = isCruxIDAvailable;
window.registerCruxID = registerCruxID;
window.resolveCurrencyAddressForCruxID = resolveCurrencyAddressForCruxID;
window.getAddressMap = getAddressMap;
window.putAddressMap = putAddressMap;
window.getCruxIDState = getCruxIDState;
window.updatePassword = updatePassword;
