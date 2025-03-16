import base64
from pqcrypto.kem.kyber512 import generate_keypair, encrypt, decrypt
from pqcrypto.sign.dilithium2 import generate_keypair as sign_keypair, sign, verify


class PQKeyExchange:
    def __init__(self):
        self.public_key, self.private_key = generate_keypair()
        self.sign_public_key, self.sign_private_key = sign_keypair()

    def get_signed_public_key(self):
        """Signs and returns the signed public key."""
        signature = sign(self.public_key, self.sign_private_key)
        return base64.b64encode(self.public_key + signature).decode()

    def compute_shared_key(self, peer_signed_key_b64):
        """Computes shared secret with peer’s public key."""
        peer_signed_key = base64.b64decode(peer_signed_key_b64)
        peer_public_key = peer_signed_key[:800]  # Kyber-512 public key size
        signature = peer_signed_key[800:]

        # Verify signature
        if not verify(peer_public_key, signature, self.sign_public_key):
            raise ValueError("Signature verification failed!")

        shared_secret, ciphertext = encrypt(peer_public_key)
        return shared_secret, base64.b64encode(ciphertext).decode()

    def decrypt_shared_key(self, ciphertext_b64):
        """Decrypts the received ciphertext to get the shared secret."""
        ciphertext = base64.b64decode(ciphertext_b64)
        return decrypt(ciphertext, self.private_key)
