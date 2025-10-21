import os
from algosdk.v2client import algod
from algosdk import account, mnemonic
from algosdk.future import transaction as txn
from dotenv import load_dotenv

load_dotenv()
ALGOD_URL = os.getenv("ALGOD_URL", "http://localhost")
ALGOD_TOKEN = os.getenv("ALGOD_TOKEN", "a" * 64)
ALGOD_PORT = int(os.getenv("ALGOD_PORT", "4001"))
MNEMONIC_BUYER = os.getenv("MNEMONIC_BUYER", "")
MNEMONIC_SELLER = os.getenv("MNEMONIC_SELLER", "")
APP_ID = int(os.getenv("MARKET_APP_ID", "0"))
ASSET_ID = int(os.getenv("ASSET_ID", "0"))
PRICE = int(os.getenv("PRICE_UALGOS", "1000000"))  # 1 Algo

if not (MNEMONIC_BUYER and MNEMONIC_SELLER and APP_ID and ASSET_ID):
    raise SystemExit("Set MNEMONIC_BUYER, MNEMONIC_SELLER, MARKET_APP_ID, ASSET_ID in .env")

client = algod.AlgodClient(ALGOD_TOKEN, ALGOD_URL, ALGOD_PORT)

buyer_sk = mnemonic.to_private_key(MNEMONIC_BUYER)
buyer_addr = account.address_from_private_key(buyer_sk)
seller_sk = mnemonic.to_private_key(MNEMONIC_SELLER)
seller_addr = account.address_from_private_key(seller_sk)

sp = client.suggested_params()

# 0: AppCall (buy)
app_call = txn.ApplicationNoOpTxn(sender=buyer_addr, sp=sp, index=APP_ID, app_args=[b"buy", ASSET_ID.to_bytes(8, "big")])

# 1: Payment (buyer -> seller)
payment = txn.PaymentTxn(sender=buyer_addr, sp=sp, receiver=seller_addr, amt=PRICE)

# 2: Asset transfer (seller -> buyer)
asset_xfer = txn.AssetTransferTxn(sender=seller_addr, sp=sp, receiver=buyer_addr, amt=1, index=ASSET_ID)

# Group and sign
gid = txn.calculate_group_id([app_call, payment, asset_xfer])
app_call.group = gid
payment.group = gid
asset_xfer.group = gid

stx0 = app_call.sign(buyer_sk)
stx1 = payment.sign(buyer_sk)
stx2 = asset_xfer.sign(seller_sk)

client.send_transactions([stx0, stx1, stx2])
from algosdk.future.transaction import wait_for_confirmation
print("Submitted atomic swap; waiting...")
res = wait_for_confirmation(client, stx0.get_txid(), 4)
print("Confirmed round:", res.get("confirmed-round"))
