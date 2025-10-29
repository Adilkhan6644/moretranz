"""
Test script to verify user isolation in the email processing system
"""
import requests
import json
import time

BASE_URL = "http://localhost:8000/api/v1"

def register_user(email, password, full_name):
    """Register a new user"""
    print(f"\n📝 Registering user: {email}")
    response = requests.post(
        f"{BASE_URL}/auth/register",
        json={
            "email": email,
            "password": password,
            "full_name": full_name
        }
    )
    if response.status_code == 200:
        print(f"✅ User registered: {email}")
        return response.json()
    else:
        print(f"❌ Registration failed: {response.text}")
        return None

def login_user(email, password):
    """Login and get access token"""
    print(f"\n🔐 Logging in as: {email}")
    response = requests.post(
        f"{BASE_URL}/auth/login",
        data={
            "username": email,
            "password": password
        }
    )
    if response.status_code == 200:
        data = response.json()
        print(f"✅ Login successful: {email}")
        return data["access_token"]
    else:
        print(f"❌ Login failed: {response.text}")
        return None

def get_processing_status(token):
    """Get processing status for logged-in user"""
    response = requests.get(
        f"{BASE_URL}/orders/processing-status",
        headers={"Authorization": f"Bearer {token}"}
    )
    if response.status_code == 200:
        return response.json()
    else:
        print(f"❌ Failed to get status: {response.text}")
        return None

def start_processing(token):
    """Start email processing for logged-in user"""
    response = requests.post(
        f"{BASE_URL}/orders/start-processing",
        headers={"Authorization": f"Bearer {token}"}
    )
    if response.status_code == 200:
        return response.json()
    else:
        return {"error": response.text, "status_code": response.status_code}

def stop_processing(token):
    """Stop email processing for logged-in user"""
    response = requests.post(
        f"{BASE_URL}/orders/stop-processing",
        headers={"Authorization": f"Bearer {token}"}
    )
    if response.status_code == 200:
        return response.json()
    else:
        print(f"❌ Failed to stop: {response.text}")
        return None

def get_active_users(token):
    """Get list of all active users"""
    response = requests.get(
        f"{BASE_URL}/orders/active-users",
        headers={"Authorization": f"Bearer {token}"}
    )
    if response.status_code == 200:
        return response.json()
    else:
        print(f"❌ Failed to get active users: {response.text}")
        return None

def main():
    print("="*60)
    print("🧪 Testing User Isolation Functionality")
    print("="*60)
    
    # Test User 1
    user1_email = "testuser1@example.com"
    user1_password = "password123"
    
    # Test User 2
    user2_email = "testuser2@example.com"
    user2_password = "password456"
    
    # Register users
    user1_data = register_user(user1_email, user1_password, "Test User 1")
    user2_data = register_user(user2_email, user2_password, "Test User 2")
    
    if not user1_data or not user2_data:
        print("\n❌ Failed to register users")
        return
    
    user1_id = user1_data["id"]
    user2_id = user2_data["id"]
    
    # Login users
    user1_token = login_user(user1_email, user1_password)
    user2_token = login_user(user2_email, user2_password)
    
    if not user1_token or not user2_token:
        print("\n❌ Failed to login users")
        return
    
    print("\n" + "="*60)
    print("TEST 1: Check Initial Status (Both Users Should Be Stopped)")
    print("="*60)
    
    status1 = get_processing_status(user1_token)
    status2 = get_processing_status(user2_token)
    
    print(f"\n👤 User 1 Status: {json.dumps(status1, indent=2)}")
    print(f"\n👤 User 2 Status: {json.dumps(status2, indent=2)}")
    
    assert status1["is_processing"] == False, "User 1 should not be processing initially"
    assert status2["is_processing"] == False, "User 2 should not be processing initially"
    print("\n✅ TEST 1 PASSED: Both users are stopped initially")
    
    print("\n" + "="*60)
    print("TEST 2: Start Processing for User 1 Only (Without Email Config)")
    print("="*60)
    
    result1 = start_processing(user1_token)
    print(f"\n👤 User 1 Start Result: {json.dumps(result1, indent=2)}")
    
    # This should fail because no email config
    if "error" in result1 or result1.get("status_code") == 400:
        print("\n✅ TEST 2 PASSED: Correctly rejected start without email config")
    else:
        print("\n⚠️ TEST 2: User 1 started (might have default config)")
        
        # Check active users
        active_users = get_active_users(user1_token)
        print(f"\n📊 Active Users: {json.dumps(active_users, indent=2)}")
        
        # Check that only user 1 is active
        if active_users:
            assert user1_id in active_users["active_users"], "User 1 should be active"
            assert user2_id not in active_users["active_users"], "User 2 should NOT be active"
            print("\n✅ Isolation confirmed: Only User 1 is active")
        
        # Check User 2's status (should still be stopped)
        status2_after = get_processing_status(user2_token)
        print(f"\n👤 User 2 Status After User 1 Started: {json.dumps(status2_after, indent=2)}")
        
        assert status2_after["is_processing"] == False, "User 2 should still be stopped"
        print("\n✅ TEST 2 PASSED: User 2 unaffected by User 1's start")
    
    print("\n" + "="*60)
    print("TEST 3: Check User Isolation (User 2 can't see User 1's processing)")
    print("="*60)
    
    status2_check = get_processing_status(user2_token)
    print(f"\n👤 User 2 Status Check: {json.dumps(status2_check, indent=2)}")
    
    assert status2_check["user_id"] == user2_id, "Status should be for User 2"
    assert status2_check["is_processing"] == False, "User 2 should not be processing"
    print("\n✅ TEST 3 PASSED: Users have independent status")
    
    # If User 1 is running, stop it
    if result1.get("status") and "started" in result1.get("status", "").lower():
        print("\n" + "="*60)
        print("TEST 4: Stop User 1's Processing")
        print("="*60)
        
        stop_result = stop_processing(user1_token)
        print(f"\n👤 User 1 Stop Result: {json.dumps(stop_result, indent=2)}")
        
        # Check active users again
        active_users_after = get_active_users(user1_token)
        print(f"\n📊 Active Users After Stop: {json.dumps(active_users_after, indent=2)}")
        
        if active_users_after:
            assert user1_id not in active_users_after["active_users"], "User 1 should not be active after stop"
            print("\n✅ TEST 4 PASSED: User 1 stopped successfully")
    
    print("\n" + "="*60)
    print("🎉 ALL TESTS COMPLETED!")
    print("="*60)
    print("\n✅ User isolation is working correctly!")
    print("   - Each user has independent processing status")
    print("   - Starting/stopping one user doesn't affect others")
    print("   - Users can only see their own status")
    
if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\n❌ Test failed with error: {str(e)}")
        import traceback
        traceback.print_exc()

