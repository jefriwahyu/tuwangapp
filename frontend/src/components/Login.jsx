import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const isLogin = mode === 'login';

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Email dan kata sandi wajib diisi dengan benar.');
      return;
    }
    if (!isLogin) {
      if (!name.trim()) {
        setErrorMsg('Nama lengkap wajib diisi.');
        return;
      }
      if (password.length < 8) {
        setErrorMsg('Kata sandi minimal 8 karakter.');
        return;
      }
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name.trim() } },
        });
        if (error) throw error;
        setSuccessMsg('Akun dibuat, cek email Anda untuk verifikasi instan.');
        setMode('login');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Terjadi kesalahan. Coba lagi ya.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot() {
    setErrorMsg('');
    setSuccessMsg('');
    if (!email.trim()) {
      setErrorMsg('Isi email dulu untuk reset kata sandi.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      setSuccessMsg('Tautan reset terkirim ke email Anda.');
    } catch (err) {
      setErrorMsg(err.message || 'Gagal mengirim tautan reset.');
    } finally {
      setLoading(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setErrorMsg('');
    setSuccessMsg('');
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Panel kiri - branding */}
        <div className="login-brand">
          <div className="login-glow login-glow-1" aria-hidden="true" />
          <div className="login-glow login-glow-2" aria-hidden="true" />
          <div className="login-brand-top">
            <div className="login-mark">
              <span className="login-mark-icon">
                <span className="material-symbols-outlined">account_balance_wallet</span>
              </span>
              <span className="login-mark-text">
                <strong>Taktuntuwang</strong>
                <em>FINANSIAL AI</em>
              </span>
            </div>

            <h1 className="login-title">Kelola uang semudah ngobrol</h1>
            <p className="login-subtitle">
              Ceritakan pemasukan dan pengeluaran, AI mencatat dan merangkumnya secara otomatis tanpa ribet.
            </p>

          <ul className="login-features">
            <li>
              <span className="login-feat-icon">
                <span className="material-symbols-outlined">chat_bubble</span>
              </span>
              <div>
                <strong>Chat-based tracking</strong>
                <span>Tulis pengeluaran seperti mengirim pesan ke teman santai.</span>
              </div>
            </li>
            <li>
              <span className="login-feat-icon">
                <span className="material-symbols-outlined">query_stats</span>
              </span>
              <div>
                <strong>Ringkasan visual</strong>
                <span>Grafik pengeluaran &amp; pemasukan diperbarui otomatis secara real-time.</span>
              </div>
            </li>
            <li>
              <span className="login-feat-icon">
                <span className="material-symbols-outlined">lock</span>
              </span>
              <div>
                <strong>Aman &amp; privat</strong>
                <span>Data keuangan tersimpan aman dengan enkripsi standar industri.</span>
              </div>
            </li>
          </ul>
          </div>
          <p className="login-meta">Taktuntuwang v1.0 • Asisten Keuangan Pribadi Berbasis AI</p>
        </div>

        {/* Panel kanan - form */}
        <div className="login-form-wrap">
          <div className="login-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={isLogin}
              className={isLogin ? 'login-tab active' : 'login-tab'}
              onClick={() => switchMode('login')}
            >
              Masuk
              {isLogin && <span className="login-tab-ind" aria-hidden="true" />}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!isLogin}
              className={!isLogin ? 'login-tab active' : 'login-tab'}
              onClick={() => switchMode('register')}
            >
              Daftar Akun
              {!isLogin && <span className="login-tab-ind" aria-hidden="true" />}
            </button>
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            {!isLogin && (
              <label className="login-field">
                <span className="login-label">Nama Lengkap</span>
                <span className="login-input-wrap">
                  <span className="material-symbols-outlined login-input-icon">person</span>
                  <input
                    type="text"
                    placeholder="Contoh: Andi Pratama"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoComplete="name"
                  />
                </span>
              </label>
            )}
            <label className="login-field">
              <span className="login-label">Email</span>
              <span className="login-input-wrap">
                <span className="material-symbols-outlined login-input-icon">mail</span>
                <input
                  type="email"
                  placeholder="nama@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </span>
            </label>

            <div className="login-field">
              <span className="login-label-row">
                <span className="login-label">Kata Sandi</span>
                {isLogin && (
                  <button type="button" className="login-link" onClick={handleForgot}>
                    Lupa kata sandi?
                  </button>
                )}
              </span>
              <span className="login-input-wrap">
                <span className="material-symbols-outlined login-input-icon">key</span>
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Minimal 8 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  required
                />
                <button
                  type="button"
                  className="login-peek"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  <span className="material-symbols-outlined">
                    {showPw ? 'visibility_off' : 'visibility'}
                  </span>
                  <span>{showPw ? 'Tutup' : 'Lihat'}</span>
                </button>
              </span>
            </div>

            <div className="login-submit-wrap">
              <button type="submit" className="login-submit" disabled={loading}>
                {loading ? (
                  <>
                    <span className="login-spinner" aria-hidden="true" />
                    {isLogin ? 'Masuk...' : 'Mendaftar...'}
                  </>
                ) : (
                  <>
                    <span>{isLogin ? 'Masuk ke Akun' : 'Daftar Akun Baru'}</span>
                    <span className="material-symbols-outlined">
                      {isLogin ? 'arrow_forward' : 'person_add'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>

          {errorMsg && (
            <div className="login-alert login-alert-error" role="alert">
              <span className="material-symbols-outlined">error</span>
              <p>{errorMsg}</p>
            </div>
          )}
          {successMsg && (
            <div className="login-alert login-alert-success" role="status">
              <span className="material-symbols-outlined">check_circle</span>
              <p>{successMsg}</p>
            </div>
          )}

          <p className="login-secure">
            <span className="material-symbols-outlined">verified_user</span>
            Dilindungi standar keamanan perbankan 256-bit TLS
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
