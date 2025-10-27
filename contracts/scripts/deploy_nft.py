"""
Deploy YokaiNFT Contract to Algorand TestNet
Requires: algokit installed
"""

import os
import json
from algosdk import account, mnemonic
from algosdk.v2client import algod
from algokit_utils import ApplicationClient, get_algod_client

# Configuration
TESTNET_ALGOD_URL = "https://testnet-api.algonode.cloud"
TESTNET_ALGOD_TOKEN = ""

def load_or_create_admin_account():
    """Load admin account from environment or create new one"""
    admin_mnemonic = os.getenv("ADMIN_MNEMONIC")
    
    if admin_mnemonic:
        print("✅ Using existing admin account from ADMIN_MNEMONIC")
        return mnemonic.to_private_key(admin_mnemonic)
    else:
        print("⚠️  No ADMIN_MNEMONIC found. Creating new account...")
        private_key, address = account.generate_account()
        admin_mnemonic = mnemonic.from_private_key(private_key)
        
        print("\n🔑 IMPORTANT - Save these credentials:")
        print(f"Admin Address: {address}")
        print(f"Admin Mnemonic: {admin_mnemonic}")
        print("\n⚠️  Add this to your .env file:")
        print(f"ADMIN_MNEMONIC=\"{admin_mnemonic}\"")
        print("\n💰 Fund this account with TestNet ALGO from:")
        print("   https://bank.testnet.algorand.network/")
        print("   https://testnet.algoexplorer.io/dispenser")
        
        input("\nPress Enter after funding the account...")
        return private_key

def deploy_nft_contract():
    """Deploy the YokaiNFT contract to TestNet"""
    
    # Initialize algod client
    algod_client = algod.AlgodClient(
        algod_token=TESTNET_ALGOD_TOKEN,
        algod_address=TESTNET_ALGOD_URL
    )
    
    # Load admin account
    admin_private_key = load_or_create_admin_account()
    admin_address = account.address_from_private_key(admin_private_key)
    
    # Check balance
    account_info = algod_client.account_info(admin_address)
    balance = account_info.get('amount', 0) / 1_000_000  # Convert microAlgos
    
    print(f"\n💰 Admin Balance: {balance} ALGO")
    
    if balance < 1.0:
        print("❌ Insufficient balance. Need at least 1 ALGO for deployment.")
        print("   Fund your account first!")
        return
    
    print("\n🚀 Deploying YokaiNFT contract...")
    
    # Note: You'll need to compile yokai_nft.py first using:
    # algokit compile py contracts/yokai_nft.py
    
    print("\n⚠️  Contract deployment requires AlgoKit compilation first.")
    print("Run: algokit compile py contracts/yokai_nft.py")
    print("\nThen use algokit to deploy, or integrate ApplicationClient here.")
    
    # TODO: Add actual deployment logic here using ApplicationClient
    # This requires the compiled artifacts from algokit
    
    print("\n📝 Manual deployment steps:")
    print("1. algokit compile py contracts/yokai_nft.py")
    print("2. algokit deploy --network testnet")
    print("3. Save the App ID to .env as NFT_CONTRACT_ID")
    
    return {
        "admin_address": admin_address,
        "network": "testnet",
        "status": "ready_to_deploy"
    }

if __name__ == "__main__":
    result = deploy_nft_contract()
    
    # Save deployment info
    with open("contracts/deployment_info.json", "w") as f:
        json.dump(result, f, indent=2)
    
    print("\n✅ Deployment info saved to contracts/deployment_info.json")
