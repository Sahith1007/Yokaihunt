from pyteal import *

# YokaiHunt Trainer XP App (ARC-like simple app)
# Global state:
#  - xp_points: uint64
# Allows no-op method "xp_update" with an admin-signed txn, passing new xp as arg[1].

def approval_program():
    xp_key = Bytes("xp_points")
    admin_key = Bytes("admin")

    on_create = Seq(
        App.globalPut(xp_key, Int(0)),
        App.globalPut(admin_key, Txn.sender()),
        Approve(),
    )

    is_admin = Or(
        # creator/admin
        Txn.sender() == App.globalGet(admin_key),
    )

    @Subroutine(TealType.none)
    def xp_update():
        return Seq(
            Assert(Global.group_size() == Int(1)),
            Assert(is_admin),
            Assert(Txn.application_args.length() >= Int(2)),
            App.globalPut(xp_key, Btoi(Txn.application_args[1])),
            Approve(),
        )

    handle_noop = Cond(
        [Txn.application_args[0] == Bytes("xp_update"), xp_update()],
    )

    program = Cond(
        [Txn.application_id() == Int(0), on_create],
        [Txn.on_completion() == OnComplete.NoOp, handle_noop],
    )

    return program


def clear_state_program():
    return Approve()


if __name__ == "__main__":
    from pyteal import compileTeal, Mode
    print(compileTeal(approval_program(), mode=Mode.Application, version=8))
    print(compileTeal(clear_state_program(), mode=Mode.Application, version=8))