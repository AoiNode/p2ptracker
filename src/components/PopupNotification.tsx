"use client";
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatIDR } from '@/lib/utils';

interface PopupNotificationProps {
  show: boolean;
  type: 'success' | 'error';
  title: string;
  message: string;
  details?: {
    amount?: string;
    cost?: string;
    proceeds?: string;
    profit?: string;
    price?: string;
    exchange?: string;
    fee?: string;
    refNumber?: string;
  };
  onClose: () => void;
}

export default function PopupNotification({ 
  show, 
  type, 
  title, 
  message, 
  details,
  onClose 
}: PopupNotificationProps) {
  // Generate reference number
  const generateRefNumber = () => {
    return Date.now().toString() + Math.floor(Math.random() * 1000);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-gradient-to-b from-blue-500 to-blue-600 flex flex-col items-center justify-center z-50 px-4"
          onClick={onClose}
        >
          {/* Top Section with Icon */}
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
            className="mb-6"
          >
            <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${
              type === 'success' ? 'bg-white' : 'bg-red-100'
            } shadow-lg`}>
              {type === 'success' ? (
                <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
          </motion.div>

          {/* Title */}
          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-bold text-white mb-2"
          >
            {title}
          </motion.h2>

          {/* Date/Time */}
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-white/90 text-sm mb-6"
          >
            {new Date().toLocaleString('id-ID', { 
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
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm md:max-w-md lg:max-w-lg p-4 md:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Total Transaction */}
            <div className="text-center mb-6">
              <p className="text-gray-500 text-sm mb-2">Total Transaksi</p>
              <p className="text-3xl font-bold text-blue-600">
                {details?.proceeds || details?.cost || 'Rp0'}
              </p>
            </div>

            {/* Reference Number */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 text-sm">No. Ref</span>
                <span className="font-mono text-sm font-medium">{details?.refNumber || generateRefNumber()}</span>
              </div>
            </div>

            {/* Transaction Details */}
            <div className="space-y-3 mb-6">
              {/* Exchange */}
              {details?.exchange && (
                <div className="flex items-center space-x-3 pb-3 border-b">
                  <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-purple-600 font-bold text-sm">
                      {details.exchange.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{details.exchange}</p>
                    <p className="text-xs text-gray-500">Platform Exchange</p>
                  </div>
                </div>
              )}

              {/* Details Table */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p className="text-xs text-gray-500 font-medium mb-3">Detail Transaksi</p>
                
                {details?.amount && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Jumlah</span>
                    <span className="text-sm font-medium text-gray-900">{details.amount}</span>
                  </div>
                )}
                
                {details?.price && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Harga</span>
                    <span className="text-sm font-medium text-gray-900">{details.price}</span>
                  </div>
                )}
                
                {details?.fee && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Biaya Admin</span>
                    <span className="text-sm font-medium text-gray-900">{details.fee}</span>
                  </div>
                )}

                {/* Profit Section for SELL */}
                {details?.profit && (
                  <>
                    <div className="border-t pt-2 mt-2"></div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Modal</span>
                      <span className="text-sm font-medium text-gray-900">{details.cost}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Hasil</span>
                      <span className="text-sm font-medium text-gray-900">{details.proceeds}</span>
                    </div>
                    <div className="flex justify-between items-center bg-white rounded-lg p-2 mt-2">
                      <span className="text-sm font-medium text-gray-700">Profit/Loss</span>
                      <span className={`text-base font-bold ${
                        details.profit.startsWith('-') ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {details.profit}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  // Share functionality (optional)
                  if (navigator.share) {
                    navigator.share({
                      title: 'Transaksi Berhasil',
                      text: `${message}\nTotal: ${details?.proceeds || details?.cost || 'Rp0'}`,
                    });
                  }
                }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.032 4.026a9.001 9.001 0 01-7.432 0m9.032-4.026A9.001 9.001 0 0112 3c-4.474 0-8.268 3.12-9.032 7.326m0 0A9.001 9.001 0 0012 21c4.474 0 8.268-3.12 9.032-7.326" />
                </svg>
                <span>Bagikan</span>
              </button>
              <button
                onClick={onClose}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center space-x-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Selesai</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
