import argparse
import asyncio
from collections import defaultdict
from dataclasses import dataclass, field


PACKET_CONNECT = 1
PACKET_CONNACK = 2
PACKET_PUBLISH = 3
PACKET_SUBSCRIBE = 8
PACKET_SUBACK = 9
PACKET_PINGREQ = 12
PACKET_PINGRESP = 13
PACKET_DISCONNECT = 14


def encode_remaining_length(length):
    encoded = bytearray()
    while True:
        digit = length % 128
        length //= 128
        if length > 0:
            digit |= 0x80
        encoded.append(digit)
        if length == 0:
            return bytes(encoded)


async def read_remaining_length(reader):
    multiplier = 1
    value = 0

    while True:
        encoded = await reader.readexactly(1)
        digit = encoded[0]
        value += (digit & 127) * multiplier
        if (digit & 128) == 0:
            return value
        multiplier *= 128
        if multiplier > 128 * 128 * 128:
            raise ValueError("remaining length invalido")


def read_utf(payload, offset):
    length = int.from_bytes(payload[offset : offset + 2], "big")
    offset += 2
    value = payload[offset : offset + length].decode("utf-8", errors="replace")
    return value, offset + length


def write_utf(value):
    data = value.encode("utf-8")
    return len(data).to_bytes(2, "big") + data


def make_packet(packet_type, payload=b"", flags=0):
    header = bytes([(packet_type << 4) | flags])
    return header + encode_remaining_length(len(payload)) + payload


@dataclass(eq=False)
class Client:
    reader: asyncio.StreamReader
    writer: asyncio.StreamWriter
    client_id: str = "desconhecido"
    subscriptions: set[str] = field(default_factory=set)

    def peer(self):
        return self.writer.get_extra_info("peername")


class LocalMqttBroker:
    def __init__(self):
        self.clients = set()
        self.subscriptions = defaultdict(set)

    async def start(self, host, port):
        server = await asyncio.start_server(self.handle_client, host, port)
        addresses = ", ".join(str(sock.getsockname()) for sock in server.sockets)
        print(f"[broker] MQTT local ouvindo em {addresses}")
        async with server:
            await server.serve_forever()

    async def handle_client(self, reader, writer):
        client = Client(reader=reader, writer=writer)
        self.clients.add(client)
        print(f"[broker] cliente conectado: {client.peer()}")

        try:
            while True:
                fixed_header = await reader.readexactly(1)
                packet_type = fixed_header[0] >> 4
                flags = fixed_header[0] & 0x0F
                remaining_length = await read_remaining_length(reader)
                payload = await reader.readexactly(remaining_length)

                if packet_type == PACKET_CONNECT:
                    await self.handle_connect(client, payload)
                elif packet_type == PACKET_SUBSCRIBE:
                    await self.handle_subscribe(client, payload)
                elif packet_type == PACKET_PUBLISH:
                    await self.handle_publish(client, flags, payload)
                elif packet_type == PACKET_PINGREQ:
                    writer.write(make_packet(PACKET_PINGRESP))
                    await writer.drain()
                elif packet_type == PACKET_DISCONNECT:
                    break
        except asyncio.IncompleteReadError:
            pass
        except Exception as error:
            print(f"[broker] erro em {client.client_id}: {error}")
        finally:
            self.remove_client(client)
            writer.close()
            await writer.wait_closed()
            print(f"[broker] cliente saiu: {client.client_id}")

    async def handle_connect(self, client, payload):
        protocol_name, offset = read_utf(payload, 0)
        protocol_level = payload[offset]
        offset += 1
        connect_flags = payload[offset]
        offset += 1
        offset += 2

        if protocol_name != "MQTT" or protocol_level not in (4, 5):
            client.writer.write(make_packet(PACKET_CONNACK, b"\x00\x01"))
            await client.writer.drain()
            return

        client_id, offset = read_utf(payload, offset)
        client.client_id = client_id or f"client-{id(client)}"

        has_will = connect_flags & 0x04
        has_username = connect_flags & 0x80
        has_password = connect_flags & 0x40
        if has_will:
            _, offset = read_utf(payload, offset)
            _, offset = read_utf(payload, offset)
        if has_username:
            _, offset = read_utf(payload, offset)
        if has_password:
            _, offset = read_utf(payload, offset)

        # MQTT 3.1.1 CONNACK: session present false, return code accepted.
        client.writer.write(make_packet(PACKET_CONNACK, b"\x00\x00"))
        await client.writer.drain()
        print(f"[broker] CONNACK: {client.client_id}")

    async def handle_subscribe(self, client, payload):
        packet_id = payload[:2]
        offset = 2
        granted_qos = bytearray()

        while offset < len(payload):
            topic, offset = read_utf(payload, offset)
            requested_qos = payload[offset] & 0x03
            offset += 1
            client.subscriptions.add(topic)
            self.subscriptions[topic].add(client)
            granted_qos.append(min(requested_qos, 0))
            print(f"[broker] {client.client_id} assinou {topic}")

        client.writer.write(make_packet(PACKET_SUBACK, packet_id + bytes(granted_qos)))
        await client.writer.drain()

    async def handle_publish(self, client, flags, payload):
        topic, offset = read_utf(payload, 0)
        qos = (flags >> 1) & 0x03
        if qos:
            raise ValueError("este broker local aceita apenas QoS 0")

        message = payload[offset:]
        subscribers = list(self.subscriptions.get(topic, set()))
        print(f"[broker] {client.client_id} publicou {topic}: {message.decode('utf-8', errors='replace')}")

        packet = make_packet(PACKET_PUBLISH, write_utf(topic) + message)
        for subscriber in subscribers:
            if subscriber.writer.is_closing():
                continue
            subscriber.writer.write(packet)
            await subscriber.writer.drain()

    def remove_client(self, client):
        self.clients.discard(client)
        for topic in list(client.subscriptions):
            self.subscriptions[topic].discard(client)
            if not self.subscriptions[topic]:
                del self.subscriptions[topic]


def parse_args():
    parser = argparse.ArgumentParser(description="Broker MQTT local simples para a demo Wokwi.")
    parser.add_argument("--host", default="0.0.0.0", help="Interface para escutar.")
    parser.add_argument("--port", default=1883, type=int, help="Porta MQTT.")
    return parser.parse_args()


def main():
    args = parse_args()
    broker = LocalMqttBroker()
    asyncio.run(broker.start(args.host, args.port))


if __name__ == "__main__":
    main()
