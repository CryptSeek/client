import hashlib
import os

key_table = {}  # Store keys in memory


def generate_key_identifier(shared_key: bytes, nonce: bytes) -> str:
    """Creates a mutable key identifier by hashing the shared key with a nonce."""
    salted_key = shared_key + nonce
    return hashlib.sha256(salted_key).hexdigest()[:16]


def store_key(shared_key: bytes):
    """Stores shared encryption key in the hash table."""
    nonce = os.urandom(12)
    identifier = generate_key_identifier(shared_key, nonce)
    key_table[identifier] = shared_key
    return identifier, nonce


def find_decryption_key(identifier: str, nonce: bytes):
    """Finds the correct decryption key using the identifier."""
    for key in key_table.values():
        if generate_key_identifier(key, nonce) == identifier:
            return key
    return None  # No matching key found
