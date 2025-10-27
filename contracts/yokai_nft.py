"""
YokaiNFT Contract
Handles minting of Yokai (Pokemon) NFTs on Algorand with:
- Metadata storage in Box storage
- Legendary enforcement (1/1 NFTs)
- Ownership tracking
- Trade enable/disable flag
"""

from algopy import (
    ARC4Contract,
    Asset,
    Box,
    BoxMap,
    Bytes,
    Global,
    String,
    Txn,
    UInt64,
    arc4,
    gtxn,
    itxn,
    op,
    subroutine,
)


class YokaiMetadata(arc4.Struct):
    """Metadata structure for Yokai NFTs"""
    name: arc4.String
    rarity: arc4.String  # Common, Uncommon, Rare, Legendary, Mythical
    pokemon_type: arc4.String
    attack: arc4.UInt16
    defense: arc4.UInt16
    speed: arc4.UInt16
    hp: arc4.UInt16
    yield_stat: arc4.UInt16
    level: arc4.UInt8
    evolution_stage: arc4.UInt8
    image_url: arc4.String
    description: arc4.String
    is_legendary: arc4.Bool
    trade_enabled: arc4.Bool
    caught_at: arc4.UInt64
    caught_by: arc4.Address


class YokaiNFTContract(ARC4Contract):
    """
    Main contract for Yokai NFT management
    """
    
    def __init__(self) -> None:
        # Admin address that can mint NFTs (game backend)
        self.admin = Global.creator_address
        
        # Track minted legendaries to enforce 1/1 constraint
        # Key: pokemon_name (bytes), Value: asset_id (UInt64)
        self.legendary_registry = BoxMap(Bytes, UInt64)
        
        # Store metadata for each minted NFT
        # Key: asset_id (UInt64), Value: YokaiMetadata
        self.nft_metadata = BoxMap(UInt64, YokaiMetadata)
    
    @arc4.abimethod
    def mint_yokai(
        self,
        name: arc4.String,
        rarity: arc4.String,
        pokemon_type: arc4.String,
        attack: arc4.UInt16,
        defense: arc4.UInt16,
        speed: arc4.UInt16,
        hp: arc4.UInt16,
        yield_stat: arc4.UInt16,
        level: arc4.UInt8,
        evolution_stage: arc4.UInt8,
        image_url: arc4.String,
        description: arc4.String,
        is_legendary: arc4.Bool,
        recipient: arc4.Address,
    ) -> arc4.UInt64:
        """
        Mint a new Yokai NFT
        
        Only callable by admin (game backend)
        Enforces legendary constraint (max 1 per species)
        """
        
        # Only admin can mint
        assert Txn.sender == self.admin, "Only admin can mint"
        
        # Check legendary constraint
        if is_legendary.native:
            name_bytes = op.extract(name.bytes, 2, op.len(name.bytes) - 2)  # Skip ARC4 length prefix
            assert not self.legendary_registry.maybe(name_bytes).exists, "Legendary already minted"
        
        # Determine total supply based on legendary status
        total = UInt64(1) if is_legendary.native else UInt64(1_000_000)
        
        # Create the NFT asset
        asset_id = self._create_nft_asset(
            name=name.native,
            unit_name=String("YOKAI"),
            total=total,
            decimals=UInt64(0),
            url=image_url.native,
        )
        
        # Store metadata in box storage
        metadata = YokaiMetadata(
            name=name,
            rarity=rarity,
            pokemon_type=pokemon_type,
            attack=attack,
            defense=defense,
            speed=speed,
            hp=hp,
            yield_stat=yield_stat,
            level=level,
            evolution_stage=evolution_stage,
            image_url=image_url,
            description=description,
            is_legendary=is_legendary,
            trade_enabled=arc4.Bool(True),
            caught_at=arc4.UInt64(Global.latest_timestamp),
            caught_by=recipient,
        )
        
        self.nft_metadata[asset_id] = metadata
        
        # Register legendary if applicable
        if is_legendary.native:
            name_bytes = op.extract(name.bytes, 2, op.len(name.bytes) - 2)
            self.legendary_registry[name_bytes] = asset_id
        
        # Transfer NFT to recipient
        itxn.AssetTransfer(
            xfer_asset=asset_id,
            asset_receiver=recipient.native,
            asset_amount=UInt64(1),
        ).submit()
        
        return arc4.UInt64(asset_id)
    
    @subroutine
    def _create_nft_asset(
        self,
        name: String,
        unit_name: String,
        total: UInt64,
        decimals: UInt64,
        url: String,
    ) -> UInt64:
        """Create an Algorand Standard Asset (NFT)"""
        return (
            itxn.AssetConfig(
                total=total,
                decimals=decimals,
                default_frozen=False,
                unit_name=unit_name,
                asset_name=name,
                url=url,
                manager=Global.current_application_address,
                reserve=Global.current_application_address,
                freeze=Global.current_application_address,
                clawback=Global.current_application_address,
            )
            .submit()
            .created_asset.id
        )
    
    @arc4.abimethod(readonly=True)
    def get_metadata(self, asset_id: arc4.UInt64) -> YokaiMetadata:
        """Get metadata for a specific Yokai NFT"""
        return self.nft_metadata[asset_id.native].copy()
    
    @arc4.abimethod(readonly=True)
    def is_legendary_minted(self, name: arc4.String) -> arc4.Bool:
        """Check if a legendary Yokai has already been minted"""
        name_bytes = op.extract(name.bytes, 2, op.len(name.bytes) - 2)
        return arc4.Bool(self.legendary_registry.maybe(name_bytes).exists)
    
    @arc4.abimethod(readonly=True)
    def get_legendary_asset_id(self, name: arc4.String) -> arc4.UInt64:
        """Get the asset ID of a legendary Yokai"""
        name_bytes = op.extract(name.bytes, 2, op.len(name.bytes) - 2)
        maybe_asset = self.legendary_registry.maybe(name_bytes)
        assert maybe_asset.exists, "Legendary not minted"
        return arc4.UInt64(maybe_asset.value)
    
    @arc4.abimethod
    def update_trade_status(
        self,
        asset_id: arc4.UInt64,
        trade_enabled: arc4.Bool,
    ) -> None:
        """
        Update trade enabled status for an NFT
        Only admin can call
        """
        assert Txn.sender == self.admin, "Only admin can update"
        
        metadata = self.nft_metadata[asset_id.native].copy()
        metadata.trade_enabled = trade_enabled
        self.nft_metadata[asset_id.native] = metadata
    
    @arc4.abimethod
    def update_admin(self, new_admin: arc4.Address) -> None:
        """Transfer admin rights (only current admin)"""
        assert Txn.sender == self.admin, "Only admin"
        self.admin = new_admin.native
    
    @arc4.abimethod(readonly=True)
    def get_admin(self) -> arc4.Address:
        """Get current admin address"""
        return arc4.Address(self.admin)
