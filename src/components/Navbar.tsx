import React from 'react';
import { Role, UserProfile, RiderProfile, Order } from '../types';
import { User, Bike, Phone, LogOut, ShieldCheck, Star } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface NavbarProps {
  currentRole: Role;
  onChangeRole: (role: Role) => void;
  currentUser: UserProfile;
  rider?: RiderProfile;
  onOpenAuthModal?: () => void;
  onOpenAppwriteModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  onChangeRole,
  currentUser,
  rider,
  onOpenAuthModal,
  onOpenAppwriteModal,
}) => {
  const { user: authUser, signOut } = useAuth();


  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-violet-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-indigo-600/20">
              QD
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight font-heading text-slate-900">
                  QuickDrop<span className="text-indigo-600">Delivery</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden md:block">
                Tricity On-Demand Parcel & Courier Logistics
              </p>
            </div>
          </div>

          {/* Role Switcher Tabs */}
          {(!authUser || authUser.role === 'admin') ? (
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
              <button
                onClick={() => onChangeRole('customer')}
                className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  currentRole === 'customer'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Customer</span>
              </button>

              <button
                onClick={() => onChangeRole('rider')}
                className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
                  currentRole === 'rider'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Bike className="w-4 h-4" />
                <span>Delivery Partner</span>
              </button>
            </div>
          ) : authUser.role === 'customer' ? (
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
              <button
                onClick={() => onChangeRole('customer')}
                className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center gap-1.5 bg-white text-indigo-700 shadow-xs"
              >
                <User className="w-4 h-4" />
                <span>Customer</span>
              </button>
            </div>
          ) : authUser.role === 'rider' ? (
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
              <button
                onClick={() => onChangeRole('rider')}
                className="px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center gap-1.5 bg-white text-indigo-700 shadow-xs"
              >
                <Bike className="w-4 h-4" />
                <span>Delivery Partner</span>
              </button>
            </div>
          ) : null}

          {/* User Profile & Auth Status */}
          <div className="flex items-center gap-2">
            {authUser && authUser.role === 'customer' && currentRole === 'customer' && !currentUser?.isBlocked ? (
              <div className="flex items-center gap-2.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl text-slate-900 shadow-2xs">
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs shrink-0 overflow-hidden">
                  {currentUser?.photo && currentUser.photo.trim() !== '' ? (
                    <img src={currentUser.photo} alt={currentUser.name} className="w-full h-full object-cover" />
                  ) : (
                    (currentUser?.name && currentUser.name !== 'User' ? currentUser.name : currentUser?.email ? currentUser.email.charAt(0) : 'C').toUpperCase()
                  )}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-extrabold text-slate-900 truncate max-w-[160px]">
                    {currentUser?.name || 'Customer'}
                  </span>
                  <span className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider">
                    Customer Account
                  </span>
                </div>
                <button
                  onClick={() => signOut()}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1 cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : authUser && authUser.role === 'rider' && currentRole === 'rider' && !rider?.isBlocked ? (
              <div className="flex items-center gap-2.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-slate-900 shadow-2xs">
                <div className="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs shrink-0 overflow-hidden">
                  {rider?.photo && rider.photo.trim() !== '' ? (
                    <img src={rider.photo} alt={rider.name} className="w-full h-full object-cover" />
                  ) : (
                    <Bike className="w-4 h-4" />
                  )}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-extrabold text-slate-900 truncate max-w-[160px]">
                    {rider?.name || 'Rider'}
                  </span>
                </div>
                <button
                  onClick={() => signOut()}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1 cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : authUser && authUser.role === 'admin' && currentRole === 'admin' ? (
              <div className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-slate-800 text-xs font-semibold">
                <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px]">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-[11px] font-bold text-slate-900 truncate max-w-[140px]">
                    {authUser.full_name && authUser.full_name !== 'User' ? authUser.full_name : (authUser.email ? authUser.email.split('@')[0] : 'Admin')}
                  </span>
                  <span className="text-[9px] text-emerald-700 font-extrabold uppercase tracking-wider truncate max-w-[140px]">
                    {authUser.role}
                  </span>
                </div>
                <button
                  onClick={() => signOut()}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1 cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
             ) : authUser ? (
                <button
                  onClick={() => signOut()}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              ) : (
                <button
                  onClick={() => onChangeRole('admin')}
                  className="p-2 text-amber-500 hover:text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-full transition-all cursor-pointer relative shadow-2xs"
                  title="Admin Portal"
                >
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-amber-600 rounded-full"></span>
                </button>
              )}
          </div>
        </div>
      </div>
    </header>
  );
};
