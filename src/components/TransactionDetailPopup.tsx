"use client";
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatIDR } from '@/lib/utils';
import { Transaction } from '@/lib/types';
import EditTransactionModal from './EditTransactionModal';
import { supabase } from '@/lib/supabaseClient';
import { ExchangeLabel } from '@/lib/types';

interface TransactionDetailPopupProps {
  show: boolean;
  transaction: Transaction | null;
  onClose: () => void;
  onDelete?: (id: string) => void;
  onDeleteRequest?: (transaction: Transaction) => void | Promise<void>;
  onEdit?: (id: string, price: number, amount: number, fee: number, feeType: 'percent' | 'value', txTime: Date, label?: ExchangeLabel) => void;
}

export default function TransactionDetailPopup({ 
  show, 
  transaction,
  onClose,
  onDelete,
  onDeleteRequest,
  onEdit
}: TransactionDetailPopupProps) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!transaction) return null;

  const handleDelete = async () => {
    if (!transaction.id) return;
    
    setIsDeleting(true);
    try {
      if (onDeleteRequest) {
        await onDeleteRequest(transaction);
        setShowDeleteConfirm(false);
        onClose();
        return;
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      // If it's a BUY transaction, we need to handle orphaned SELL transactions
      if (transaction.type === 'BUY' && transaction.session_id) {
        // First, check how many BUY transactions are in this session
        const { data: buyTxs, error: buyError } = await supabase
          .from('transactions')
          .select('id')
          .eq('session_id', transaction.session_id)
          .eq('type', 'BUY');
        
        if (buyError) throw buyError;
        
        const isLastBuyTx = buyTxs && buyTxs.length === 1;
        
        if (isLastBuyTx) {
          // This is the last BUY transaction - delete session and handle SELL transactions
          // Find all session_sales that used this session
          const { data: affectedSales, error: salesError } = await supabase
            .from('session_sales')
            .select('*, transactions!session_sales_tx_id_fkey(id, amount_usdt, price_idr, tx_time, fee_idr, label)')
            .eq('session_id', transaction.session_id);
          
          if (salesError) throw salesError;
          
          if (affectedSales && affectedSales.length > 0) {
            // Get all affected SELL transaction IDs
            const affectedSellTxIds = affectedSales.map((sale: any) => sale.tx_id).filter(Boolean);
            
            // Delete all session_sales for these SELL transactions
            const { error: deleteSalesError } = await supabase
              .from('session_sales')
              .delete()
              .in('tx_id', affectedSellTxIds);
            
            if (deleteSalesError) throw deleteSalesError;
            
            // Delete the session (CASCADE will delete remaining transactions)
            const { error: deleteSessionError } = await supabase
              .from('sessions')
              .delete()
              .eq('id', transaction.session_id);
            
            if (deleteSessionError) throw deleteSessionError;
            
            // Delete the BUY transaction
            const { error: deleteTxError } = await supabase
              .from('transactions')
              .delete()
              .eq('id', transaction.id);
            
            if (deleteTxError) throw deleteTxError;
          
          // Now re-process each affected SELL transaction with FIFO
          for (const sale of affectedSales as any[]) {
            const sellTx = (sale as any).transactions;
            if (!sellTx) continue;
            
            // Get all available sessions for current user (sorted by date for FIFO)
            const { data: availableSessions, error: sessionsError } = await supabase
              .from('sessions')
              .select('*')
              .eq('user_id', user.id)
              .gt('remaining_usdt', 0)
              .order('created_at', { ascending: true });
            
            if (sessionsError) throw sessionsError;
            
            if (!availableSessions || availableSessions.length === 0) {
              console.warn(`No available sessions to re-allocate SELL transaction ${sellTx.id}`);
              continue;
            }
            
            // Re-process this SELL with FIFO
            let remainingToSell = sellTx.amount_usdt;
            const sellPrice = sellTx.price_idr;
            const totalProceeds = remainingToSell * sellPrice;
            const feeAmount = sellTx.fee_idr || 0;
            
            for (const session of availableSessions) {
              if (remainingToSell <= 0) break;
              if (session.remaining_usdt <= 0) continue;
              
              const soldFromSession = Math.min(remainingToSell, session.remaining_usdt);
              const proceedsFromSession = soldFromSession * sellPrice;
              const costFromSession = soldFromSession * session.avg_cost;
              const profitFromSession = proceedsFromSession - costFromSession;
              
              // Create new session_sale
              const { error: insertSaleError } = await supabase
                .from('session_sales')
                .insert({
                  session_id: session.id,
                  tx_id: sellTx.id,
                  sold_usdt: soldFromSession,
                  proceeds_idr: proceedsFromSession,
                  cost_idr: costFromSession,
                  profit_idr: profitFromSession
                });
              
              if (insertSaleError) throw insertSaleError;
              
              // Update session
              const newRemainingUsdt = session.remaining_usdt - soldFromSession;
              const newRealizedProfit = session.realized_profit_idr + profitFromSession;
              
              await supabase
                .from('sessions')
                .update({
                  remaining_usdt: newRemainingUsdt,
                  realized_profit_idr: newRealizedProfit,
                  status: newRemainingUsdt <= 0.01 ? 'closed' : 'active'
                })
                .eq('id', session.id);
              
              remainingToSell -= soldFromSession;
            }
          }
        } else {
          // No affected SELL transactions, just delete session and transaction
          const { error: deleteSessionError } = await supabase
            .from('sessions')
            .delete()
            .eq('id', transaction.session_id);
          
          if (deleteSessionError) throw deleteSessionError;
          
          const { error: deleteTxError } = await supabase
            .from('transactions')
            .delete()
            .eq('id', transaction.id);
          
          if (deleteTxError) throw deleteTxError;
        }
      } else {
          // Not the last BUY transaction - just delete this one and recalculate session
          const { error: deleteTxError } = await supabase
            .from('transactions')
            .delete()
            .eq('id', transaction.id);
          
          if (deleteTxError) throw deleteTxError;
          
          // Recalculate session totals
          const { data: remainingBuyTxs } = await supabase
            .from('transactions')
            .select('*')
            .eq('session_id', transaction.session_id)
            .eq('type', 'BUY');
          
          if (remainingBuyTxs && remainingBuyTxs.length > 0) {
            const newTotalInvest = remainingBuyTxs.reduce((sum: number, t: any) => sum + t.total_idr, 0);
            const newTotalUsdt = remainingBuyTxs.reduce((sum: number, t: any) => sum + t.amount_usdt, 0);
            const newAvgCost = newTotalUsdt > 0 ? newTotalInvest / newTotalUsdt : 0;
            
            // Get total sold USDT
            const { data: salesData } = await supabase
              .from('session_sales')
              .select('sold_usdt')
              .eq('session_id', transaction.session_id);
            
            const totalSoldUsdt = salesData?.reduce((sum: number, s: any) => sum + s.sold_usdt, 0) || 0;
            const newRemainingUsdt = Math.max(0, newTotalUsdt - totalSoldUsdt);
            
            // Update session
            await supabase
              .from('sessions')
              .update({
                total_invest_idr: newTotalInvest,
                total_usdt: newTotalUsdt,
                avg_cost: newAvgCost,
                remaining_usdt: newRemainingUsdt,
                status: newRemainingUsdt <= 0.01 ? 'closed' : 'active'
              })
              .eq('id', transaction.session_id);
          }
        }
      } else if (transaction.type === 'SELL') {
        // For SELL transactions, just delete the transaction
        // The database trigger 'trg_restore_session_on_sale_delete' on session_sales 
        // will automatically restore the session's remaining_usdt and realized_profit_idr
        
        const { error: deleteTxError } = await supabase
          .from('transactions')
          .delete()
          .eq('id', transaction.id);
        
        if (deleteTxError) throw deleteTxError;
      } else {
        // For other transaction types, just delete
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('id', transaction.id);
        
        if (error) throw error;
      }
      
      // Call parent's onDelete if provided
      if (onDelete) {
        onDelete(transaction.id);
      }
      
      setShowDeleteConfirm(false);
      onClose();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Gagal menghapus transaksi: ' + (error as Error).message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEdit = async (id: string, price: number, amount: number, fee: number, feeType: 'percent' | 'value', txTime: Date, label?: ExchangeLabel) => {
    if (onEdit) {
      await onEdit(id, price, amount, fee, feeType, txTime, label);
    }
    setShowEditModal(false);
  };

  // Generate reference number
  const generateRefNumber = () => {
    return transaction.id ? transaction.id.substring(0, 12).toUpperCase() : Date.now().toString();
  };

  // Calculate fee if exists
  const feeAmount = transaction.fee_idr || 0;
  const baseTotal = transaction.amount_usdt * transaction.price_idr;
  
  return (
    <>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gradient-to-b from-blue-500 to-blue-600 flex items-center justify-center z-50 p-4"
            onClick={onClose}
          >
            {/* Content Container with scroll */}
            <div className="flex flex-col items-center justify-center max-h-full overflow-y-auto py-4 w-full">
              {/* Top Section with Icon */}
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                className="mb-3 md:mb-4"
              >
                <div className="w-14 h-14 md:w-16 md:h-16 mx-auto rounded-full flex items-center justify-center bg-white shadow-lg">
                  <svg className="w-7 h-7 md:w-8 md:h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </motion.div>

              {/* Title */}
              <motion.h2
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-lg md:text-xl font-bold text-white mb-1"
              >
                Detail Transaksi
              </motion.h2>

              {/* Date/Time */}
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="text-white/90 text-xs md:text-sm mb-3 md:mb-4"
              >
                {new Date(transaction.tx_time).toLocaleString('id-ID', { 
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'Asia/Jakarta'
                })} WIB
              </motion.p>

              {/* White Card with Details */}
              <motion.div
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-sm md:max-w-md p-4 md:p-5"
                onClick={(e) => e.stopPropagation()}
              >
              {/* Transaction Type Badge */}
              <div className="flex justify-center mb-4">
                <span className={`px-4 py-1.5 rounded-full text-sm font-medium ${
                  transaction.type === 'BUY' 
                    ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                    : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                }`}>
                  {transaction.type === 'BUY' ? 'PEMBELIAN' : 'PENJUALAN'}
                </span>
              </div>

              {/* Total Transaction */}
              <div className="text-center mb-4 md:mb-6">
                <p className="text-gray-500 dark:text-gray-400 text-sm mb-2">Total Transaksi</p>
                <p className="text-2xl md:text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {formatIDR(Math.round(transaction.total_idr))}
                </p>
              </div>

              {/* Reference Number */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 dark:text-gray-400 text-sm">No. Ref</span>
                  <span className="font-mono text-xs md:text-sm font-medium text-gray-900 dark:text-gray-100">{generateRefNumber()}</span>
                </div>
              </div>

              {/* Transaction Details */}
              <div className="space-y-3 mb-4 md:mb-6">
                {/* Exchange */}
                {transaction.label && (
                  <div className="flex items-center space-x-3 pb-3 border-b dark:border-gray-700">
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                      <span className="text-purple-600 dark:text-purple-300 font-bold text-sm">
                        {transaction.label.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{transaction.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Platform Exchange</p>
                    </div>
                  </div>
                )}

                {/* Details Table */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 md:p-4 space-y-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-3">Detail Transaksi</p>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Jumlah</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {transaction.amount_usdt.toFixed(4)} USDT
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Harga</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      Rp {transaction.price_idr.toLocaleString('id-ID')}/USDT
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Subtotal</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatIDR(Math.round(baseTotal))}
                    </span>
                  </div>
                  
                  {feeAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Biaya Admin</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {formatIDR(Math.round(feeAmount))}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setShowEditModal(true)}
                  className="bg-blue-100 hover:bg-blue-200 text-blue-700 font-medium py-2.5 px-3 rounded-xl transition-colors flex items-center justify-center space-x-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>Edit</span>
                </button>
                
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="bg-red-100 hover:bg-red-200 text-red-700 font-medium py-2.5 px-3 rounded-xl transition-colors flex items-center justify-center space-x-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Hapus</span>
                </button>
                
                <button
                  onClick={onClose}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2.5 px-3 rounded-xl transition-colors flex items-center justify-center space-x-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Tutup</span>
                </button>
              </div>
            </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4"
            onClick={() => !isDeleting && setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full p-6"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Warning Icon */}
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              {/* Title & Message */}
              <h3 className="text-lg font-bold text-gray-900 dark:text-white text-center mb-2">
                Hapus Transaksi?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-6">
                Transaksi yang dihapus tidak dapat dikembalikan. Yakin ingin melanjutkan?
              </p>

              {/* Transaction Info */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-6">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Detail yang akan dihapus:</div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {transaction.type === 'BUY' ? 'Pembelian' : 'Penjualan'} {transaction.amount_usdt.toFixed(4)} USDT
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Total: {formatIDR(Math.round(transaction.total_idr))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  {isDeleting ? (
                    <>
                      <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Menghapus...
                    </>
                  ) : (
                    'Hapus Transaksi'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      {showEditModal && (
        <EditTransactionModal
          isOpen={showEditModal}
          transaction={transaction}
          onClose={() => setShowEditModal(false)}
          onSave={handleEdit}
        />
      )}
    </>
  );
}
