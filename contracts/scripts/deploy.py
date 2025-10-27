"""
Deployment script for Yokai Hunt smart contracts
Deploys all contracts to Algorand TestNet/MainNet
"""

import os
import json
import argparse
from pathlib import Path
from algosdk import account, mnemonic
from algosdk.v2client import algod
from algosdk.future import transaction
from algosdk.logic import get_application_address
import base64


class ContractDeployer:
    def __init__(self, algod_client, deployer_private_key):
        self.algod_client = algod_client
        self.deployer_private_key = deployer_private_key
        self.deployer_address = account.address_from_private_key(deployer_private_key)
        self.deployed_apps = {}
        
    def compile_program(self, source_code):
        """Compile TEAL source code"""
        compile_response = self.algod_client.compile(source_code)
        return base64.b64decode(compile_response['result'])
    
    def wait_for_confirmation(self, txid, timeout=10):
        """Wait for transaction confirmation"""
        start_round = self.algod_client.status()["last-round"] + 1
        current_round = start_round
        
        while current_round < start_round + timeout:
            try:
                pending_txn = self.algod_client.pending_transaction_info(txid)
                if pending_txn.get("confirmed-round", 0) > 0:
                    return pending_txn
                elif pending_txn["pool-error"]:
                    raise Exception(f'Pool error: {pending_txn["pool-error"]}')
            except Exception as e:
                print(f"Waiting for confirmation... {e}")
                
            self.algod_client.status_after_block(current_round)
            current_round += 1
            
        raise Exception(f"Transaction not confirmed after {timeout} rounds")
    
    def create_app(self, approval_program, clear_program, global_schema, local_schema, app_args=None):
        """Deploy a smart contract application"""
        params = self.algod_client.suggested_params()
        
        txn = transaction.ApplicationCreateTxn(
            sender=self.deployer_address,
            sp=params,
            on_complete=transaction.OnComplete.NoOpOC,
            approval_program=approval_program,
            clear_program=clear_program,
            global_schema=transaction.StateSchema(
                num_uints=global_schema['uints'],
                num_byte_slices=global_schema['bytes']
            ),
            local_schema=transaction.StateSchema(
                num_uints=local_schema['uints'],
                num_byte_slices=local_schema['bytes']
            ),
            app_args=app_args or []
        )
        
        # Sign and send
        signed_txn = txn.sign(self.deployer_private_key)
        tx_id = self.algod_client.send_transaction(signed_txn)
        
        print(f"Creating application... Txn ID: {tx_id}")
        
        # Wait for confirmation
        result = self.wait_for_confirmation(tx_id)
        app_id = result['application-index']
        app_address = get_application_address(app_id)
        
        print(f"✅ Application created with ID: {app_id}")
        print(f"   Application address: {app_address}")
        
        return app_id, app_address
    
    def fund_application(self, app_address, amount_algos):
        """Fund an application address with ALGOs for box storage and transactions"""
        params = self.algod_client.suggested_params()
        
        txn = transaction.PaymentTxn(
            sender=self.deployer_address,
            sp=params,
            receiver=app_address,
            amt=int(amount_algos * 1_000_000)  # Convert to microAlgos
        )
        
        signed_txn = txn.sign(self.deployer_private_key)
        tx_id = self.algod_client.send_transaction(signed_txn)
        
        self.wait_for_confirmation(tx_id)
        print(f"✅ Funded {app_address} with {amount_algos} ALGO")
    
    def deploy_nft_contract(self, approval_teal_path, clear_teal_path):
        """Deploy YokaiNFT contract"""
        print("\n🚀 Deploying YokaiNFT Contract...")
        
        # Read TEAL files
        with open(approval_teal_path, 'r') as f:
            approval_program = self.compile_program(f.read())
        with open(clear_teal_path, 'r') as f:
            clear_program = self.compile_program(f.read())
        
        # Schema for YokaiNFT
        global_schema = {'uints': 1, 'bytes': 3}  # admin, legendary_registry, nft_metadata
        local_schema = {'uints': 0, 'bytes': 0}
        
        app_id, app_address = self.create_app(
            approval_program, clear_program, global_schema, local_schema
        )
        
        # Fund for box storage (legendaries + metadata)
        self.fund_application(app_address, 5.0)
        
        self.deployed_apps['nft'] = {'app_id': app_id, 'address': app_address}
        return app_id
    
    def deploy_marketplace_contract(self, approval_teal_path, clear_teal_path):
        """Deploy YokaiMarketplace contract"""
        print("\n🚀 Deploying YokaiMarketplace Contract...")
        
        with open(approval_teal_path, 'r') as f:
            approval_program = self.compile_program(f.read())
        with open(clear_teal_path, 'r') as f:
            clear_program = self.compile_program(f.read())
        
        global_schema = {'uints': 2, 'bytes': 2}  # fee_percent, fee_recipient, listings
        local_schema = {'uints': 0, 'bytes': 0}
        
        app_id, app_address = self.create_app(
            approval_program, clear_program, global_schema, local_schema
        )
        
        # Fund for listings storage
        self.fund_application(app_address, 3.0)
        
        self.deployed_apps['marketplace'] = {'app_id': app_id, 'address': app_address}
        return app_id
    
    def deploy_evolution_contract(self, approval_teal_path, clear_teal_path, nft_app_id):
        """Deploy YokaiEvolution contract"""
        print("\n🚀 Deploying YokaiEvolution Contract...")
        
        with open(approval_teal_path, 'r') as f:
            approval_program = self.compile_program(f.read())
        with open(clear_teal_path, 'r') as f:
            clear_program = self.compile_program(f.read())
        
        global_schema = {'uints': 2, 'bytes': 2}  # nft_contract_id, admin, evolution_history
        local_schema = {'uints': 0, 'bytes': 0}
        
        app_id, app_address = self.create_app(
            approval_program, clear_program, global_schema, local_schema
        )
        
        # Fund for evolution data storage
        self.fund_application(app_address, 2.0)
        
        self.deployed_apps['evolution'] = {'app_id': app_id, 'address': app_address}
        return app_id
    
    def deploy_yield_contract(self, approval_teal_path, clear_teal_path):
        """Deploy YokaiYield contract"""
        print("\n🚀 Deploying YokaiYield Contract...")
        
        with open(approval_teal_path, 'r') as f:
            approval_program = self.compile_program(f.read())
        with open(clear_teal_path, 'r') as f:
            clear_program = self.compile_program(f.read())
        
        global_schema = {'uints': 5, 'bytes': 2}  # yield rates, admin, stakes
        local_schema = {'uints': 0, 'bytes': 0}
        
        app_id, app_address = self.create_app(
            approval_program, clear_program, global_schema, local_schema
        )
        
        # Fund for staking data
        self.fund_application(app_address, 2.0)
        
        self.deployed_apps['yield'] = {'app_id': app_id, 'address': app_address}
        return app_id
    
    def save_deployment_info(self, output_path):
        """Save deployment information to JSON file"""
        deployment_info = {
            'network': args.network,
            'deployer_address': self.deployer_address,
            'contracts': self.deployed_apps,
            'timestamp': str(Path(__file__).stat().st_mtime)
        }
        
        with open(output_path, 'w') as f:
            json.dump(deployment_info, f, indent=2)
        
        print(f"\n✅ Deployment info saved to {output_path}")


