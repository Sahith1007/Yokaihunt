"""
YokaiYield Contract (Future Ready)
Allows evolved Yokai NFTs to be staked and generate $YOKA token yield
Features:
- Stake NFTs with yieldStat > 0
- Periodic yield accrual based on rarity and level
- Withdraw yield to player wallet
"""

from algopy import (
    ARC4Contract,
    Asset,
    BoxMap,
    Global,
    Txn,
    UInt64,
    arc4,
    gtxn,
    itxn,
    subroutine,
)


class StakeInfo(arc4.Struct):
    """Information about a staked Yokai"""
    asset_id: arc4.UInt64
    staker: arc4.Address
    staked_at: arc4.UInt64
    last_claim: arc4.UInt64
    yield_rate: arc4.UInt16  # Tokens per day
    is_active: arc4.Bool


class YokaiYieldContract(ARC4Contract):
    """
    Yield generation contract for staked Yokai NFTs
    """
    
    def __init__(self) -> None:
        # $YOKA token asset ID (set during deployment)
        self.yoka_token_id = UInt64(0)
        
        # Admin address
        self.admin = Global.creator_address
        
        # Staking info: asset_id -> StakeInfo
        self.stakes = BoxMap(UInt64, StakeInfo)
        
        # Total staked count
        self.total_staked = UInt64(0)
        
        # Yield rates by evolution stage (tokens per day)
        self.stage_0_yield = UInt64(0)      # Base form: no yield
        self.stage_1_yield = UInt64(100)    # 1st evolution: 100 YOKA/day
        self.stage_2_yield = UInt64(250)    # 2nd evolution: 250 YOKA/day
        self.legendary_yield = UInt64(1000) # Legendaries: 1000 YOKA/day
    
    @arc4.abimethod
    def set_yoka_token(self, asset_id: arc4.UInt64) -> None:
        """Set the $YOKA token asset ID (only admin)"""
        assert Txn.sender == self.admin, "Only admin"
        self.yoka_token_id = asset_id.native
    
    @arc4.abimethod
    def stake_yokai(
        self,
        asset_id: arc4.UInt64,
        yield_stat: arc4.UInt16,
        is_legendary: arc4.Bool,
        asset_transfer: gtxn.AssetTransferTransaction,
    ) -> None:
        """
        Stake a Yokai NFT to generate yield
        
        Player must transfer NFT to contract in same transaction group
        """
        # Verify asset transfer
        assert asset_transfer.xfer_asset == asset_id.native, "Asset mismatch"
        assert asset_transfer.asset_receiver == Global.current_application_address, "Must transfer to contract"
        assert asset_transfer.asset_amount == UInt64(1), "Must transfer exactly 1 NFT"
        assert asset_transfer.sender == Txn.sender, "Sender mismatch"
        
        # Verify NFT can generate yield
        assert yield_stat.native > UInt64(0), "NFT cannot generate yield"
        
        # Determine yield rate
        yield_rate = yield_stat.native
        if is_legendary.native:
            yield_rate = self.legendary_yield
        
        # Create stake info
        stake_info = StakeInfo(
            asset_id=asset_id,
            staker=arc4.Address(Txn.sender),
            staked_at=arc4.UInt64(Global.latest_timestamp),
            last_claim=arc4.UInt64(Global.latest_timestamp),
            yield_rate=arc4.UInt16(yield_rate),
            is_active=arc4.Bool(True),
        )
        
        self.stakes[asset_id.native] = stake_info
        self.total_staked += UInt64(1)
    
    @arc4.abimethod
    def claim_yield(self, asset_id: arc4.UInt64) -> arc4.UInt64:
        """
        Claim accumulated yield for a staked Yokai
        
        Returns amount of $YOKA claimed
        """
        # Get stake info
        maybe_stake = self.stakes.maybe(asset_id.native)
        assert maybe_stake.exists, "NFT not staked"
        
        stake = maybe_stake.value
        assert stake.is_active.native, "Stake not active"
        assert stake.staker.native == Txn.sender, "Not your stake"
        
        # Calculate yield
        time_staked = Global.latest_timestamp - stake.last_claim.native
        days_staked = time_staked // UInt64(86400)  # Seconds in a day
        
        yield_amount = stake.yield_rate.native * days_staked
        
        assert yield_amount > UInt64(0), "No yield to claim"
        
        # Transfer yield tokens
        itxn.AssetTransfer(
            xfer_asset=self.yoka_token_id,
            asset_receiver=Txn.sender,
            asset_amount=yield_amount * UInt64(1_000_000),  # Convert to micro-units
        ).submit()
        
        # Update last claim time
        stake_copy = stake.copy()
        stake_copy.last_claim = arc4.UInt64(Global.latest_timestamp)
        self.stakes[asset_id.native] = stake_copy
        
        return arc4.UInt64(yield_amount)
    
    @arc4.abimethod
    def unstake_yokai(self, asset_id: arc4.UInt64) -> None:
        """
        Unstake a Yokai NFT and return it to owner
        
        Automatically claims any pending yield
        """
        # Get stake info
        maybe_stake = self.stakes.maybe(asset_id.native)
        assert maybe_stake.exists, "NFT not staked"
        
        stake = maybe_stake.value
        assert stake.is_active.native, "Stake not active"
        assert stake.staker.native == Txn.sender, "Not your stake"
        
        # Claim any pending yield first
        time_staked = Global.latest_timestamp - stake.last_claim.native
        days_staked = time_staked // UInt64(86400)
        yield_amount = stake.yield_rate.native * days_staked
        
        if yield_amount > UInt64(0):
            itxn.AssetTransfer(
                xfer_asset=self.yoka_token_id,
                asset_receiver=Txn.sender,
                asset_amount=yield_amount * UInt64(1_000_000),
            ).submit()
        
        # Return NFT to owner
        itxn.AssetTransfer(
            xfer_asset=asset_id.native,
            asset_receiver=Txn.sender,
            asset_amount=UInt64(1),
        ).submit()
        
        # Mark stake as inactive
        stake_copy = stake.copy()
        stake_copy.is_active = arc4.Bool(False)
        self.stakes[asset_id.native] = stake_copy
        
        self.total_staked -= UInt64(1)
    
    @arc4.abimethod(readonly=True)
    def get_stake_info(self, asset_id: arc4.UInt64) -> StakeInfo:
        """Get staking information for an NFT"""
        maybe_stake = self.stakes.maybe(asset_id.native)
        assert maybe_stake.exists, "NFT not staked"
        return maybe_stake.value
    
    @arc4.abimethod(readonly=True)
    def get_pending_yield(self, asset_id: arc4.UInt64) -> arc4.UInt64:
        """Calculate pending yield for a staked NFT"""
        maybe_stake = self.stakes.maybe(asset_id.native)
        assert maybe_stake.exists, "NFT not staked"
        
        stake = maybe_stake.value
        if not stake.is_active.native:
            return arc4.UInt64(0)
        
        time_staked = Global.latest_timestamp - stake.last_claim.native
        days_staked = time_staked // UInt64(86400)
        yield_amount = stake.yield_rate.native * days_staked
        
        return arc4.UInt64(yield_amount)
    
    @arc4.abimethod(readonly=True)
    def is_staked(self, asset_id: arc4.UInt64) -> arc4.Bool:
        """Check if an NFT is currently staked"""
        maybe_stake = self.stakes.maybe(asset_id.native)
        if not maybe_stake.exists:
            return arc4.Bool(False)
        return maybe_stake.value.is_active
    
    @arc4.abimethod(readonly=True)
    def get_total_staked(self) -> arc4.UInt64:
        """Get total number of staked NFTs"""
        return arc4.UInt64(self.total_staked)
    
    @arc4.abimethod
    def update_yield_rates(
        self,
        stage_1: arc4.UInt64,
        stage_2: arc4.UInt64,
        legendary: arc4.UInt64,
    ) -> None:
        """Update yield rates (only admin)"""
        assert Txn.sender == self.admin, "Only admin"
        self.stage_1_yield = stage_1.native
        self.stage_2_yield = stage_2.native
        self.legendary_yield = legendary.native
