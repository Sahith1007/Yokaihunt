import os
from pathlib import Path
from pyteal import compileTeal, Mode
import mint_asa_app as mint
import marketplace_app as market

BUILD = Path(__file__).parent / "build"
BUILD.mkdir(exist_ok=True)

with open(BUILD / "mint_approval.teal", "w", encoding="utf-8") as f:
    f.write(compileTeal(mint.approval(), mode=Mode.Application, version=8))
with open(BUILD / "mint_clear.teal", "w", encoding="utf-8") as f:
    f.write(compileTeal(mint.clear(), mode=Mode.Application, version=8))

with open(BUILD / "market_approval.teal", "w", encoding="utf-8") as f:
    f.write(compileTeal(market.approval(), mode=Mode.Application, version=8))
with open(BUILD / "market_clear.teal", "w", encoding="utf-8") as f:
    f.write(compileTeal(market.clear(), mode=Mode.Application, version=8))

print(f"Wrote TEAL to {BUILD}")