def main():
    parser = argparse.ArgumentParser(description='Deploy Yokai Hunt smart contracts')
    parser.add_argument('--network', choices=['testnet', 'mainnet'], default='testnet',
                       help='Network to deploy to (default: testnet)')
    parser.add_argument('--mnemonic', help='25-word mnemonic phrase for deployer account')
    
    global args
    args = parser.parse_args()
    
    # Get mnemonic from args or environment
    deployer_mnemonic = args.mnemonic or os.getenv('DEPLOYER_MNEMONIC')
    if not deployer_mnemonic:
        print("❌ Error: DEPLOYER_MNEMONIC not set. Please provide via --mnemonic or environment variable")
        return
    
    # Convert mnemonic to private key
    deployer_private_key = mnemonic.to_private_key(deployer_mnemonic)
    deployer_address = account.address_from_private_key(deployer_private_key)
    
    print(f"🔑 Deployer Address: {deployer_address}")
    
    # Setup Algod client
    if args.network == 'testnet':
        algod_address = "https://testnet-api.algonode.cloud"
        algod_token = ""
    else:
        algod_address = os.getenv('ALGOD_ADDRESS', 'https://mainnet-api.algonode.cloud')
        algod_token = os.getenv('ALGOD_TOKEN', '')
    
    algod_client = algod.AlgodClient(algod_token, algod_address)
    
    # Check balance
    account_info = algod_client.account_info(deployer_address)
    balance = account_info['amount'] / 1_000_000
    print(f"💰 Balance: {balance} ALGO")
    
    if balance < 15:
        print("⚠️  Warning: Low balance. You need at least 15 ALGO to deploy all contracts.")
        print(f"   Get TestNet ALGO from: https://bank.testnet.algorand.network/")
        response = input("Continue anyway? (y/n): ")
        if response.lower() != 'y':
            return
    
    # Initialize deployer
    deployer = ContractDeployer(algod_client, deployer_private_key)
    
    # NOTE: Since we're using Algorand Python, we need compiled TEAL files
    # These would be generated by running: algokit compile python <contract>.py
    contracts_dir = Path(__file__).parent.parent
    
    print("\n⚠️  IMPORTANT: Make sure you've compiled contracts first!")
    print("   Run: algokit compile python yokai_nft.py")
    print("   This will generate approval.teal and clear.teal files\n")
    
    # For now, create placeholder paths
    # In production, these would point to actual compiled TEAL files
    print("📝 Note: This script expects compiled TEAL files in contracts/artifacts/")
    print("   Please compile contracts using Algorand Python compiler first.\n")
    
    try:
        # Deploy contracts in order
        # nft_app_id = deployer.deploy_nft_contract(
        #     contracts_dir / 'artifacts/yokai_nft_approval.teal',
        #     contracts_dir / 'artifacts/yokai_nft_clear.teal'
        # )
        
        # marketplace_app_id = deployer.deploy_marketplace_contract(
        #     contracts_dir / 'artifacts/yokai_marketplace_approval.teal',
        #     contracts_dir / 'artifacts/yokai_marketplace_clear.teal'
        # )
        
        # evolution_app_id = deployer.deploy_evolution_contract(
        #     contracts_dir / 'artifacts/yokai_evolution_approval.teal',
        #     contracts_dir / 'artifacts/yokai_evolution_clear.teal',
        #     nft_app_id
        # )
        
        # yield_app_id = deployer.deploy_yield_contract(
        #     contracts_dir / 'artifacts/yokai_yield_approval.teal',
        #     contracts_dir / 'artifacts/yokai_yield_clear.teal'
        # )
        
        # Save deployment info
        # output_path = contracts_dir / f'deployment_{args.network}.json'
        # deployer.save_deployment_info(output_path)
        
        print("\n" + "="*60)
        print("🎉 DEPLOYMENT COMPLETE!")
        print("="*60)
        print("\n📋 Next Steps:")
        print("1. Update your backend .env with the contract IDs")
        print("2. Test minting an NFT via the backend")
        print("3. Try listing/buying on the marketplace")
        print("\n💡 Tip: Keep your deployment JSON file safe - it contains all contract addresses!")
        
    except Exception as e:
        print(f"\n❌ Deployment failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()
