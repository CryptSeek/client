import zmq
from crypto.pq_key_exchange import PQKeyExchange
from crypto.encryption import encrypt_message, decrypt_message
from crypto.key_lookup import store_key, find_decryption_key

SERVER_ADDRESS = "tcp://localhost:5555"


class PQMessagingClient:
    def __init__(self):
        self.context = zmq.Context()
        self.socket = self.context.socket(zmq.REQ)
        self.socket.connect(SERVER_ADDRESS)
        self.key_exchange = PQKeyExchange()
        self.shared_key = None

    def perform_key_exchange(self):
        """Send public key to server and receive peer’s key"""
        signed_public_key = self.key_exchange.get_signed_public_key()
        self.socket.send_string(f"KEY:{signed_public_key}")

        response = self.socket.recv_string()
        if response.startswith("CIPHERTEXT:"):
            shared_secret, ciphertext = self.key_exchange.compute_shared_key(response.split(":")[1])
            self.shared_key = self.key_exchange.decrypt_shared_key(ciphertext)
            print("Secure connection established!")

    def send_message(self, message):
        """Encrypt and send message with key identifier"""
        identifier, nonce = store_key(self.shared_key)
        encrypted_msg = encrypt_message(message, self.shared_key)
        self.socket.send_json({"nonce": nonce.hex(), "identifier": identifier, "message": encrypted_msg.hex()})
        print("Message sent!")

    def receive_message(self):
        """Receive and decrypt message"""
        response = self.socket.recv_json()
        nonce = bytes.fromhex(response["nonce"])
        identifier = response["identifier"]
        encrypted_msg = bytes.fromhex(response["message"])

        decryption_key = find_decryption_key(identifier, nonce)
        if decryption_key:
            decrypted_msg = decrypt_message(encrypted_msg, decryption_key)
            print(f"Received: {decrypted_msg}")
        else:
            print("No matching decryption key found.")


client = PQMessagingClient()
client.perform_key_exchange()
client.send_message("Hello, post-quantum world!")
client.receive_message()
