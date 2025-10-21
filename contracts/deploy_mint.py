import os
from pathlib import Path
from algosdk.v2client import algod
from algosdk import account, mnemonic, transaction
from algosdk.future.transaction import StateSchema, OnComplete, ApplicationCreateTxn
from dotenv import load_dotenv
import mint_asa_app as mint

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

# Compile programs
from pyteal import compileTeal, Mode
approval_teal = compileTeal(mint.approval(), Mode.Application, version=8)
clear_teal = compileTeal(mint.clear(), Mode.Application, version=8)

compiled_approval = client.compile(approval_teal)
compiled_clear = client.compile(clear_teal)

app_create = ApplicationCreateTxn(
    sender=pk,
    sp=params,
    on_complete=OnComplete.NoOpOC.real,
    approval_program=bytes.fromhex(compiled_approval["result"]),
    clear_program=bytes.fromhex(compiled_clear["result"]),
    global_schema=StateSchema(num_uints=1, num_byte_slices=1),
    local_schema=StateSchema(num_uints=0, num_byte_slices=0),
)

signed = app_create.sign(sk)
resp = client.send_transaction(signed)
print("Submitted tx:", resp)

# wait for confirmation
from algosdk.v2client import algod as algod_v2
from algosdk.future.transaction import wait_for_confirmation
wait = wait_for_confirmation(client, resp, 4)
app_id = wait["application-index"]
print("Mint app id:", app_id)
