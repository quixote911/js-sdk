import * as ncrypto from "crypto";
// @ts-ignore
import * as eccrypto from "eccrypto";
import {IKeyManager} from "../core/interfaces";
import {ErrorHelper, PackageErrorCode} from "./error";

const typedArrayToBuffer = (array: Uint8Array): ArrayBuffer => {
    return array.buffer.slice(array.byteOffset, array.byteLength + array.byteOffset);
};

export class Encryption {

    public static hash = (value: string): string => {
        const valueUtf8 = Buffer.from(value, "UTF-8");
        const hash = ncrypto.createHash("sha256");
        hash.update(valueUtf8);
        return hash.digest("hex");
    }

    public static encryptJSON = async (jsonObj: object, password: string): Promise<{encBuffer: string, iv: string}> => {
        const plainText = JSON.stringify(jsonObj);
        return Encryption.encryptText(plainText, password);
    }

    public static decryptJSON = async (ctBufferBase64: string, ivBase64: string, password: string): Promise<object> => {
        const JSONString = await Encryption.decryptText(ctBufferBase64, ivBase64, password);
        return JSON.parse(JSONString);
    }
​
    public static encryptText = async (plainText: string, password: string): Promise<{ encBuffer: string; iv: string }> => {
        const ptUtf8 = Buffer.from(plainText, "UTF-8");
        const pwUtf8 = Buffer.from(password, "UTF-8");
        const encrypt = (text: any, eiv: any, ekey: any) => {
            const cipher = ncrypto.createCipheriv("aes-256-gcm", Buffer.from(ekey), Buffer.from(eiv));
            let encrypted = cipher.update(text);
            encrypted = Buffer.concat([encrypted, cipher.final(), cipher.getAuthTag()]);
            return { iv: Buffer.from(eiv).toString("base64"), encBuffer: encrypted.toString("base64") };
        };
        const hash = ncrypto.createHash("sha256");
        hash.update(pwUtf8);
        const pwHash = typedArrayToBuffer(hash.digest());
        const iv = crypto.getRandomValues(new Uint8Array(12));
        return encrypt(ptUtf8, iv, pwHash);
    }

    public static decryptText = async (ctBufferBase64: string, ivBase64: string, password: string): Promise<string> => {
        const ctBuffer = Buffer.from(ctBufferBase64, "base64");
        const iv = Buffer.from(ivBase64, "base64");
        const pwUtf8 = Buffer.from(password);
        const hash = ncrypto.createHash("sha256");
        hash.update(pwUtf8);
        const pwHash = typedArrayToBuffer(hash.digest());
        const decrypt = (buffer: any, eiv: any, ekey: any, tagLength: any) => {
            const decipher = ncrypto.createDecipheriv("aes-256-gcm", Buffer.from(ekey), eiv);
            const tag = buffer.slice(buffer.byteLength - tagLength);
            const text = buffer.slice(0, buffer.byteLength - tagLength);
            decipher.setAuthTag(tag);
            return Buffer.concat([decipher.update(text), decipher.final()]);
        };
        let ptBuffer;
        try {
            ptBuffer = decrypt(ctBuffer, iv, pwHash, 16);
        } catch (err) {
            if (err instanceof DOMException) {
                throw ErrorHelper.getPackageError(err, PackageErrorCode.DecryptionFailed);
            }
            throw err;
        }
        return ptBuffer.toString();
    }
}

export class ECIESEncryption {
    public static encrypt = async (content: ArrayBuffer, publicKey: string): Promise<object> => {
        return eccrypto.encrypt(Buffer.from(publicKey, "hex"), content);
    }
    public static decrypt = async (encryptedContent: object, privateKey: string): Promise<string> => {
        return eccrypto.decrypt(Buffer.from(privateKey, "hex"), encryptedContent);
    }
}
