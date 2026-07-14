"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { 
  ArrowLeft, Bot, Link2, Unlink, Copy, Check, 
  Loader2, CheckCircle2, XCircle, AlertTriangle, 
  MessageCircle, Key, Globe, ExternalLink
} from "lucide-react";

interface WebhookStatus {
  bot?: { id: number; is_bot: boolean; first_name: string; username: string };
  webhook?: { url?: string; pending_update_count?: number; last_error_message?: string };
  error?: string;
}

interface LinkedAccount {
  telegram_user_id: number;
  telegram_username: string;
  telegram_first_name: string;
  connected_at: string;
}

export default function V2TelegramSettings() {
  const router = useRouter();
  const [status, setStatus] = useState<WebhookStatus | null>(null);
  const [linkedAccount, setLinkedAccount] = useState<LinkedAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupLoading, setSetupLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showLinkingCode, setShowLinkingCode] = useState(false);
  const [linkingCode, setLinkingCode] = useState('');
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState(false);
  const [showDeleteWebhookConfirm, setShowDeleteWebhookConfirm] = useState(false);

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/telegram/webhook` : '';

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const statusResponse = await fetch('/api/telegram/setup');
        const statusData = await statusResponse.json();
        if (!statusResponse.ok) setError(statusData.error || 'Failed to fetch webhook status');
        else { setStatus(statusData); setError(null); }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const linkResponse = await fetch('/api/telegram/link', {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        const linkData = await linkResponse.json();
        if (linkResponse.ok && linkData.linked && linkData.account) setLinkedAccount(linkData.account);
        else setLinkedAccount(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSetupWebhook = async () => {
    try {
      setSetupLoading(true); setError(null);
      const response = await fetch('/api/telegram/setup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl })
      });
      const data = await response.json();
      if (!response.ok) setError(data.error || 'Failed to setup webhook');
      else { setSuccess('Webhook berhasil di-setup!'); setTimeout(() => window.location.reload(), 2000); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup webhook');
    } finally { setSetupLoading(false); }
  };

  const handleDeleteWebhook = async () => {
    try {
      setSetupLoading(true); setError(null);
      const response = await fetch('/api/telegram/setup', { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) setError(data.error || 'Failed to delete webhook');
      else { setSuccess('Webhook berhasil dihapus!'); setTimeout(() => window.location.reload(), 2000); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete webhook');
    } finally { setSetupLoading(false); setShowDeleteWebhookConfirm(false); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const generateLinkingCode = async () => {
    try {
      setSetupLoading(true); setError(null);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) throw new Error('Silakan login terlebih dahulu');

      const response = await fetch('/api/telegram/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId: session.user.id })
      });
      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.error || 'Gagal membuat kode linking');
      if (!responseData.code) throw new Error('Tidak ada kode yang diterima dari server');

      setLinkingCode(responseData.code);
      setShowLinkingCode(true);
      setSuccess('Kode linking berhasil dibuat! Berlaku 10 menit.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat kode linking');
    } finally { setSetupLoading(false); }
  };

  const handleUnlinkAccount = async () => {
    try {
      setSetupLoading(true); setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Silakan login terlebih dahulu');

      const response = await fetch('/api/telegram/link', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const responseData = await response.json();
      if (!response.ok) throw new Error(responseData.error || 'Gagal memutuskan akun');

      setSuccess('Akun Telegram berhasil diputuskan');
      setLinkedAccount(null); setShowLinkingCode(false); setLinkingCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink account');
    } finally { setSetupLoading(false); setShowUnlinkConfirm(false); }
  };

  return (
    <div className="px-4 pt-6 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">Telegram Bot</h1>
          <p className="text-xs text-gray-500 mt-0.5">Setup & kelola Telegram Bot</p>
        </div>
      </div>

      {/* Error / Success */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2">
          <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-400">{success}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Bot Info */}
          {status?.bot && (
            <div className="bg-[#111827] rounded-xl p-4 border border-white/[0.06]">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/15 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{status.bot.first_name}</p>
                  <p className="text-xs text-gray-500">@{status.bot.username}</p>
                </div>
                <button onClick={() => copyToClipboard(`@${status.bot?.username}`)} className="ml-auto p-2 hover:bg-white/5 rounded-lg">
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-gray-500" />}
                </button>
              </div>
            </div>
          )}

          {/* Webhook Status */}
          <div className="bg-[#111827] rounded-xl p-4 border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white">Webhook Status</h3>
            </div>

            {status?.webhook?.url ? (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-medium text-emerald-400">Webhook Aktif</span>
                  </div>
                  <p className="text-[10px] text-gray-400 break-all">{status.webhook.url}</p>
                </div>
                {status.webhook.pending_update_count !== undefined && (
                  <p className="text-[10px] text-gray-500">Pending updates: {status.webhook.pending_update_count}</p>
                )}
                {status.webhook.last_error_message && (
                  <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <p className="text-[10px] text-amber-400">{status.webhook.last_error_message}</p>
                  </div>
                )}
                <button
                  onClick={() => setShowDeleteWebhookConfirm(true)}
                  disabled={setupLoading}
                  className="w-full py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm font-medium text-red-400 active:bg-red-500/20"
                >
                  {setupLoading ? 'Menghapus...' : 'Hapus Webhook'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">Webhook belum dikonfigurasi.</p>
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-[10px] text-blue-400 font-medium mb-1">Webhook URL</p>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] text-gray-400 break-all flex-1">{webhookUrl}</p>
                    <button onClick={() => copyToClipboard(webhookUrl)} className="p-1.5 hover:bg-white/5 rounded-lg flex-shrink-0">
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleSetupWebhook}
                  disabled={setupLoading}
                  className="w-full py-3 bg-sky-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-sky-500/30 active:scale-[0.98] disabled:opacity-50"
                >
                  {setupLoading ? 'Menyiapkan...' : 'Setup Webhook'}
                </button>
              </div>
            )}
          </div>

          {/* Link Account */}
          <div className="bg-[#111827] rounded-xl p-4 border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-3">
              <Link2 className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-white">Link Telegram Account</h3>
            </div>

            {linkedAccount ? (
              <div className="space-y-3">
                <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-xs font-medium text-purple-400">Akun Terhubung</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-400">Nama: <span className="text-white">{linkedAccount.telegram_first_name}</span></p>
                    <p className="text-xs text-gray-400">Username: <span className="text-white">{linkedAccount.telegram_username ? `@${linkedAccount.telegram_username}` : 'Tidak ada'}</span></p>
                    <p className="text-xs text-gray-400">Terhubung: <span className="text-white">{new Date(linkedAccount.connected_at).toLocaleDateString('id-ID')}</span></p>
                  </div>
                </div>
                <button
                  onClick={() => setShowUnlinkConfirm(true)}
                  disabled={setupLoading}
                  className="w-full py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm font-medium text-red-400 active:bg-red-500/20"
                >
                  {setupLoading ? 'Memutuskan...' : 'Putuskan Akun'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">Hubungkan akun Telegram untuk mengirim command via bot.</p>
                
                {showLinkingCode ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                      <p className="text-[10px] text-purple-400 font-medium mb-2">Kode Linking Anda</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 p-3 bg-[#0a0e1a] text-white rounded-lg text-lg font-mono font-bold text-center">{linkingCode}</code>
                        <button onClick={() => copyToClipboard(linkingCode)} className="p-2 hover:bg-white/5 rounded-lg">
                          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-gray-500" />}
                        </button>
                      </div>
                    </div>
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <p className="text-[10px] text-amber-400 font-medium mb-1">Langkah:</p>
                      <ol className="text-[10px] text-gray-400 space-y-1 list-decimal list-inside">
                        <li>Buka Telegram dan cari bot</li>
                        <li>Kirim: <code className="bg-[#0a0e1a] px-1.5 py-0.5 rounded text-emerald-400">/link {linkingCode}</code></li>
                        <li>Tunggu konfirmasi</li>
                      </ol>
                    </div>
                    <button onClick={() => setShowLinkingCode(false)} className="w-full py-3 bg-white/5 text-gray-400 rounded-xl text-sm font-medium">
                      Batal
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={generateLinkingCode}
                    disabled={setupLoading}
                    className="w-full py-3 bg-purple-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-purple-500/30 active:scale-[0.98] disabled:opacity-50"
                  >
                    {setupLoading ? 'Membuat...' : 'Generate Kode Linking'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Command Reference */}
          <div className="bg-[#111827] rounded-xl p-4 border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Command Format</h3>
            </div>

            <div className="space-y-4">
              {/* BUY */}
              <div>
                <p className="text-xs font-medium text-emerald-400 mb-2">🟢 BUY dengan IDR</p>
                <div className="p-2.5 bg-[#0a0e1a] rounded-lg font-mono text-xs text-gray-300">buy rp200000 16750 bybit</div>
                <div className="p-2.5 bg-[#0a0e1a] rounded-lg font-mono text-xs text-gray-300 mt-1">b rp200000 750 bybit</div>
                <p className="text-[10px] text-gray-600 mt-1">Singkat: 750 → 16750</p>
              </div>
              <div>
                <p className="text-xs font-medium text-emerald-400 mb-2">🟢 BUY dengan USDT</p>
                <div className="p-2.5 bg-[#0a0e1a] rounded-lg font-mono text-xs text-gray-300">buy $50 16750 binance</div>
              </div>

              {/* SELL */}
              <div className="pt-3 border-t border-white/[0.06]">
                <p className="text-xs font-medium text-red-400 mb-2">🔴 SELL dengan IDR</p>
                <div className="p-2.5 bg-[#0a0e1a] rounded-lg font-mono text-xs text-gray-300">sell rp200000 16750 bybit</div>
              </div>
              <div>
                <p className="text-xs font-medium text-red-400 mb-2">🔴 SELL dengan USDT</p>
                <div className="p-2.5 bg-[#0a0e1a] rounded-lg font-mono text-xs text-gray-300">sell $50 16750 okx</div>
              </div>

              {/* HISTORY */}
              <div className="pt-3 border-t border-white/[0.06]">
                <p className="text-xs font-medium text-blue-400 mb-2">📊 HISTORY</p>
                <div className="p-2.5 bg-[#0a0e1a] rounded-lg font-mono text-xs text-gray-300">history buy bybit</div>
                <div className="p-2.5 bg-[#0a0e1a] rounded-lg font-mono text-xs text-gray-300 mt-1">h b 15 bybit</div>
                <p className="text-[10px] text-gray-600 mt-1">h b = buy | h s = sell | h n = new</p>
              </div>

              {/* HELP */}
              <div className="pt-3 border-t border-white/[0.06]">
                <p className="text-xs font-medium text-purple-400 mb-2">🆘 HELP</p>
                <div className="p-2.5 bg-[#0a0e1a] rounded-lg font-mono text-xs text-gray-300">help</div>
              </div>

              {/* Exchanges */}
              <div className="pt-3 border-t border-white/[0.06]">
                <p className="text-xs font-medium text-gray-300 mb-1">💱 Exchange</p>
                <p className="text-[10px] text-gray-500">binance, bybit, okx, bitget, tokocrypto, other</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Webhook Confirm */}
      {showDeleteWebhookConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-[#111827] rounded-2xl p-5 w-full max-w-sm border border-white/[0.06]">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-red-500/15 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Hapus Webhook?</h3>
              <p className="text-xs text-gray-500">Bot tidak akan bisa menerima pesan sampai webhook di-setup ulang.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteWebhookConfirm(false)} className="flex-1 py-3 bg-white/5 text-gray-400 rounded-xl text-sm font-medium">Batal</button>
              <button onClick={handleDeleteWebhook} disabled={setupLoading} className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                {setupLoading ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unlink Confirm */}
      {showUnlinkConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="bg-[#111827] rounded-2xl p-5 w-full max-w-sm border border-white/[0.06]">
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-red-500/15 rounded-full flex items-center justify-center mx-auto mb-3">
                <Unlink className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Putuskan Akun Telegram?</h3>
              <p className="text-xs text-gray-500">Anda perlu generate kode baru untuk menghubungkan kembali.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowUnlinkConfirm(false)} className="flex-1 py-3 bg-white/5 text-gray-400 rounded-xl text-sm font-medium">Batal</button>
              <button onClick={handleUnlinkAccount} disabled={setupLoading} className="flex-1 py-3 bg-red-500 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                {setupLoading ? 'Memutuskan...' : 'Putuskan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
