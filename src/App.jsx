import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabaseClient'

const ADMIN_EMAIL = 'admin@assetflowit.com'
const ADMIN_PASSWORD = 'assetit.com'

const mapBorrowingFromDb = (row) => ({
  id: row.id,
  assetId: row.asset_id,
  namaBarang: row.nama_barang,
  kodeBarang: row.kode_barang,
  namaPeminjam: row.nama_peminjam,
  unitRuangan: row.unit_ruangan,
  tanggalPinjam: row.tanggal_pinjam,
  tanggalKembali: row.tanggal_kembali,
  tandaTangan: row.ttd_base64,
  status: row.status,
})

function App() {
  const [assets, setAssets] = useState([])
  const [borrowings, setBorrowings] = useState([])
  const [assetsLoading, setAssetsLoading] = useState(false)
  const [borrowingsLoading, setBorrowingsLoading] = useState(false)
  const [assetsError, setAssetsError] = useState('')
  const [borrowingsError, setBorrowingsError] = useState('')
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(
    () => localStorage.getItem('isAdminLoggedIn') === 'true',
  )
  const [actionLoading, setActionLoading] = useState(false)
  const [toasts, setToasts] = useState([])

  const showToast = (message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, type }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id))
    }, 2800)
  }

  const fetchAssets = useCallback(async () => {
    setAssetsLoading(true)
    setAssetsError('')
    try {
      const { data, error } = await supabase.from('assets').select('*').order('id', { ascending: true })
      if (error) throw error
      setAssets(data ?? [])
    } catch (error) {
      const message = error?.message || 'Gagal memuat data aset.'
      setAssetsError(message)
      showToast(message, 'error')
    } finally {
      setAssetsLoading(false)
    }
  }, [])

  const fetchBorrowings = useCallback(async () => {
    setBorrowingsLoading(true)
    setBorrowingsError('')
    try {
      const { data, error } = await supabase
        .from('peminjaman')
        .select('*')
        .order('id', { ascending: false })
      if (error) throw error
      setBorrowings((data ?? []).map(mapBorrowingFromDb))
    } catch (error) {
      const message = error?.message || 'Gagal memuat data peminjaman.'
      setBorrowingsError(message)
      showToast(message, 'error')
    } finally {
      setBorrowingsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAssets()
    fetchBorrowings()
  }, [fetchAssets, fetchBorrowings])

  const loginAdmin = async (email, password) => {
    setActionLoading(true)
    try {
      if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        localStorage.setItem('isAdminLoggedIn', 'true')
        setIsAdminLoggedIn(true)
        showToast('Berhasil login.')
        return { success: true }
      }
      return { success: false, message: 'Email atau password salah' }
    } catch {
      return { success: false, message: 'Email atau password salah' }
    } finally {
      setActionLoading(false)
    }
  }

  const logoutAdmin = async () => {
    setActionLoading(true)
    try {
      localStorage.removeItem('isAdminLoggedIn')
      setIsAdminLoggedIn(false)
      showToast('Berhasil logout.')
      return { success: true }
    } catch {
      showToast('Logout gagal.', 'error')
      return { success: false }
    } finally {
      setActionLoading(false)
    }
  }

  const addAsset = async (assetForm) => {
    setActionLoading(true)
    try {
      const payload = {
        nama: assetForm.nama,
        kode: assetForm.kode,
        type: assetForm.type,
        kondisi: assetForm.kondisi,
        lokasi: assetForm.lokasi,
        status: 'Tersedia',
      }
      const { error } = await supabase.from('assets').insert([payload])
      if (error) throw error
      await fetchAssets()
      showToast('Barang berhasil ditambahkan.')
    } catch (error) {
      showToast(error?.message || 'Gagal menambahkan barang.', 'error')
      throw error
    } finally {
      setActionLoading(false)
    }
  }

  const updateAsset = async (id, updatedAsset) => {
    setActionLoading(true)
    try {
      const payload = {
        nama: updatedAsset.nama,
        kode: updatedAsset.kode,
        type: updatedAsset.type,
        kondisi: updatedAsset.kondisi,
        lokasi: updatedAsset.lokasi,
        status: updatedAsset.status,
      }
      const { error } = await supabase.from('assets').update(payload).eq('id', id)
      if (error) throw error
      await fetchAssets()
      showToast('Data barang berhasil diperbarui.')
    } catch (error) {
      showToast(error?.message || 'Gagal memperbarui barang.', 'error')
      throw error
    } finally {
      setActionLoading(false)
    }
  }

  const submitBorrowing = async (payload) => {
    setActionLoading(true)
    try {
      const selected = assets.find((item) => item.id === payload.assetId)
      if (!selected) {
        throw new Error('Barang tidak ditemukan.')
      }

      const borrowPayload = {
        asset_id: selected.id,
        nama_barang: selected.nama,
        kode_barang: selected.kode,
        nama_peminjam: payload.namaPeminjam,
        unit_ruangan: payload.unitRuangan,
        tanggal_pinjam: payload.tanggalPinjam,
        tanggal_kembali: payload.tanggalKembali,
        ttd_base64: payload.tandaTangan,
        status: 'Dipinjam',
      }

      const { error: insertError } = await supabase.from('peminjaman').insert([borrowPayload])
      if (insertError) throw insertError

      const { error: updateError } = await supabase
        .from('assets')
        .update({ status: 'Dipinjam' })
        .eq('id', selected.id)
      if (updateError) throw updateError

      await Promise.all([fetchBorrowings(), fetchAssets()])
      showToast('Peminjaman berhasil diajukan.')
    } catch (error) {
      showToast(error?.message || 'Gagal mengajukan peminjaman.', 'error')
      throw error
    } finally {
      setActionLoading(false)
    }
  }

  const confirmReturn = async (borrowingId, assetId) => {
    setActionLoading(true)
    try {
      const { error: borrowingError } = await supabase
        .from('peminjaman')
        .update({ status: 'Dikembalikan' })
        .eq('id', borrowingId)
      if (borrowingError) throw borrowingError

      const { error: assetError } = await supabase
        .from('assets')
        .update({ status: 'Tersedia' })
        .eq('id', assetId)
      if (assetError) throw assetError

      await Promise.all([fetchBorrowings(), fetchAssets()])
      showToast('Pengembalian berhasil dikonfirmasi.')
    } catch (error) {
      showToast(error?.message || 'Gagal mengonfirmasi pengembalian.', 'error')
      throw error
    } finally {
      setActionLoading(false)
    }
  }

  const appData = {
    assets,
    borrowings,
    assetsLoading,
    borrowingsLoading,
    assetsError,
    borrowingsError,
    isAdminLoggedIn,
    actionLoading,
    loginAdmin,
    logoutAdmin,
    addAsset,
    updateAsset,
    submitBorrowing,
    confirmReturn,
    fetchAssets,
    fetchBorrowings,
    showToast,
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/admin/login"
          element={<AdminLoginPage appData={appData} />}
        />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute isAdminLoggedIn={isAdminLoggedIn}>
              <AdminLayout appData={appData}>
                <DashboardPage appData={appData} />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/barang/tambah"
          element={
            <ProtectedRoute isAdminLoggedIn={isAdminLoggedIn}>
              <AdminLayout appData={appData}>
                <AddAssetPage appData={appData} />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/barang/edit"
          element={
            <ProtectedRoute isAdminLoggedIn={isAdminLoggedIn}>
              <AdminLayout appData={appData}>
                <EditAssetPage appData={appData} />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/barang/detail"
          element={
            <ProtectedRoute isAdminLoggedIn={isAdminLoggedIn}>
              <AdminLayout appData={appData}>
                <AssetDetailPage appData={appData} />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/peminjaman"
          element={
            <ProtectedRoute isAdminLoggedIn={isAdminLoggedIn}>
              <AdminLayout appData={appData}>
                <BorrowTrackingPage appData={appData} />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/pengembalian"
          element={
            <ProtectedRoute isAdminLoggedIn={isAdminLoggedIn}>
              <AdminLayout appData={appData}>
                <ReturnConfirmationPage appData={appData} />
              </AdminLayout>
            </ProtectedRoute>
          }
        />
        <Route path="/pinjam" element={<BorrowFormPage appData={appData} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ToastList toasts={toasts} />
    </div>
  )
}

function HomePage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4">
      <div className="absolute inset-0 bg-grid-pattern opacity-70" />
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white/90 p-8 text-center shadow-xl backdrop-blur sm:p-12">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-brand-navy text-white">
          <DatabaseIcon />
        </div>
        <h1 className="font-heading text-4xl font-bold text-brand-navy sm:text-5xl">AssetFlow IT</h1>
        <p className="mt-3 text-base text-slate-600 sm:text-lg">Sistem Manajemen Peminjaman Aset IT</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link to="/admin/login" className="btn-primary">
            Login Admin
          </Link>
          <Link to="/pinjam" className="btn-secondary">
            Pinjam Barang
          </Link>
        </div>
      </div>
    </main>
  )
}

function AdminLoginPage({ appData }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState({})
  const [loginError, setLoginError] = useState('')

  if (appData.isAdminLoggedIn) {
    return <Navigate to="/admin/dashboard" replace />
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!form.email.trim()) nextErrors.email = 'Email wajib diisi.'
    if (!form.password.trim()) nextErrors.password = 'Password wajib diisi.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    const result = await appData.loginAdmin(form.email, form.password)
    if (result.success) {
      navigate('/admin/dashboard')
      return
    }
    setLoginError(result.message || 'Email atau password salah.')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl bg-white p-7 shadow-lg transition-all duration-300"
      >
        <h2 className="font-heading text-3xl font-semibold text-brand-navy">Login Admin</h2>
        <p className="mt-1 text-sm text-slate-500">Gunakan akun administrator untuk mengakses dashboard.</p>
        <div className="mt-6 space-y-4">
          <FormInput
            label="Email"
            type="email"
            value={form.email}
            onChange={(value) => {
              setForm((prev) => ({ ...prev, email: value }))
              setLoginError('')
            }}
            error={errors.email}
          />
          <FormInput
            label="Password"
            type="password"
            value={form.password}
            onChange={(value) => {
              setForm((prev) => ({ ...prev, password: value }))
              setLoginError('')
            }}
            error={errors.password}
          />
        </div>
        {loginError ? <p className="mt-3 text-sm text-red-600">{loginError}</p> : null}
        <button type="submit" className="btn-primary mt-6 w-full" disabled={appData.actionLoading}>
          {appData.actionLoading ? 'Memproses...' : 'Masuk Dashboard'}
        </button>
        <Link to="/" className="mt-4 inline-block text-sm text-brand-blue hover:underline">
          Kembali ke Beranda
        </Link>
      </form>
    </main>
  )
}

function ProtectedRoute({ isAdminLoggedIn, children }) {
  if (!isAdminLoggedIn) {
    return <Navigate to="/admin/login" replace />
  }
  return children
}

function AdminLayout({ appData, children }) {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (localStorage.getItem('isAdminLoggedIn') !== 'true') {
      navigate('/admin/login')
    }
  }, [location.pathname, navigate])

  const navItems = [
    { path: '/admin/dashboard', label: 'Dashboard' },
    { path: '/admin/barang/tambah', label: 'Tambah Barang' },
    { path: '/admin/barang/edit', label: 'Edit Barang' },
    { path: '/admin/barang/detail', label: 'Detail Barang' },
    { path: '/admin/peminjaman', label: 'Track Peminjaman' },
    { path: '/admin/pengembalian', label: 'Konfirmasi Pengembalian' },
  ]

  return (
    <div className="flex min-h-screen">
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-72 bg-brand-navy p-5 text-slate-200 shadow-xl transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-8 border-b border-slate-700 pb-4">
          <h2 className="font-heading text-2xl font-bold text-white">AssetFlow IT</h2>
          <p className="mt-1 text-sm text-slate-300">Administrator</p>
        </div>
        <nav className="space-y-2">
          {navItems.map((item) => {
            const active = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={`block rounded-lg px-3 py-2 text-sm transition ${
                  active ? 'bg-brand-blue text-white' : 'hover:bg-slate-700'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <button
          type="button"
          disabled={appData.actionLoading}
          onClick={async () => {
            const result = await appData.logoutAdmin()
            if (result.success) {
              setIsOpen(false)
              navigate('/')
            }
          }}
          className="mt-8 w-full rounded-lg border border-slate-500 px-3 py-2 text-sm hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {appData.actionLoading ? 'Memproses...' : 'Logout'}
        </button>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col lg:ml-72">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-6">
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm lg:hidden"
          >
            Menu
          </button>
        </header>
        <main className="page-enter flex-1 p-4 sm:p-6">{children}</main>
      </div>

      {isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 z-20 bg-black/30 lg:hidden"
          aria-label="Tutup menu"
        />
      ) : null}
    </div>
  )
}

function DashboardPage({ appData }) {
  const loading = appData.assetsLoading || appData.borrowingsLoading
  const error = appData.assetsError || appData.borrowingsError
  if (loading) return <LoadingPanel message="Memuat data dashboard..." />
  if (error) return <ErrorPanel message={error} onRetry={() => Promise.all([appData.fetchAssets(), appData.fetchBorrowings()])} />

  const total = appData.assets.length
  const tersedia = appData.assets.filter((item) => item.status === 'Tersedia').length
  const dipinjam = appData.assets.filter((item) => item.status === 'Dipinjam').length
  const rusak = appData.assets.filter(
    (item) => item.status === 'Rusak' || item.kondisi === 'Rusak' || item.kondisi === 'Rusak Parah',
  ).length

  const cards = [
    { label: 'Total Aset', value: total, color: 'text-brand-navy' },
    { label: 'Aset Tersedia', value: tersedia, color: 'text-emerald-600' },
    { label: 'Sedang Dipinjam', value: dipinjam, color: 'text-amber-500' },
    { label: 'Rusak', value: rusak, color: 'text-red-600' },
  ]

  return (
    <section className="space-y-6">
      <h1 className="font-heading text-3xl font-semibold text-brand-navy">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className={`mt-2 text-3xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="font-heading text-xl font-semibold text-brand-navy">Aktivitas Peminjaman Terbaru</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-3 py-2">Nama Barang</th>
                <th className="px-3 py-2">Peminjam</th>
                <th className="px-3 py-2">Tanggal Pinjam</th>
                <th className="px-3 py-2">Tanggal Kembali</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {appData.borrowings.slice(0, 5).map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="px-3 py-2">{item.namaBarang}</td>
                  <td className="px-3 py-2">{item.namaPeminjam}</td>
                  <td className="px-3 py-2">{item.tanggalPinjam}</td>
                  <td className="px-3 py-2">{item.tanggalKembali}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={item.status} />
                  </td>
                </tr>
              ))}
              {appData.borrowings.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-slate-500" colSpan={5}>
                    Belum ada data peminjaman.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

function AddAssetPage({ appData }) {
  const [form, setForm] = useState({
    nama: '',
    kode: '',
    type: '',
    kondisi: 'Baik',
    lokasi: '',
  })
  const [errors, setErrors] = useState({})

  const onSubmit = async (event) => {
    event.preventDefault()
    const nextErrors = validateRequired(form, ['nama', 'kode', 'type', 'kondisi', 'lokasi'])
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    try {
      await appData.addAsset(form)
      setForm({ nama: '', kode: '', type: '', kondisi: 'Baik', lokasi: '' })
    } catch {
      return
    }
  }

  return (
    <section className="rounded-xl bg-white p-6 shadow-sm">
      <h1 className="font-heading text-2xl font-semibold text-brand-navy">Tambah Barang</h1>
      {appData.assetsError ? <ErrorInline message={appData.assetsError} /> : null}
      <form onSubmit={onSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
        <FormInput
          label="Nama Barang"
          value={form.nama}
          onChange={(value) => setForm((prev) => ({ ...prev, nama: value }))}
          error={errors.nama}
        />
        <FormInput
          label="Kode Barang"
          value={form.kode}
          onChange={(value) => setForm((prev) => ({ ...prev, kode: value }))}
          error={errors.kode}
        />
        <FormInput
          label="Type Barang"
          value={form.type}
          onChange={(value) => setForm((prev) => ({ ...prev, type: value }))}
          error={errors.type}
        />
        <FormSelect
          label="Kondisi Barang"
          value={form.kondisi}
          onChange={(value) => setForm((prev) => ({ ...prev, kondisi: value }))}
          options={['Baik', 'Rusak', 'Rusak Parah']}
          error={errors.kondisi}
        />
        <FormInput
          label="Lokasi Penyimpanan"
          value={form.lokasi}
          onChange={(value) => setForm((prev) => ({ ...prev, lokasi: value }))}
          error={errors.lokasi}
        />
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Status Barang</p>
          <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
            Tersedia
          </span>
        </div>
        <div className="md:col-span-2">
          <button type="submit" className="btn-primary" disabled={appData.actionLoading}>
            {appData.actionLoading ? 'Menyimpan...' : 'Simpan Barang'}
          </button>
        </div>
      </form>
    </section>
  )
}

function EditAssetPage({ appData }) {
  const [keyword, setKeyword] = useState('')
  const [selectedAsset, setSelectedAsset] = useState(null)
  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})

  if (appData.assetsLoading) return <LoadingPanel message="Memuat data aset..." />
  if (appData.assetsError) return <ErrorPanel message={appData.assetsError} onRetry={appData.fetchAssets} />

  const filtered = appData.assets.filter((item) => {
    const query = keyword.trim().toLowerCase()
    if (!query) return true
    return (
      item.nama.toLowerCase().includes(query) ||
      item.kode.toLowerCase().includes(query) ||
      item.type.toLowerCase().includes(query)
    )
  })

  const saveChanges = async (event) => {
    event.preventDefault()
    if (!selectedAsset || !form) return
    const nextErrors = validateRequired(form, ['nama', 'kode', 'type', 'kondisi', 'lokasi', 'status'])
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    try {
      await appData.updateAsset(selectedAsset.id, form)
      setSelectedAsset(null)
      setForm(null)
    } catch {
      return
    }
  }

  return (
    <section className="space-y-4 rounded-xl bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-heading text-2xl font-semibold text-brand-navy">Edit Barang</h1>
        <input
          className="input-base w-full sm:w-72"
          placeholder="Cari nama / kode / tipe..."
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-3 py-2">Nama Barang</th>
              <th className="px-3 py-2">Kode</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Kondisi</th>
              <th className="px-3 py-2">Lokasi</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="px-3 py-2">{item.nama}</td>
                <td className="px-3 py-2">{item.kode}</td>
                <td className="px-3 py-2">{item.type}</td>
                <td className="px-3 py-2">{item.kondisi}</td>
                <td className="px-3 py-2">{item.lokasi}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="rounded-md bg-brand-blue px-3 py-1 text-xs font-medium text-white"
                    onClick={() => {
                      setSelectedAsset(item)
                      setForm({
                        nama: item.nama,
                        kode: item.kode,
                        type: item.type,
                        kondisi: item.kondisi,
                        lokasi: item.lokasi,
                        status: item.status,
                      })
                      setErrors({})
                    }}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedAsset && form ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <form onSubmit={saveChanges} className="w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl">
            <h2 className="font-heading text-xl font-semibold text-brand-navy">
              Edit {selectedAsset.nama}
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <FormInput
                label="Nama Barang"
                value={form.nama}
                onChange={(value) => setForm((prev) => ({ ...prev, nama: value }))}
                error={errors.nama}
              />
              <FormInput
                label="Kode Barang"
                value={form.kode}
                onChange={(value) => setForm((prev) => ({ ...prev, kode: value }))}
                error={errors.kode}
              />
              <FormInput
                label="Type Barang"
                value={form.type}
                onChange={(value) => setForm((prev) => ({ ...prev, type: value }))}
                error={errors.type}
              />
              <FormSelect
                label="Kondisi Barang"
                value={form.kondisi}
                onChange={(value) => setForm((prev) => ({ ...prev, kondisi: value }))}
                options={['Baik', 'Rusak', 'Rusak Parah']}
                error={errors.kondisi}
              />
              <FormInput
                label="Lokasi Penyimpanan"
                value={form.lokasi}
                onChange={(value) => setForm((prev) => ({ ...prev, lokasi: value }))}
                error={errors.lokasi}
              />
              <FormSelect
                label="Status Barang"
                value={form.status}
                onChange={(value) => setForm((prev) => ({ ...prev, status: value }))}
                options={['Tersedia', 'Dipinjam']}
                error={errors.status}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
                onClick={() => {
                  setSelectedAsset(null)
                  setForm(null)
                }}
              >
                Batal
              </button>
              <button type="submit" className="btn-primary" disabled={appData.actionLoading}>
                {appData.actionLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  )
}

function AssetDetailPage({ appData }) {
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState('Semua')

  if (appData.assetsLoading) return <LoadingPanel message="Memuat detail aset..." />
  if (appData.assetsError) return <ErrorPanel message={appData.assetsError} onRetry={appData.fetchAssets} />

  const filtered = appData.assets.filter((item) => {
    const query = keyword.trim().toLowerCase()
    const matchName = item.nama.toLowerCase().includes(query)
    const matchStatus = status === 'Semua' ? true : item.status === status
    return matchName && matchStatus
  })

  return (
    <section className="rounded-xl bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="font-heading text-2xl font-semibold text-brand-navy">Detail Barang</h1>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className="input-base"
            placeholder="Cari nama barang..."
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <select
            className="input-base"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option>Semua</option>
            <option>Tersedia</option>
            <option>Dipinjam</option>
          </select>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-3 py-2">Nama Barang</th>
              <th className="px-3 py-2">Kode Barang</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Kondisi</th>
              <th className="px-3 py-2">Lokasi</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="px-3 py-2">{item.nama}</td>
                <td className="px-3 py-2">{item.kode}</td>
                <td className="px-3 py-2">{item.type}</td>
                <td className="px-3 py-2">{item.kondisi}</td>
                <td className="px-3 py-2">{item.lokasi}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={item.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function BorrowTrackingPage({ appData }) {
  const [keyword, setKeyword] = useState('')

  if (appData.borrowingsLoading) return <LoadingPanel message="Memuat data peminjaman..." />
  if (appData.borrowingsError) return <ErrorPanel message={appData.borrowingsError} onRetry={appData.fetchBorrowings} />

  const filtered = appData.borrowings.filter((item) => {
    const query = keyword.trim().toLowerCase()
    if (!query) return true
    return (
      item.namaPeminjam.toLowerCase().includes(query) ||
      item.namaBarang.toLowerCase().includes(query)
    )
  })

  return (
    <section className="rounded-xl bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-heading text-2xl font-semibold text-brand-navy">Track Data Peminjaman</h1>
        <input
          className="input-base w-full sm:w-80"
          placeholder="Cari peminjam atau barang..."
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-3 py-2">Nama Barang</th>
              <th className="px-3 py-2">Nama Peminjam</th>
              <th className="px-3 py-2">Unit/Ruangan</th>
              <th className="px-3 py-2">Tanggal Pinjam</th>
              <th className="px-3 py-2">Tanggal Kembali</th>
              <th className="px-3 py-2">Status Saat Ini</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="px-3 py-2">{item.namaBarang}</td>
                <td className="px-3 py-2">{item.namaPeminjam}</td>
                <td className="px-3 py-2">{item.unitRuangan}</td>
                <td className="px-3 py-2">{item.tanggalPinjam}</td>
                <td className="px-3 py-2">{item.tanggalKembali}</td>
                <td className="px-3 py-2">
                  <StatusBadge status={item.status} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-slate-500" colSpan={6}>
                  Tidak ada data peminjaman.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ReturnConfirmationPage({ appData }) {
  if (appData.borrowingsLoading || appData.assetsLoading) return <LoadingPanel message="Memuat data pengembalian..." />
  if (appData.borrowingsError || appData.assetsError) {
    return (
      <ErrorPanel
        message={appData.borrowingsError || appData.assetsError}
        onRetry={() => Promise.all([appData.fetchBorrowings(), appData.fetchAssets()])}
      />
    )
  }

  const activeBorrowings = appData.borrowings.filter((item) => item.status === 'Dipinjam')

  return (
    <section className="rounded-xl bg-white p-6 shadow-sm">
      <h1 className="font-heading text-2xl font-semibold text-brand-navy">Konfirmasi Pengembalian</h1>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[780px] text-left text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="px-3 py-2">Nama Barang</th>
              <th className="px-3 py-2">Nama Peminjam</th>
              <th className="px-3 py-2">Tanggal Pinjam</th>
              <th className="px-3 py-2">Tanggal Kembali</th>
              <th className="px-3 py-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {activeBorrowings.map((item) => (
              <tr key={item.id} className="border-b border-slate-100">
                <td className="px-3 py-2">{item.namaBarang}</td>
                <td className="px-3 py-2">{item.namaPeminjam}</td>
                <td className="px-3 py-2">{item.tanggalPinjam}</td>
                <td className="px-3 py-2">{item.tanggalKembali}</td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    disabled={appData.actionLoading}
                    className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
                    onClick={async () => {
                      const confirmed = window.confirm('Yakin ingin mengonfirmasi pengembalian?')
                      if (!confirmed) return
                      try {
                        await appData.confirmReturn(item.id, item.assetId)
                      } catch {
                        return
                      }
                    }}
                  >
                    Konfirmasi Kembali
                  </button>
                </td>
              </tr>
            ))}
            {activeBorrowings.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-slate-500" colSpan={5}>
                  Tidak ada barang yang sedang dipinjam.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function BorrowFormPage({ appData }) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [form, setForm] = useState({
    namaPeminjam: '',
    unitRuangan: '',
    selectedAssetId: '',
    assetQuery: '',
    tanggalPinjam: today,
    tanggalKembali: '',
    tandaTangan: '',
  })
  const [errors, setErrors] = useState({})
  const [showDropdown, setShowDropdown] = useState(false)
  const [signatureResetKey, setSignatureResetKey] = useState(0)
  const handleSignatureChange = useCallback((value) => {
    setForm((prev) => ({ ...prev, tandaTangan: value }))
  }, [])

  if (appData.assetsLoading) return <LoadingPanel message="Memuat daftar barang tersedia..." />
  if (appData.assetsError) return <ErrorPanel message={appData.assetsError} onRetry={appData.fetchAssets} />

  const availableAssets = appData.assets.filter((item) => item.status === 'Tersedia')
  const suggestions = availableAssets.filter((item) =>
    item.nama.toLowerCase().includes(form.assetQuery.trim().toLowerCase()),
  )

  const onSubmit = async (event) => {
    event.preventDefault()
    const selectedAsset = availableAssets.find((item) => String(item.id) === form.selectedAssetId)
    const nextErrors = {}
    if (!form.namaPeminjam.trim()) nextErrors.namaPeminjam = 'Nama peminjam wajib diisi.'
    if (!form.unitRuangan.trim()) nextErrors.unitRuangan = 'Unit/Ruangan wajib diisi.'
    if (!selectedAsset) nextErrors.selectedAssetId = 'Pilih barang yang tersedia.'
    if (!form.tanggalKembali) nextErrors.tanggalKembali = 'Tanggal kembali wajib dipilih.'
    if (!form.tandaTangan) nextErrors.tandaTangan = 'Tanda tangan wajib diisi.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    try {
      await appData.submitBorrowing({
        assetId: selectedAsset.id,
        namaPeminjam: form.namaPeminjam.trim(),
        unitRuangan: form.unitRuangan.trim(),
        tanggalPinjam: form.tanggalPinjam,
        tanggalKembali: form.tanggalKembali,
        tandaTangan: form.tandaTangan,
      })
    } catch {
      return
    }

    setForm({
      namaPeminjam: '',
      unitRuangan: '',
      selectedAssetId: '',
      assetQuery: '',
      tanggalPinjam: today,
      tanggalKembali: '',
      tandaTangan: '',
    })
    setSignatureResetKey((prev) => prev + 1)
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <section className="mx-auto w-full max-w-3xl rounded-xl bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-heading text-3xl font-semibold text-brand-navy">Form Peminjaman Barang</h1>
          <Link to="/" className="text-sm text-brand-blue hover:underline">
            Kembali
          </Link>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <FormInput
            label="Nama Peminjam"
            value={form.namaPeminjam}
            onChange={(value) => setForm((prev) => ({ ...prev, namaPeminjam: value }))}
            error={errors.namaPeminjam}
          />
          <FormInput
            label="Dari Unit/Ruangan"
            value={form.unitRuangan}
            onChange={(value) => setForm((prev) => ({ ...prev, unitRuangan: value }))}
            error={errors.unitRuangan}
          />

          <div className="relative">
            <label className="mb-1 block text-sm font-medium text-slate-700">Nama Barang yang Dipinjam</label>
            <input
              className={`input-base ${errors.selectedAssetId ? 'input-error' : ''}`}
              value={form.assetQuery}
              onChange={(event) => {
                setForm((prev) => ({
                  ...prev,
                  assetQuery: event.target.value,
                  selectedAssetId: '',
                }))
                setShowDropdown(true)
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Ketik nama barang..."
            />
            {showDropdown && form.assetQuery.trim() ? (
              <div className="absolute z-10 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                {suggestions.length > 0 ? (
                  suggestions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm hover:bg-slate-50"
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          selectedAssetId: String(item.id),
                          assetQuery: item.nama,
                        }))
                        setShowDropdown(false)
                      }}
                    >
                      [{item.kode}] {item.nama} - {item.type}
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-slate-500">Tidak ada barang tersedia.</p>
                )}
              </div>
            ) : null}
            {errors.selectedAssetId ? (
              <p className="mt-1 text-xs text-red-600">{errors.selectedAssetId}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput
              label="Tanggal Pinjam"
              type="date"
              value={form.tanggalPinjam}
              onChange={(value) => setForm((prev) => ({ ...prev, tanggalPinjam: value }))}
              readOnly
            />
            <FormInput
              label="Tanggal Kembali"
              type="date"
              value={form.tanggalKembali}
              onChange={(value) => setForm((prev) => ({ ...prev, tanggalKembali: value }))}
              error={errors.tanggalKembali}
            />
          </div>

          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">Tanda Tangan</p>
            <SignaturePad
              resetKey={signatureResetKey}
              onChange={handleSignatureChange}
              hasError={Boolean(errors.tandaTangan)}
            />
            {errors.tandaTangan ? (
              <p className="mt-1 text-xs text-red-600">{errors.tandaTangan}</p>
            ) : null}
          </div>

          <button type="submit" className="btn-primary w-full" disabled={appData.actionLoading}>
            {appData.actionLoading ? 'Memproses...' : 'Ajukan Peminjaman'}
          </button>
        </form>
      </section>
    </main>
  )
}

function SignaturePad({ onChange, resetKey, hasError }) {
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.strokeStyle = '#0f172a'
    context.lineWidth = 2
    context.lineCap = 'round'
    onChange('')
  }, [onChange, resetKey])

  const pointerPosition = (event) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    }
  }

  const handlePointerDown = (event) => {
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    drawingRef.current = true
    const { x, y } = pointerPosition(event)
    context.beginPath()
    context.moveTo(x, y)
  }

  const handlePointerMove = (event) => {
    if (!drawingRef.current) return
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    const { x, y } = pointerPosition(event)
    context.lineTo(x, y)
    context.stroke()
  }

  const finishDrawing = () => {
    if (!drawingRef.current) return
    drawingRef.current = false
    const canvas = canvasRef.current
    onChange(canvas.toDataURL('image/png'))
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={900}
        height={240}
        className={`h-44 w-full touch-none rounded-lg border bg-white ${
          hasError ? 'border-red-500' : 'border-slate-300'
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrawing}
        onPointerLeave={finishDrawing}
      />
      <button
        type="button"
        className="mt-2 rounded-md border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50"
        onClick={() => {
          const canvas = canvasRef.current
          const context = canvas.getContext('2d')
          context.fillStyle = '#ffffff'
          context.fillRect(0, 0, canvas.width, canvas.height)
          onChange('')
        }}
      >
        Hapus TTD
      </button>
    </div>
  )
}

function FormInput({ label, value, onChange, error, type = 'text', readOnly = false }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange(event.target.value)}
        className={`input-base ${error ? 'input-error' : ''} ${readOnly ? 'bg-slate-100' : ''}`}
      />
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

function FormSelect({ label, value, onChange, options, error }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`input-base ${error ? 'input-error' : ''}`}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  )
}

function StatusBadge({ status }) {
  const styleMap = {
    Tersedia: 'bg-emerald-100 text-emerald-700',
    Dipinjam: 'bg-amber-100 text-amber-700',
    Dikembalikan: 'bg-emerald-100 text-emerald-700',
    Rusak: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styleMap[status] || 'bg-slate-100 text-slate-700'}`}>
      {status}
    </span>
  )
}

function LoadingPanel({ message }) {
  return (
    <div className="rounded-xl bg-white p-6 text-sm text-slate-600 shadow-sm">
      {message}
    </div>
  )
}

function ErrorPanel({ message, onRetry }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm">
      <p className="text-sm text-red-700">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white"
      >
        Coba Lagi
      </button>
    </div>
  )
}

function ErrorInline({ message }) {
  return <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>
}

function ToastList({ toasts }) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`min-w-64 rounded-lg px-4 py-3 text-sm text-white shadow-lg transition-all ${
            toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  )
}

function validateRequired(form, fields) {
  return fields.reduce((acc, field) => {
    if (!String(form[field] || '').trim()) {
      acc[field] = 'Field ini wajib diisi.'
    }
    return acc
  }, {})
}

function DatabaseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="12" cy="5" rx="7" ry="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 5V11C5 12.66 8.13 14 12 14C15.87 14 19 12.66 19 11V5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 11V17C5 18.66 8.13 20 12 20C15.87 20 19 18.66 19 17V11" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

export default App
