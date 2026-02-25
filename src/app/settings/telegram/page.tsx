"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageWrapper from "@/components/PageWrapper";
import { useTheme } from "@/contexts/ThemeContext";
import { getButtonStyle } from "@/lib/buttonStyles";
import { supabase } from "@/lib/supabaseClient";

interface WebhookStatus {
  bot?: {
    id: number;
    is_bot: boolean;
    first_name: string;
    username: string;
  };
  webhook?: {
    url?: string;
    has_custom_certificate?: boolean;
    pending_update_count?: number;
    last_error_date?: number;
    last_error_message?: string;
    last_synchronization_error_date?: number;
  };
  error?: string;
}

interface LinkedAccount {
  telegram_user_id: number;
  telegram_username: string;
  telegram_first_name: string;
  connected_at: string;
}

export default function TelegramSettings() {
  const router = useRouter();
  const { currentTheme } = useTheme();
  
  const [status, setStatus] = useState<WebhookStatus | null>(null);
  const [linkedAccount, setLinkedAccount] = useState<LinkedAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupLoading, setSetupLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showLinkingCode, setShowLinkingCode] = useState(false);
  const [linkingCode, setLinkingCode] = useState<string>('');

  const webhookUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/telegram/webhook`
    : '';

  // Fetch webhook status and linked account
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch webhook status
        const statusResponse = await fetch('/api/telegram/setup');
        const statusData = await statusResponse.json();
        
        if (!statusResponse.ok) {
          setError(statusData.error || 'Failed to fetch webhook status');
        } else {
          setStatus(statusData);
          setError(null);
        }

        // Fetch linked account
        if (!supabase) {
          return;
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
          return;
        }

        const linkResponse = await fetch('/api/telegram/link', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        const linkData = await linkResponse.json();
        if (linkResponse.ok && linkData.linked && linkData.account) {
          setLinkedAccount(linkData.account);
        } else {
          setLinkedAccount(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Setup webhook
  const handleSetupWebhook = async () => {
    try {
      setSetupLoading(true);
      setError(null);
      
      const response = await fetch('/api/telegram/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl })
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to setup webhook');
      } else {
        setSuccess('Webhook setup successfully!');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup webhook');
    } finally {
      setSetupLoading(false);
    }
  };

  // Delete webhook
  const handleDeleteWebhook = async () => {
    if (!confirm('Are you sure you want to delete the webhook?')) return;

    try {
      setSetupLoading(true);
      setError(null);

      const response = await fetch('/api/telegram/setup', {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to delete webhook');
      } else {
        setSuccess('Webhook deleted successfully!');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete webhook');
    } finally {
      setSetupLoading(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate linking code
  const generateLinkingCode = async () => {
    console.log('generateLinkingCode called');
    
    if (!supabase) {
      const errorMsg = 'Tidak dapat terhubung ke server. Silakan muat ulang halaman.';
      console.error('Supabase client not initialized');
      setError(errorMsg);
      return;
    }

    try {
      setSetupLoading(true);
      setError(null);
      
      console.log('Getting session...');
      
      // Get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('Session:', { session, sessionError });
      
      if (sessionError || !session) {
        const errorMsg = sessionError?.message || 'Anda belum login';
        console.error('Session error:', errorMsg);
        throw new Error('Silakan login terlebih dahulu untuk membuat kode linking');
      }
      
      console.log('Calling API to generate linking code...');
      
      // Call the API to generate a new linking code
      const response = await fetch('/api/telegram/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ userId: session.user.id })
      });
      
      const responseData = await response.json();
      console.log('API response:', { status: response.status, data: responseData });
      
      if (!response.ok) {
        const errorMsg = responseData?.error || `Gagal membuat kode linking (${response.status})`;
        console.error('API error:', errorMsg);
        throw new Error(errorMsg);
      }
      
      if (!responseData.code) {
        throw new Error('Tidak ada kode yang diterima dari server');
      }
      
      console.log('Setting linking code:', responseData.code);
      setLinkingCode(responseData.code);
      setShowLinkingCode(true);
      setSuccess('Kode linking berhasil dibuat! Kode ini berlaku selama 10 menit.');
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Gagal membuat kode linking';
      console.error('Error in generateLinkingCode:', errorMsg, err);
      setError(errorMsg);
    } finally {
      setSetupLoading(false);
    }
  };

  // Unlink account
  const handleUnlinkAccount = async () => {
    if (!confirm('Apakah Anda yakin ingin memutuskan akun Telegram?')) return;
    
    if (!supabase) {
      const errorMsg = 'Tidak dapat terhubung ke server. Silakan muat ulang halaman.';
      setError(errorMsg);
      return;
    }

    try {
      setSetupLoading(true);
      setError(null);
      
      // Get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Silakan login terlebih dahulu');
      }

      // Call the API to unlink account
      const response = await fetch('/api/telegram/link', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      const responseData = await response.json();
      
      if (!response.ok) {
        const errorMsg = responseData?.error || 'Gagal memutuskan akun';
        throw new Error(errorMsg);
      }

      setSuccess('Akun Telegram berhasil diputuskan');
      setLinkedAccount(null);
      setShowLinkingCode(false);
      setLinkingCode('');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to unlink account';
      setError(errorMsg);
    } finally {
      setSetupLoading(false);
    }
  };

  return (
    <PageWrapper>
      <main className="pb-28 px-4 pt-4 dark:bg-gray-900 min-h-screen">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 mb-4 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
        >
          <span>← Kembali</span>
        </button>

        <div className="max-w-2xl">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              🤖 Telegram Bot
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Setup dan kelola Telegram Bot untuk input transaksi
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="font-semibold text-red-900 dark:text-red-200">Error</p>
              <p className="text-red-800 dark:text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="font-semibold text-green-900 dark:text-green-200">Success</p>
              <p className="text-green-800 dark:text-green-300 text-sm">{success}</p>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {/* Bot Info */}
              {status?.bot && (
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 mb-6 shadow-soft">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                    Bot Information
                  </h2>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Bot Name</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {status.bot?.first_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Username</p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">
                          @{status.bot?.username}
                        </p>
                        <button
                          onClick={() => copyToClipboard(`@${status.bot?.username}`)}
                          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                        >
                          {copied ? '✓' : '📋'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Webhook Status */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 mb-6 shadow-soft">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  Webhook Status
                </h2>

                {status?.webhook?.url ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <p className="text-sm font-semibold text-green-900 dark:text-green-200 mb-2">
                        ✅ Webhook Active
                      </p>
                      <p className="text-sm text-green-800 dark:text-green-300 break-all">
                        {status.webhook.url}
                      </p>
                    </div>

                    {status.webhook.pending_update_count !== undefined && (
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Pending updates: {status.webhook.pending_update_count}
                      </div>
                    )}

                    {status.webhook.last_error_message && (
                      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-200">
                          Last Error
                        </p>
                        <p className="text-sm text-yellow-800 dark:text-yellow-300">
                          {status.webhook.last_error_message}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={handleDeleteWebhook}
                      disabled={setupLoading}
                      className={`w-full px-4 py-2 rounded-lg font-semibold transition ${getButtonStyle(currentTheme.id, 'danger')}`}
                    >
                      {setupLoading ? 'Deleting...' : 'Delete Webhook'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-gray-600 dark:text-gray-400">
                      Webhook is not configured. Click the button below to setup.
                    </p>
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
                        Webhook URL
                      </p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-blue-800 dark:text-blue-300 break-all flex-1">
                          {webhookUrl}
                        </p>
                        <button
                          onClick={() => copyToClipboard(webhookUrl)}
                          className="p-2 hover:bg-blue-100 dark:hover:bg-blue-900 rounded-lg transition flex-shrink-0"
                        >
                          {copied ? '✓' : '📋'}
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={handleSetupWebhook}
                      disabled={setupLoading}
                      className={`w-full px-4 py-2 rounded-lg font-semibold transition ${getButtonStyle(currentTheme.id, 'primary')}`}
                    >
                      {setupLoading ? 'Setting up...' : 'Setup Webhook'}
                    </button>
                  </div>
                )}
              </div>

              {/* Link Telegram Account */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 mb-6 shadow-soft">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  🔗 Link Telegram Account
                </h2>

                {linkedAccount ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
                        ✅ Akun Terhubung
                      </p>
                      <div className="space-y-2">
                        <p className="text-sm text-blue-800 dark:text-blue-300">
                          <strong>Nama:</strong> {linkedAccount.telegram_first_name}
                        </p>
                        <p className="text-sm text-blue-800 dark:text-blue-300">
                          <strong>Username:</strong> {linkedAccount.telegram_username ? `@${linkedAccount.telegram_username}` : 'Tidak ada'}
                        </p>
                        <p className="text-sm text-blue-800 dark:text-blue-300">
                          <strong>Terhubung:</strong> {new Date(linkedAccount.connected_at).toLocaleDateString('id-ID')}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleUnlinkAccount}
                      disabled={setupLoading}
                      className={`w-full px-4 py-2 rounded-lg font-semibold transition ${getButtonStyle(currentTheme.id, 'danger')}`}
                    >
                      {setupLoading ? 'Memutuskan...' : 'Putuskan Akun'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-gray-600 dark:text-gray-400">
                      Hubungkan akun Telegram Anda untuk mulai mengirim command transaksi via Telegram.
                    </p>
                    
                    {showLinkingCode ? (
                      <div className="space-y-3">
                        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                          <p className="text-sm font-semibold text-purple-900 dark:text-purple-200 mb-2">
                            Kode Linking Anda
                          </p>
                          <div className="flex items-center gap-2">
                            <code className="flex-1 p-3 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg text-lg font-mono font-bold">
                              {linkingCode}
                            </code>
                            <button
                              onClick={() => copyToClipboard(linkingCode)}
                              className="p-2 hover:bg-purple-100 dark:hover:bg-purple-900 rounded-lg transition"
                            >
                              {copied ? '✓' : '📋'}
                            </button>
                          </div>
                        </div>
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                          <p className="text-sm text-yellow-900 dark:text-yellow-200">
                            <strong>Langkah:</strong>
                          </p>
                          <ol className="text-sm text-yellow-800 dark:text-yellow-300 mt-2 space-y-1 list-decimal list-inside">
                            <li>Buka Telegram dan cari bot Anda</li>
                            <li>Kirim pesan: <code className="bg-yellow-100 dark:bg-yellow-900 px-2 py-1 rounded">/link {linkingCode}</code></li>
                            <li>Tunggu konfirmasi dari bot</li>
                          </ol>
                        </div>
                        <button
                          onClick={() => setShowLinkingCode(false)}
                          className={`w-full px-4 py-2 rounded-lg font-semibold transition ${getButtonStyle(currentTheme.id, 'secondary')}`}
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={generateLinkingCode}
                        className={`w-full px-4 py-2 rounded-lg font-semibold transition ${getButtonStyle(currentTheme.id, 'primary')}`}
                      >
                        Generate Kode Linking
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Command Format */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-soft">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  📱 Command Format
                </h2>
                <div className="space-y-4">
                  {/* BUY Commands */}
                  <div>
                    <p className="text-sm font-semibold text-green-600 dark:text-green-400 mb-2">
                      🟢 BUY dengan IDR
                    </p>
                    <code className="block p-3 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg text-sm overflow-x-auto">
                      buy rp200000 16750 bybit
                    </code>
                    <code className="block p-3 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg text-sm overflow-x-auto mt-2">
                      b rp200000 750 bybit
                    </code>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Singkat: 750 otomatis jadi 16750
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-green-600 dark:text-green-400 mb-2">
                      🟢 BUY dengan USDT
                    </p>
                    <code className="block p-3 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg text-sm overflow-x-auto">
                      buy $50 16750 binance
                    </code>
                    <code className="block p-3 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg text-sm overflow-x-auto mt-2">
                      b $50 750 binance
                    </code>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Bisa juga: buy 50$ atau b 50$
                    </p>
                  </div>

                  {/* SELL Commands */}
                  <div>
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
                      🔴 SELL dengan IDR
                    </p>
                    <code className="block p-3 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg text-sm overflow-x-auto">
                      sell rp200000 16750 bybit
                    </code>
                    <code className="block p-3 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg text-sm overflow-x-auto mt-2">
                      s rp200000 750 bybit
                    </code>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">
                      🔴 SELL dengan USDT
                    </p>
                    <code className="block p-3 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg text-sm overflow-x-auto">
                      sell $50 16750 okx
                    </code>
                    <code className="block p-3 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg text-sm overflow-x-auto mt-2">
                      s $50 750 okx
                    </code>
                  </div>

                  {/* HISTORY Commands */}
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-2">
                      📊 HISTORY Commands
                    </p>
                    <code className="block p-3 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg text-sm overflow-x-auto">
                      history buy bybit
                    </code>
                    <code className="block p-3 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg text-sm overflow-x-auto mt-2">
                      h b 15 bybit
                    </code>
                    <code className="block p-3 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg text-sm overflow-x-auto mt-2">
                      h n 5 bybit
                    </code>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      h b = history buy | h s = history sell | h n = history new
                    </p>
                  </div>

                  {/* HELP Command */}
                  <div>
                    <p className="text-sm font-semibold text-purple-600 dark:text-purple-400 mb-2">
                      🆘 HELP Command
                    </p>
                    <code className="block p-3 bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-lg text-sm overflow-x-auto">
                      help
                    </code>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Tampilkan semua command yang tersedia
                    </p>
                  </div>

                  {/* Exchange Info */}
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                      💱 Exchange yang Tersedia
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      binance, bybit, okx, bitget, tokocrypto, other
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </PageWrapper>
  );
}
