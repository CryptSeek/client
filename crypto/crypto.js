// 1. AES Message Encryption & Decryption
encryptMessage(plaintext, key)
decryptMessage(ciphertext, key)

// 2. Key Table Lookup
generateKeyIdentifier(key, nonce)
storeKey(key)
findDecryptionKey(identifier, nonce)

// 3. Post-Quantum Key Exchange (calls Python backend)
getSignedPublicKey()
computeSharedKey(peerSignedKeyB64)
decryptSharedKey(ciphertextB64)
