from pyteal import *

# Minting app: allows an admin (creator) to mint ASA via inner transactions
# Stores last minted ASA id in global state

APP_ADMIN = Bytes("admin")
LAST_ASA = Bytes("last_asa")

@Subroutine(TealType.none)
def create_asa(name: Expr, unit_name: Expr, url: Expr, metadata_hash: Expr, total: Expr, decimals: Expr):
    return Seq(
        InnerTxnBuilder.Begin(),
        InnerTxnBuilder.SetFields({
            TxnField.type_enum: TxnType.AssetConfig,
            TxnField.config_asset_name: name,
            TxnField.config_asset_unit_name: unit_name,
            TxnField.config_asset_url: url,
            TxnField.config_asset_metadata_hash: metadata_hash,
            TxnField.config_asset_total: total,
            TxnField.config_asset_decimals: decimals,
            # Set sender (app account) as clawback/manager/etc? On Algorand, these are addresses, so use the admin address.
            TxnField.config_asset_manager: App.globalGet(APP_ADMIN),
            TxnField.config_asset_reserve: App.globalGet(APP_ADMIN),
            TxnField.config_asset_freeze: Global.zero_address(),
            TxnField.config_asset_clawback: Global.zero_address(),
        }),
        InnerTxnBuilder.Submit(),
        App.globalPut(LAST_ASA, InnerTxn.created_asset_id()),
    )


def approval() -> Expr:
    on_create = Seq(
        App.globalPut(APP_ADMIN, Txn.sender()),
        Approve(),
    )

    is_admin = Txn.sender() == App.globalGet(APP_ADMIN)

    # Method: mint(name, unit, url, metadata_hash, total, decimals)
    mint_method = Seq(
        Assert(is_admin),
        Assert(Global.group_size() == Int(1)),
        # enforce sane parameters
        Assert(Btoi(Txn.application_args[4]) > Int(0)),
        Assert(Btoi(Txn.application_args[5]) <= Int(19)),
        create_asa(
            Txn.application_args[1],
            Txn.application_args[2],
            Txn.application_args[3],
            Txn.application_args[6] if Txn.application_args.length() > Int(6) else Bytes(""),
            Btoi(Txn.application_args[4]),
            Btoi(Txn.application_args[5]),
        ),
        Approve(),
    )

    router = Cond(
        [Txn.application_id() == Int(0), on_create],
        [Txn.on_completion() == OnComplete.DeleteApplication, Return(is_admin)],
        [Txn.on_completion() == OnComplete.UpdateApplication, Return(is_admin)],
        [Txn.on_completion() == OnComplete.CloseOut, Approve()],
        [Txn.on_completion() == OnComplete.OptIn, Approve()],
        [Txn.application_args.length() > Int(0),
            Cond([
                Txn.application_args[0] == Bytes("mint"), mint_method
            ])
        ],
    )
    return router


def clear() -> Expr:
    return Approve()


if __name__ == "__main__":
    print(compileTeal(approval(), mode=Mode.Application, version=8))
