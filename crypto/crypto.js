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
    const ciphertext = Buffer.concat([
        cipher.update(message, 'utf8'),
        cipher.final()
    ]);
    const tag = cipher.getAuthTag();
    const encrypted = Buffer.concat([nonce, ciphertext, tag]);
    // Return as Base64 string to make transmission safer
    return encrypted.toString('base64');
}

// Decrypts an AES-GCM encrypted message
function decryptMessage(base64Encrypted, key) {
    const encrypted = Buffer.from(base64Encrypted, 'base64');
    const nonce = encrypted.slice(0, 12);
    const ciphertext = encrypted.slice(12, encrypted.length - 16);
    const tag = encrypted.slice(encrypted.length - 16);

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(tag);

    try {
        const decrypted = Buffer.concat([
            decipher.update(ciphertext),
            decipher.final()
        ]);
        return decrypted.toString('utf8');
    } catch (err) {
        console.error("AES-GCM decryption failed:", err);
        throw err;
    }
}

/////////////////////////////
// Key Storage & Lookup   //
/////////////////////////////

const keyTable = {}; // { identifier: key }

// Creates a mutable key identifier by hashing the shared key with sender's
function generateKeyIdentifier(sharedKey, senderName) {
    if (!senderName || typeof senderName !== 'string') {
        throw new TypeError("Sender name must be a non-empty string");
    }
    const salted = Buffer.concat([sharedKey, Buffer.from(senderName)]);
    const hash = crypto.createHash('sha256').update(salted).digest('hex');
    return hash.slice(0, 16);
}

function storeKey(sharedKey, senderName) {
    const identifier = generateKeyIdentifier(sharedKey, senderName);
    keyTable[identifier] = sharedKey;
    return { identifier };
}

// Finds the correct decryption key using the identifier and nonce
function findKey(identifier, senderName) {
    for (const key of Object.values(keyTable)) {
        const testId = generateKeyIdentifier(key, senderName);
        if (testId === identifier) {
            return key;
        }
    }
    return null;
}

// ------------------------------
// RSA Key Exchange (NodeJS)
// ------------------------------
const fs = require('fs');
const path = require('path');

function getKeyPath() {
    const { app } = require('electron');
    return path.join(app.getPath('userData'), 'rsa_keypair.json');
}

function generateRSAKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    });

    fs.writeFileSync(keyPath, JSON.stringify({ publicKey, privateKey }));
    return { publicKey, privateKey };
}

function loadRSAKeyPair() {
    if (!fs.existsSync(keyPath)) {
        return generateRSAKeyPair();
    }
    const { publicKey, privateKey } = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    return { publicKey, privateKey };
}

function encryptAESKeyWithRSA(publicKey, aesKey) {
    return crypto.publicEncrypt(publicKey, aesKey).toString('base64');
}

function decryptAESKeyWithRSA(ciphertextB64, privateKey) {
    const buffer = Buffer.from(ciphertextB64, 'base64');
    return crypto.privateDecrypt(privateKey, buffer);
}

///////////////////////
// Module Exports    //
///////////////////////

module.exports = {
    encryptMessage,
    decryptMessage,
    storeKey,
    findKey,
    getKeyPath,
    generateKeyIdentifier,
    generateRSAKeyPair,
    loadRSAKeyPair,
    encryptAESKeyWithRSA,
    decryptAESKeyWithRSA
};

