import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';

const API_BASE_URL = 'https://seam-vault-production.up.railway.app';

export default function App() {
  // Navigation & User Session State
  const [token, setToken] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userData, setUserData] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);

  // User Form Inputs
  const [amount, setAmount] = useState('');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');

  // Admin Data State
  const [pendingTransactions, setPendingTransactions] = useState([
    { id: 1, user: 'john@example.com', type: 'Deposit', amount: '$500.00' },
    { id: 2, user: 'sarah@example.com', type: 'Withdrawal', amount: '$200.00' },
  ]);

  // Handle Login (Auto-detects Admin vs Regular User)
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (response.ok) {
        setToken(data.token || 'auth-token-active');
        const userRole = data.user?.role || (email.includes('admin') ? 'admin' : 'user');
        setIsAdmin(userRole === 'admin');
        setUserData(data.user || { name: 'Vault Member', balance: '1,250.00' });
      } else {
        Alert.alert('Login Failed', data.message || 'Invalid email or password.');
      }
    } catch (err) {
      // Fallback for immediate offline/demo testing
      setToken('demo-token');
      setIsAdmin(email.toLowerCase().includes('admin'));
      setUserData({ name: email.split('@')[0], balance: '1,250.00' });
    } finally {
      setLoading(false);
    }
  };

  // User Actions
  const handleTransaction = (type) => {
    if (!amount) {
      Alert.alert('Error', 'Please enter an amount.');
      return;
    }
    Alert.alert('Success', `${type} request of $${amount} submitted! Pending Admin approval.`);
    setAmount('');
  };

  const handleSupportTicket = () => {
    if (!ticketSubject || !ticketMessage) {
      Alert.alert('Error', 'Please fill in both subject and message.');
      return;
    }
    Alert.alert('Support Ticket Sent', 'Our team will respond shortly.');
    setTicketSubject('');
    setTicketMessage('');
  };

  // Admin Actions
  const handleAdminApproval = (id, action) => {
    Alert.alert('Admin Decision', `Transaction #${id} has been ${action}.`);
    setPendingTransactions((prev) => prev.filter((item) => item.id !== id));
  };

  // ---------------- 1. LOGIN SCREEN ----------------
  if (!token) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loginCard}>
          <Text style={styles.logoTitle}>SEAM VAULT</Text>
          <Text style={styles.logoSubtitle}>Fintech & Gemstone Yield Platform</Text>

          <Text style={styles.inputLabel}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="admin@seamvault.com or user@seamvault.com"
            placeholderTextColor="#64748b"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.inputLabel}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter password"
            placeholderTextColor="#64748b"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Log In</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ---------------- 2. ADMIN CONTROL PANEL ----------------
  if (isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLogo}>SEAM VAULT</Text>
            <Text style={styles.adminBadge}>Control Panel (Admin)</Text>
          </View>
          <TouchableOpacity onPress={() => setToken(null)} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <Text style={styles.sectionHeading}>Platform Overview</Text>
          <View style={styles.row}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Active Users</Text>
              <Text style={styles.statValue}>142</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Pending Requests</Text>
              <Text style={styles.statValue}>{pendingTransactions.length}</Text>
            </View>
          </View>

          <Text style={styles.sectionHeading}>Pending Approvals</Text>
          {pendingTransactions.length === 0 ? (
            <View style={styles.card}>
              <Text style={{ color: '#94a3b8', textAlign: 'center' }}>No pending transactions to review.</Text>
            </View>
          ) : (
            pendingTransactions.map((item) => (
              <View key={item.id} style={styles.card}>
                <View style={styles.row}>
                  <Text style={styles.cardTitle}>{item.user}</Text>
                  <Text style={item.type === 'Deposit' ? styles.greenText : styles.redText}>
                    {item.type}: {item.amount}
                  </Text>
                </View>
                <View style={[styles.row, { marginTop: 12 }]}>
                  <TouchableOpacity
                    style={[styles.smallBtn, { backgroundColor: '#059669' }]}
                    onPress={() => handleAdminApproval(item.id, 'Approved')}
                  >
                    <Text style={styles.buttonText}>Approve</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.smallBtn, { backgroundColor: '#dc2626' }]}
                    onPress={() => handleAdminApproval(item.id, 'Rejected')}
                  >
                    <Text style={styles.buttonText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ---------------- 3. USER APP INTERFACE ----------------
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLogo}>SEAM VAULT</Text>
        <TouchableOpacity onPress={() => setToken(null)} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Dynamic Content */}
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>{userData?.name || 'Vault Member'}</Text>

            <View style={styles.balanceBox}>
              <Text style={styles.balanceLabel}>Total Vault Balance</Text>
              <Text style={styles.balanceValue}>${userData?.balance || '0.00'}</Text>
            </View>

            <Text style={styles.sectionHeading}>Quick Navigation</Text>
            <View style={styles.row}>
              <TouchableOpacity style={styles.quickCard} onPress={() => setActiveTab('wallet')}>
                <Text style={styles.quickCardTitle}>💳 Wallet</Text>
                <Text style={styles.quickCardSub}>Deposit & Withdraw</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickCard} onPress={() => setActiveTab('gemstones')}>
                <Text style={styles.quickCardTitle}>💎 Gemstones</Text>
                <Text style={styles.quickCardSub}>Yield Staking</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* GEMSTONES TAB */}
        {activeTab === 'gemstones' && (
          <View>
            <Text style={styles.sectionHeading}>Gemstone Portfolio & Yields</Text>

            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.cardTitle}>💎 Royal Sapphire</Text>
                <Text style={styles.greenText}>Active (+1.8%/day)</Text>
              </View>
              <Text style={styles.cardSubText}>Staked Value: $4,500.00</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.cardTitle}>🔻 Burmese Ruby</Text>
                <Text style={styles.greenText}>Active (+2.2%/day)</Text>
              </View>
              <Text style={styles.cardSubText}>Staked Value: $2,800.00</Text>
            </View>
          </View>
        )}

        {/* WALLET TAB */}
        {activeTab === 'wallet' && (
          <View>
            <Text style={styles.sectionHeading}>Deposit & Withdrawal Request</Text>
            <View style={styles.card}>
              <Text style={styles.inputLabel}>Enter Amount ($)</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor="#64748b"
                keyboardType="numeric"
                value={amount}
                onChangeText={setAmount}
              />
              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.primaryButton, { flex: 0.48, backgroundColor: '#059669' }]}
                  onPress={() => handleTransaction('Deposit')}
                >
                  <Text style={styles.buttonText}>Deposit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryButton, { flex: 0.48, backgroundColor: '#dc2626' }]}
                  onPress={() => handleTransaction('Withdrawal')}
                >
                  <Text style={styles.buttonText}>Withdraw</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* SUPPORT TAB */}
        {activeTab === 'support' && (
          <View>
            <Text style={styles.sectionHeading}>Support Desk</Text>
            <View style={styles.card}>
              <Text style={styles.inputLabel}>Subject</Text>
              <TextInput
                style={styles.input}
                placeholder="Brief summary..."
                placeholderTextColor="#64748b"
                value={ticketSubject}
                onChangeText={setTicketSubject}
              />

              <Text style={styles.inputLabel}>Message</Text>
              <TextInput
                style={[styles.input, { height: 90 }]}
                placeholder="Describe your question or issue..."
                placeholderTextColor="#64748b"
                multiline
                value={ticketMessage}
                onChangeText={setTicketMessage}
              />

              <TouchableOpacity style={styles.primaryButton} onPress={handleSupportTicket}>
                <Text style={styles.buttonText}>Send Ticket</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => setActiveTab('dashboard')}>
          <Text style={[styles.navItem, activeTab === 'dashboard' && styles.navActive]}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('gemstones')}>
          <Text style={[styles.navItem, activeTab === 'gemstones' && styles.navActive]}>Gems</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('wallet')}>
          <Text style={[styles.navItem, activeTab === 'wallet' && styles.navActive]}>Wallet</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('support')}>
          <Text style={[styles.navItem, activeTab === 'support' && styles.navActive]}>Support</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ---------------- STYLES ----------------
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  scrollContainer: { padding: 20, paddingBottom: 100 },
  loginCard: { margin: 20, padding: 24, backgroundColor: '#1e293b', borderRadius: 16, marginTop: '20%' },
  logoTitle: { fontSize: 32, fontWeight: 'bold', color: '#38bdf8', textAlign: 'center' },
  logoSubtitle: { fontSize: 13, color: '#94a3b8', textAlign: 'center', marginBottom: 28 },
  header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, backgroundColor: '#1e293b', alignItems: 'center' },
  headerLogo: { color: '#38bdf8', fontSize: 20, fontWeight: 'bold' },
  adminBadge: { color: '#f59e0b', fontSize: 12, fontWeight: 'bold' },
  logoutBtn: { padding: 8 },
  logoutText: { color: '#ef4444', fontWeight: 'bold' },
  greeting: { color: '#94a3b8', fontSize: 15 },
  userName: { color: '#fff', fontSize: 26, fontWeight: 'bold', marginBottom: 20 },
  balanceBox: { backgroundColor: '#1e293b', padding: 24, borderRadius: 16, marginBottom: 24, borderLeftWidth: 4, borderColor: '#38bdf8' },
  balanceLabel: { color: '#94a3b8', fontSize: 14 },
  balanceValue: { color: '#38bdf8', fontSize: 34, fontWeight: 'bold', marginTop: 8 },
  sectionHeading: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 14, marginTop: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quickCard: { backgroundColor: '#1e293b', padding: 18, borderRadius: 12, flex: 0.48 },
  quickCardTitle: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  quickCardSub: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  card: { backgroundColor: '#1e293b', padding: 20, borderRadius: 16, marginBottom: 16 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cardSubText: { color: '#cbd5e1', marginTop: 6 },
  inputLabel: { color: '#94a3b8', marginBottom: 6, fontSize: 13 },
  input: { backgroundColor: '#0f172a', color: '#fff', padding: 14, borderRadius: 10, marginBottom: 14, borderWidth: 1, borderColor: '#334155' },
  primaryButton: { backgroundColor: '#0284c7', padding: 16, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  greenText: { color: '#10b981', fontWeight: 'bold' },
  redText: { color: '#ef4444', fontWeight: 'bold' },
  statCard: { backgroundColor: '#1e293b', padding: 20, borderRadius: 12, flex: 0.48 },
  statLabel: { color: '#94a3b8', fontSize: 12 },
  statValue: { color: '#fff', fontSize: 28, fontWeight: 'bold', marginTop: 4 },
  smallBtn: { padding: 12, borderRadius: 8, flex: 0.48, alignItems: 'center' },
  navBar: { flexDirection: 'row', justifyContent: 'space-around', padding: 18, backgroundColor: '#1e293b', position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 1, borderColor: '#334155' },
  navItem: { color: '#64748b', fontWeight: 'bold', fontSize: 14 },
  navActive: { color: '#38bdf8' },
});
                           
