"""
YokaiMarketplace Contract
Decentralized marketplace for buying and selling Yokai NFTs
Features:
- List NFTs for sale with price in microAlgos
- Buy listed NFTs with automatic transfer
- Delist NFTs
- Box storage for listing data
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


class Listing(arc4.Struct):
    """Structure for marketplace listings"""
    asset_id: arc4.UInt64
    seller: arc4.Address
    price: arc4.UInt64  # Price in microAlgos
    listed_at: arc4.UInt64
    is_active: arc4.Bool


class YokaiMarketplaceContract(ARC4Contract):
    """
    Marketplace contract for trading Yokai NFTs
    """
    
    def __init__(self) -> None:
        # Platform fee percentage (e.g., 2 = 2%)
        self.platform_fee_percent = UInt64(2)
        
        # Platform fee recipient
        self.fee_recipient = Global.creator_address
        
        # Store listings: asset_id -> Listing
        self.listings = BoxMap(UInt64, Listing)
        
        # Track total listings
        self.total_listings = UInt64(0)
    
    @arc4.abimethod
    def list_nft(
        self,
        asset_id: arc4.UInt64,
        price: arc4.UInt64,
        asset_transfer: gtxn.AssetTransferTransaction,
    ) -> None:
        """
        List a Yokai NFT for sale
        
        Seller must opt-in to the asset and transfer it to the contract
        via an asset transfer transaction in the same group
        """
        # Verify the asset transfer
        assert asset_transfer.xfer_asset == asset_id.native, "Asset mismatch"
        assert asset_transfer.asset_receiver == Global.current_application_address, "Must transfer to contract"
        assert asset_transfer.asset_amount == UInt64(1), "Must transfer exactly 1 NFT"
        assert asset_transfer.sender == Txn.sender, "Sender mismatch"
        
        # Verify price is reasonable
        assert price.native > UInt64(0), "Price must be positive"
        
        # Create listing
        listing = Listing(
            asset_id=asset_id,
            seller=arc4.Address(Txn.sender),
            price=price,
            listed_at=arc4.UInt64(Global.latest_timestamp),
            is_active=arc4.Bool(True),
        )
        
        self.listings[asset_id.native] = listing
        self.total_listings += UInt64(1)
    
    @arc4.abimethod
    def buy_nft(
        self,
        asset_id: arc4.UInt64,
        payment: gtxn.PaymentTransaction,
    ) -> None:
        """
        Buy a listed Yokai NFT
        
        Buyer must send payment transaction in the same group
        """
        # Get listing
        maybe_listing = self.listings.maybe(asset_id.native)
        assert maybe_listing.exists, "NFT not listed"
        
        listing = maybe_listing.value
        assert listing.is_active.native, "Listing not active"
        
        # Verify payment
        assert payment.sender == Txn.sender, "Payment sender mismatch"
        assert payment.receiver == Global.current_application_address, "Payment to contract"
        assert payment.amount >= listing.price.native, "Insufficient payment"
        
        # Calculate fees
        total_price = listing.price.native
        platform_fee = (total_price * self.platform_fee_percent) // UInt64(100)
        seller_amount = total_price - platform_fee
        
        # Transfer payment to seller
        itxn.Payment(
            receiver=listing.seller.native,
            amount=seller_amount,
        ).submit()
        
        # Transfer platform fee
        if platform_fee > UInt64(0):
            itxn.Payment(
                receiver=self.fee_recipient,
                amount=platform_fee,
            ).submit()
        
        # Transfer NFT to buyer
        itxn.AssetTransfer(
            xfer_asset=asset_id.native,
            asset_receiver=Txn.sender,
            asset_amount=UInt64(1),
        ).submit()
        
        # Mark listing as inactive
        listing_copy = listing.copy()
        listing_copy.is_active = arc4.Bool(False)
        self.listings[asset_id.native] = listing_copy
    
    @arc4.abimethod
    def delist_nft(self, asset_id: arc4.UInt64) -> None:
        """
        Remove NFT from marketplace and return to seller
        
        Only the seller can delist
        """
        # Get listing
        maybe_listing = self.listings.maybe(asset_id.native)
        assert maybe_listing.exists, "NFT not listed"
        
        listing = maybe_listing.value
        assert listing.is_active.native, "Listing not active"
        assert listing.seller.native == Txn.sender, "Only seller can delist"
        
        # Return NFT to seller
        itxn.AssetTransfer(
            xfer_asset=asset_id.native,
            asset_receiver=Txn.sender,
            asset_amount=UInt64(1),
        ).submit()
        
        # Mark listing as inactive
        listing_copy = listing.copy()
        listing_copy.is_active = arc4.Bool(False)
        self.listings[asset_id.native] = listing_copy
    
    @arc4.abimethod(readonly=True)
    def get_listing(self, asset_id: arc4.UInt64) -> Listing:
        """Get listing details for a specific NFT"""
        maybe_listing = self.listings.maybe(asset_id.native)
        assert maybe_listing.exists, "NFT not listed"
        return maybe_listing.value
    
    @arc4.abimethod(readonly=True)
    def is_listed(self, asset_id: arc4.UInt64) -> arc4.Bool:
        """Check if an NFT is actively listed"""
        maybe_listing = self.listings.maybe(asset_id.native)
        if not maybe_listing.exists:
            return arc4.Bool(False)
        return maybe_listing.value.is_active
    
    @arc4.abimethod
    def update_platform_fee(self, new_fee_percent: arc4.UInt8) -> None:
        """
        Update platform fee percentage
        Only contract creator can call
        """
        assert Txn.sender == Global.creator_address, "Only creator"
        assert new_fee_percent.native <= UInt64(10), "Fee too high (max 10%)"
        self.platform_fee_percent = new_fee_percent.native
    
    @arc4.abimethod
    def update_fee_recipient(self, new_recipient: arc4.Address) -> None:
        """
        Update platform fee recipient
        Only current fee recipient can call
        """
        assert Txn.sender == self.fee_recipient, "Only current recipient"
        self.fee_recipient = new_recipient.native
    
    @arc4.abimethod(readonly=True)
    def get_platform_fee(self) -> arc4.UInt8:
        """Get current platform fee percentage"""
        return arc4.UInt8(self.platform_fee_percent)
    
    @arc4.abimethod(readonly=True)
    def get_total_listings(self) -> arc4.UInt64:
        """Get total number of listings ever created"""
        return arc4.UInt64(self.total_listings)
