-- Drop tables if partially created before
DROP TABLE IF EXISTS public.peminjaman;
DROP TABLE IF EXISTS public.assets;

-- Create assets table
CREATE TABLE public.assets (
  id BIGSERIAL PRIMARY KEY,
  nama TEXT NOT NULL,
  kode TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  kondisi TEXT CHECK (kondisi IN ('Baik', 'Rusak', 'Rusak Parah')) NOT NULL,
  lokasi TEXT NOT NULL,
  status TEXT DEFAULT 'Tersedia' CHECK (status IN ('Tersedia', 'Dipinjam')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create peminjaman table
CREATE TABLE public.peminjaman (
  id BIGSERIAL PRIMARY KEY,
  asset_id BIGINT REFERENCES public.assets(id),
  nama_barang TEXT NOT NULL,
  kode_barang TEXT NOT NULL,
  nama_peminjam TEXT NOT NULL,
  unit_ruangan TEXT NOT NULL,
  tanggal_pinjam DATE NOT NULL,
  tanggal_kembali DATE NOT NULL,
  ttd_base64 TEXT,
  status TEXT DEFAULT 'Dipinjam' CHECK (status IN ('Dipinjam', 'Dikembalikan')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed initial data
INSERT INTO public.assets (nama, kode, type, kondisi, lokasi) VALUES
  ('Laptop Dell Latitude', 'IT-LP-001', 'Laptop', 'Baik', 'Ruang Server'),
  ('Proyektor Epson EB-X41', 'IT-PJ-001', 'Proyektor', 'Baik', 'Gudang IT'),
  ('Switch Cisco 24 Port', 'IT-NW-001', 'Networking', 'Baik', 'Ruang Server'),
  ('Mouse Logitech M235', 'IT-PR-001', 'Peripheral', 'Baik', 'Gudang IT'),
  ('UPS APC 650VA', 'IT-UP-001', 'UPS', 'Baik', 'Ruang Server');

-- Disable RLS for now
ALTER TABLE public.assets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.peminjaman DISABLE ROW LEVEL SECURITY;
