import os
from algosdk.v2client import algod
from algosdk import account, mnemonic
from algosdk.future import transaction as txn
from dotenv import load_dotenv
import marketplace_app as market
from pyteal import compileTeal, Mode

load_dotenv()
ALGOD_URL = os.getenv("ALGOD_URL", "http://localhost")
ALGOD_TOKEN = os.getenv("ALGOD_TOKEN", "a" * 64)
ALGOD_PORT = int(os.getenv("ALGOD_PORT", "4001"))
MNEMONIC = os.getenv("MNEMONIC", "")

client = algod.AlgodClient(ALGOD_TOKEN, ALGOD_URL, ALGOD_PORT)
if not MNEMONIC:
    raise SystemExit("Set MNEMONIC in .env to deploy.")

sk = mnemonic.to_private_key(MNEMONIC)
pk = account.address_from_private_key(sk)

params = client.suggested_params()

approval_teal = compileTeal(market.approval(), Mode.Application, version=8)
clear_teal = compileTeal(market.clear(), Mode.Application, version=8)

compiled_approval = client.compile(approval_teal)
compiled_clear = client.compile(clear_teal)

app_create = txn.ApplicationCreateTxn(
    sender=pk,
    sp=params,
    on_complete=txn.OnComplete.NoOpOC.real,
    approval_program=bytes.fromhex(compiled_approval["result"]),
    clear_program=bytes.fromhex(compiled_clear["result"]),
    global_schema=txn.StateSchema(num_uints=0, num_byte_slices=0),
    local_schema=txn.StateSchema(num_uints=0, num_byte_slices=0),
    # box storage is used; specify expected number of boxes later when calling methods if needed
)

signed = app_create.sign(sk)
hash_ = client.send_transaction(signed)
from algosdk.future.transaction import wait_for_confirmation
res = wait_for_confirmation(client, hash_, 4)
print("Marketplace app id:", res["application-index"])