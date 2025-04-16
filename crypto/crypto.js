// crypto.js
// Implements CryptSeek's full cryptography module in JavaScript
// Includes: AES-GCM encryption, mutable key identifiers, and a placeholder for PQ key exchange

const crypto = require('crypto');

///////////////////////
// AES-GCM Functions //
///////////////////////


// Encrypts a message with AES-GCM
function encryptMessage(message, key) {
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
    const ciphertext = Buffer.concat([cipher.update(message, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([nonce, ciphertext, tag]);
}

// Decrypts an AES-GCM encrypted message
function decryptMessage(encrypted, key) {
    const nonce = encrypted.slice(0, 12);
    const tag = encrypted.slice(encrypted.length - 16);
    const ciphertext = encrypted.slice(12, encrypted.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
}

/////////////////////////////
// Key Storage & Lookup   //
/////////////////////////////

const keyTable = {}; // { identifier: key }

// Creates a mutable key identifier by hashing the shared key with a nonce
function generateKeyIdentifier(sharedKey, nonce) {
    const salted = Buffer.concat([sharedKey, nonce]);
    const hash = crypto.createHash('sha256').update(salted).digest('hex');
    return hash.slice(0, 16); // short ID
}

// Stores shared encryption key in the hash table
function storeKey(sharedKey) {
    const nonce = crypto.randomBytes(12);
    const identifier = generateKeyIdentifier(sharedKey, nonce);
    keyTable[identifier] = sharedKey;
    return { identifier, nonce };
}

// Finds the correct decryption key using the identifier and nonce
function findKey(identifier, nonce) {
    for (const key of Object.values(keyTable)) {
        const testId = generateKeyIdentifier(key, nonce);
        if (testId === identifier) {
            return key;
        }
    }
    return null;
}

///////////////////////////////////////
// Post-Quantum Key Exchange (TODO) //
///////////////////////////////////////

// Note: This section is a placeholder.
// Implementation needs to be based around RSA

const pqKeyExchange = {
    init: () => {
        throw new Error("Post-Quantum key exchange not yet implemented in JS");
    },
    getSignedPublicKey: () => {
        throw new Error("getSignedPublicKey not implemented");
    },
    computeSharedKey: (peerSignedPubKey) => {
        throw new Error("computeSharedKey not implemented");
    },
    decryptSharedKey: (ciphertext) => {
        throw new Error("decryptSharedKey not implemented");
    }
};

///////////////////////
// Module Exports    //
///////////////////////

module.exports = {
    encryptMessage,
    decryptMessage,
    storeKey,
    findKey,
    generateKeyIdentifier,
    pqKeyExchange
};

