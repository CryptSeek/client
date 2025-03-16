from Crypto.Cipher import AES
import os


def encrypt_message(message: str, key: bytes) -> bytes:
    """Encrypts a message with AES-GCM."""
    nonce = os.urandom(12)
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    ciphertext, tag = cipher.encrypt_and_digest(message.encode())
    return nonce + ciphertext + tag


def decrypt_message(encrypted_message: bytes, key: bytes) -> str:
    """Decrypts an AES-GCM encrypted message."""
    nonce, ciphertext, tag = encrypted_message[:12], encrypted_message[12:-16], encrypted_message[-16:]
    cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
    return cipher.decrypt_and_verify(ciphertext, tag).decode()

