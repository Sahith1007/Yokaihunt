from pyteal import *

# Simple marketplace: list ASA (price, seller) and require atomic payment + asset transfer in group
# Uses boxes to store listings keyed by asset_id (Itob(asset_id))

KEY_PRICE_SELLER = Bytes("ps")  # unused, kept for clarity

@Subroutine(TealType.bytes)
def box_key(asset_id: Expr) -> Expr:
    return Itob(asset_id)

@Subroutine(TealType.none)
def box_put_listing(asset_id: Expr, seller: Expr, price: Expr):  # seller: Addr, price: uint64
    return Seq(
        Assert(Len(seller) == Int(32)),
        Assert(price > Int(0)),
        # value = seller(32) || price(8)
        App.box_put(box_key(asset_id), Concat(seller, Itob(price))),
    )

@Subroutine(TealType.none)
def box_del_listing(asset_id: Expr):
    return Seq(
        (ok := ScratchVar(TealType.uint64)).store(Int(0)),
        (val := ScratchVar(TealType.bytes)).store(Bytes("")),
        Seq(
            (val.store, ok.store)(App.box_get(box_key(asset_id))),
            If(ok.load()).Then(App.box_delete(box_key(asset_id))).Else(Reject()),
        ),
    )

@Subroutine(TealType.none)
def assert_buy_group(asset_id: Expr, price: Expr, seller: Expr, buyer: Expr):
    return Seq(
        # Expect fixed 3-txn group: 0=AppCall(this buy), 1=Payment(buyer->seller, price), 2=ASA transfer(seller->buyer, asset)
        Assert(Global.group_size() == Int(3)),
        # Txn 1: payment
        Assert(Gtxn[1].type_enum() == TxnType.Payment),
        Assert(Gtxn[1].sender() == buyer),
        Assert(Gtxn[1].receiver() == seller),
        Assert(Gtxn[1].amount() >= price),
        Assert(Gtxn[1].close_remainder_to() == Global.zero_address()),
        # Txn 2: asset transfer
        Assert(Gtxn[2].type_enum() == TxnType.AssetTransfer),
        Assert(Gtxn[2].xfer_asset() == asset_id),
        Assert(Gtxn[2].asset_sender() == Global.zero_address()),  # not clawback
        Assert(Gtxn[2].sender() == seller),
        Assert(Gtxn[2].asset_receiver() == buyer),
        Assert(Gtxn[2].asset_amount() == Int(1)),
        Assert(Gtxn[2].asset_close_to() == Global.zero_address()),
    )


def approval() -> Expr:
    on_create = Approve()

    # list(asset_id, price)
    do_list = Seq(
        box_put_listing(Btoi(Txn.application_args[1]), Txn.sender(), Btoi(Txn.application_args[2])),
        Approve(),
    )

    # unlist(asset_id)
    do_unlist = Seq(
        (ok := ScratchVar(TealType.uint64)).store(Int(0)),
        (val := ScratchVar(TealType.bytes)).store(Bytes("")),
        (val.store, ok.store)(App.box_get(box_key(Btoi(Txn.application_args[1])))),
        Assert(ok.load()),
        # only seller can unlist
        Assert(Extract(val.load(), Int(0), Int(32)) == Txn.sender()),
        box_del_listing(Btoi(Txn.application_args[1])),
        Approve(),
    )

    # buy(asset_id)
    do_buy = Seq(
        (ok := ScratchVar(TealType.uint64)).store(Int(0)),
        (val := ScratchVar(TealType.bytes)).store(Bytes("")),
        (val.store, ok.store)(App.box_get(box_key(Btoi(Txn.application_args[1])))),
        Assert(ok.load()),
        (seller := ScratchVar(TealType.bytes)).store(Extract(val.load(), Int(0), Int(32))),
        (price := ScratchVar(TealType.uint64)).store(Btoi(Extract(val.load(), Int(32), Int(8)))),
        assert_buy_group(Btoi(Txn.application_args[1]), price.load(), seller.load(), Txn.sender()),
        # consume listing (optional; or keep)
        App.box_delete(box_key(Btoi(Txn.application_args[1]))),
        Approve(),
    )

    router = Cond(
        [Txn.application_id() == Int(0), on_create],
        [Txn.on_completion() == OnComplete.DeleteApplication, Reject()],
        [Txn.on_completion() == OnComplete.CloseOut, Approve()],
        [Txn.on_completion() == OnComplete.OptIn, Approve()],
        [Txn.application_args.length() > Int(0),
            Cond([
                [Txn.application_args[0] == Bytes("list"), do_list],
                [Txn.application_args[0] == Bytes("unlist"), do_unlist],
                [Txn.application_args[0] == Bytes("buy"), do_buy],
            ])
        ],
    )
    return router


def clear() -> Expr:
    return Approve()


if __name__ == "__main__":
    print(compileTeal(approval(), mode=Mode.Application, version=8))
