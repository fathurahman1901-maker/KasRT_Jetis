// script.js - Final Version (dengan PDF menggunakan jsPDF + autoTable, SEMUA DATA PASTI MASUK)
// Dibuat untuk KasRT Pro - Smart Jimpitan Digital

class KasRTPro {
    constructor() {
        // ========== SEQUENCE: Langkah awal saat aplikasi dijalankan ==========
        // 1. Muat data jimpitan dari localStorage
        this.data = this.loadData();
        // 2. Muat pengaturan nama penarik dan tanggal laporan
        this.settings = this.loadSettings();
        // 3. Siapkan tempat untuk chart (null dulu)
        this.chartInstance = null;
        // 4. Atur urutan awal sorting (A-Z)
        this.currentSort = 'asc';
        // 5. Jalankan proses inisialisasi (event, tampilan, dll)
        this.init();
        // 6. Aktifkan mode gelap (dark mode) jika sebelumnya dipilih
        this.initDarkMode();
    }

    init() {
        this.bindEvents();               // pasang semua event listener
        this.loadSettingsToForm();       // isi form pengaturan dari localStorage
        this.renderTable();              // tampilkan tabel data
        this.updateSummaryAndChart();    // hitung ulang statistik dan chart
    }

    initDarkMode() {
        const toggleBtn = document.getElementById('darkModeToggle');
        const isDark = localStorage.getItem('kasRT_darkMode') === 'true';
        if (isDark) {
            document.body.classList.add('dark-mode');
            toggleBtn.innerHTML = '<i class="bi bi-sun-fill"></i>';
        }
        toggleBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark-mode');
            const isDarkNow = document.body.classList.contains('dark-mode');
            localStorage.setItem('kasRT_darkMode', isDarkNow);
            toggleBtn.innerHTML = isDarkNow ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-fill"></i>';
        });
    }

    bindEvents() {
        // Pasang event listener untuk submit form tambah dan edit
        document.getElementById('jimpitanForm').addEventListener('submit', (e) => this.handleSubmit(e));
        document.getElementById('editForm').addEventListener('submit', (e) => this.handleEditSubmit(e));
        // Percabangan: ketika status berubah, kita aktif/nonaktifkan input nominal
        document.getElementById('status').addEventListener('change', () => this.toggleNominalField());
        document.getElementById('editStatus').addEventListener('change', () => this.toggleEditNominalField());
        // Filter, search, tombol aksi
        document.getElementById('filterStatus').addEventListener('change', () => this.renderTable());
        document.getElementById('searchInput').addEventListener('input', () => this.renderTable());
        document.getElementById('resetAll').addEventListener('click', () => this.resetAllData());
        document.getElementById('exportPDF').addEventListener('click', () => this.exportPDF());
        document.getElementById('sortAscBtn').addEventListener('click', () => { this.currentSort = 'asc'; this.sortByNomor(); });
        document.getElementById('sortDescBtn').addEventListener('click', () => { this.currentSort = 'desc'; this.sortByNomor(); });
        document.getElementById('resetSettingsBtn').addEventListener('click', () => this.resetSettings());
        // Isi otomatis tanggal laporan dengan hari ini
        const today = new Date().toISOString().split('T')[0];
        if (!document.getElementById('globalTanggalLaporan').value) document.getElementById('globalTanggalLaporan').value = today;
    }

    // -------- Fungsi untuk mengatur field nominal berdasarkan status (percabangan if/else) --------
    toggleNominalField() {
        const status = document.getElementById('status').value;
        const nominalField = document.getElementById('nominal');
        // BRANCHING: cek status pilihan
        if (status === 'Kosong') {
            // Jika status Kosong, nonaktifkan input nominal dan set ke 0 (karena tidak bayar)
            nominalField.disabled = true;
            nominalField.value = 0;
        } else if (status === 'Isi') {
            // Jika status Isi, aktifkan input nominal dan beri fokus
            nominalField.disabled = false;
            nominalField.focus();
        } else {
            // Status belum dipilih, biarkan nonaktif
            nominalField.disabled = true;
        }
    }

    toggleEditNominalField() {
        const status = document.getElementById('editStatus').value;
        const field = document.getElementById('editNominal');
        if (status === 'Kosong') {
            field.disabled = true;
            field.value = 0;
        } else {
            field.disabled = false;
        }
    }

    // ---------- VALIDASI INPUT (percabangan + pesan error) ----------
    validateInput(data) {
        // Branching: cek apakah nomor jimpitan kosong?
        if (!data.noJimpitan?.trim()) return 'No Jimpitan wajib diisi!';
        // Branching: cek apakah status belum dipilih?
        if (!data.status) return 'Status harus dipilih!';
        // Branching khusus: jika status Isi, nominal harus lebih dari 0
        if (data.status === 'Isi' && (data.nominal <= 0 || isNaN(data.nominal))) {
            return 'Nominal harus > 0 untuk status Isi!';
        }
        return null; // tidak ada error
    }

    // ================ TAMBAH DATA (SEQUENCE + validasi) ================
    handleSubmit(e) {
        e.preventDefault();
        // SEQUENCE: langkah-langkah menambah data baru
        // 1. Ambil nilai dari form
        const formData = {
            noJimpitan: document.getElementById('noJimpitan').value.trim(),
            status: document.getElementById('status').value,
            nominal: parseInt(document.getElementById('nominal').value) || 0
        };
        // 2. Validasi input
        const error = this.validateInput(formData);
        if (error) {
            alert('❌ ' + error);
            return;
        }
        // 3. Jika nomor kosong, buat otomatis
        if (!formData.noJimpitan) formData.noJimpitan = `Warga ${this.data.length + 1}`;
        // 4. Simpan ke array data
        this.data.push(formData);
        // 5. Simpan ke localStorage
        this.saveData();
        // 6. Reset form
        this.resetForm();
        // 7. Urutkan data sesuai pilihan sorting
        this.sortByNomor();
        // 8. Tampilkan ulang tabel dan statistik
        this.renderTable();
        this.updateSummaryAndChart();
        // 9. Beri notifikasi sukses
        alert('✅ Data jimpitan berhasil ditambahkan!');
    }

    // ================ EDIT DATA (SEQUENCE) ================
    handleEditSubmit(e) {
        e.preventDefault();
        const idx = parseInt(document.getElementById('editIndex').value);
        const updated = {
            noJimpitan: document.getElementById('editNoJimpitan').value.trim(),
            status: document.getElementById('editStatus').value,
            nominal: parseInt(document.getElementById('editNominal').value) || 0
        };
        const error = this.validateInput(updated);
        if (error) {
            alert('❌ ' + error);
            return;
        }
        this.data[idx] = updated;
        this.saveData();
        this.sortByNomor();
        // Tutup modal edit
        const modalEl = document.getElementById('editModal');
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
        this.renderTable();
        this.updateSummaryAndChart();
        alert('✅ Data berhasil diperbarui');
    }

    // ================ SORTING (menggunakan localeCompare) ================
    sortByNomor() {
        // LOOPING & BRANCHING: jika ascending, urutkan A->Z; jika descending Z->A
        if (this.currentSort === 'asc') {
            this.data.sort((a, b) => a.noJimpitan.localeCompare(b.noJimpitan, undefined, { numeric: true }));
        } else {
            this.data.sort((a, b) => b.noJimpitan.localeCompare(a.noJimpitan, undefined, { numeric: true }));
        }
        this.saveData();
        this.renderTable();
        this.updateSummaryAndChart();
    }

    // ================ MENAMPILKAN TABEL (LOOPING dengan map & filter) ================
    renderTable() {
        const tbody = document.getElementById('tableBody');
        const filter = document.getElementById('filterStatus').value;
        const search = document.getElementById('searchInput').value.toLowerCase().trim();

        // LOOPING: filter data berdasarkan status dan kata kunci pencarian
        let filtered = this.data.filter(item => {
            const matchStatus = filter === 'semua' || item.status === filter;
            const matchSearch = !search || item.noJimpitan.toLowerCase().includes(search);
            return matchStatus && matchSearch;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-5 text-muted"><i class="bi bi-folder2-open fs-1 d-block"></i>Tidak ada data</td></tr>`;
            return;
        }

        // LOOPING: gunakan map untuk membuat baris tabel
        tbody.innerHTML = filtered.map((item, idx) => {
            const globalIndex = this.data.findIndex(d => d === item);
            const statusClass = item.status === 'Isi' ? 'badge-status' : 'badge-status kosong';
            const statusIcon = item.status === 'Isi' ? '💰' : '📭';
            return `
                <tr>
                    <td class="fw-bold">${idx + 1}</td>
                    <td class="fw-semibold">${this.escapeHtml(item.noJimpitan)}</td>
                    <td><span class="${statusClass}">${statusIcon} ${item.status}</span></td>
                    <td class="text-end fw-bold">Rp ${this.formatRupiah(item.nominal)}</td>
                    <td class="text-center">
                        <button class="btn btn-sm btn-outline-primary rounded-pill action-btn me-1" onclick="kasRT.editData(${globalIndex})"><i class="bi bi-pencil"></i> Edit</button>
                        <button class="btn btn-sm btn-outline-danger rounded-pill action-btn" onclick="kasRT.deleteData(${globalIndex})"><i class="bi bi-trash"></i> Hapus</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    editData(index) {
        const item = this.data[index];
        document.getElementById('editIndex').value = index;
        document.getElementById('editNoJimpitan').value = item.noJimpitan;
        document.getElementById('editStatus').value = item.status;
        document.getElementById('editNominal').value = item.nominal;
        this.toggleEditNominalField();
        const modal = new bootstrap.Modal(document.getElementById('editModal'));
        modal.show();
    }

    deleteData(index) {
        // Branching: konfirmasi dulu sebelum hapus
        if (confirm(`Hapus "${this.data[index].noJimpitan}"?`)) {
            this.data.splice(index, 1);
            this.saveData();
            this.renderTable();
            this.updateSummaryAndChart();
            alert('Data dihapus');
        }
    }

    resetAllData() {
        if (confirm('Hapus PERMANEN semua data? Tidak bisa dikembalikan!')) {
            this.data = [];
            this.saveData();
            this.renderTable();
            this.updateSummaryAndChart();
            alert('Semua data direset');
        }
    }

    // ================ UPDATE RINGKASAN DAN CHART (menggunakan reduce, filter) ================
    updateSummaryAndChart() {
        const totalData = this.data.length;
        // LOOPING dengan filter untuk menghitung jumlah yang sudah bayar (status Isi)
        const bayar = this.data.filter(i => i.status === 'Isi').length;
        const belum = totalData - bayar;
        // LOOPING dengan reduce untuk menghitung total kas
        const totalKas = this.data.reduce((sum, i) => i.status === 'Isi' ? sum + (i.nominal || 0) : sum, 0);
        const avg = bayar > 0 ? totalKas / bayar : 0;

        // Update elemen DOM
        document.getElementById('totalData').innerText = totalData;
        document.getElementById('totalBayar').innerText = bayar;
        document.getElementById('totalBelum').innerText = belum;
        document.getElementById('totalKasRingkasan').innerText = 'Rp ' + this.formatRupiah(totalKas);
        document.getElementById('totalKasBadge').innerText = 'Rp ' + this.formatRupiah(totalKas);
        document.getElementById('totalKasStat').innerHTML = 'Rp ' + this.formatRupiah(totalKas);
        document.getElementById('rataRataInfo').innerHTML = `Rata-rata per pembayar: Rp ${this.formatRupiah(Math.round(avg))}`;
        document.getElementById('chartBayarCount').innerText = bayar;
        document.getElementById('chartKosongCount').innerText = belum;
        this.updateChart(bayar, belum);
    }

    // Bikin diagram donat (Chart.js) – ini panggilan library, tidak perlu komentar struktur kontrol
    updateChart(bayar, belum) {
        const ctx = document.getElementById('statusChart')?.getContext('2d');
        if (!ctx) return;
        if (this.chartInstance) this.chartInstance.destroy();
        this.chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Sudah Bayar (Isi)', 'Belum Bayar (Kosong)'],
                datasets: [{
                    data: [bayar, belum],
                    backgroundColor: ['#2563eb', '#dc2626'],
                    borderRadius: 14,
                    borderWidth: 0,
                    cutout: '58%',
                    hoverOffset: 10
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'bottom', labels: { font: { size: 11, weight: 'bold' }, usePointStyle: true } },
                    tooltip: { backgroundColor: '#1e3a8a' }
                },
                layout: { padding: 10 }
            }
        });
    }

    // ================ EXPORT PDF VERSI JSPDF + AUTOTABLE (PASTI SEMUA DATA MASUK) ================
    async exportPDF() {
        this.saveSettings();
        const penarik = this.settings.namaPenarik?.trim();
        const tglLap = this.settings.tanggalLaporan;
        if (!penarik) { alert('❌ Nama Penarik harus diisi!'); return; }
        if (!tglLap) { alert('❌ Tanggal laporan harus diisi!'); return; }
        if (this.data.length === 0) { alert('Tidak ada data untuk diexport.'); return; }

        // Ambil seluruh data (tanpa filter) dan urutkan sesuai sorting aktif
        const allData = [...this.data];
        if (this.currentSort === 'asc') {
            allData.sort((a, b) => a.noJimpitan.localeCompare(b.noJimpitan, undefined, { numeric: true }));
        } else {
            allData.sort((a, b) => b.noJimpitan.localeCompare(a.noJimpitan, undefined, { numeric: true }));
        }

        // Hitung total kas
        const totalKasAll = allData.reduce((s, i) => i.status === 'Isi' ? s + (i.nominal || 0) : s, 0);

        // Siapkan data untuk tabel (array 2 dimensi)
        const tableBody = [];
        // LOOPING for untuk membuat baris tabel
        for (let i = 0; i < allData.length; i++) {
            const item = allData[i];
            tableBody.push([
                (i + 1).toString(),
                item.noJimpitan,
                item.status,
                'Rp ' + this.formatRupiah(item.nominal)
            ]);
        }

        // Inisialisasi jsPDF dengan orientasi portrait
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        // Header laporan
        doc.setFontSize(16);
        doc.setTextColor(30, 58, 138); // warna biru tua #1e3a8a
        doc.text("LAPORAN JIMPITAN DIGITAL", 14, 20);
        doc.setFontSize(12);
        doc.setTextColor(30, 64, 138);
        doc.text("Desa Jetis RT 013 RW 005, Kemangkon Purbalingga", 14, 28);
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text(`Periode Laporan : ${new Date(tglLap).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 14, 36);
        doc.text(`Petugas Penarik : ${penarik}`, 14, 43);

        // Buat tabel menggunakan autoTable (library jsPDF-otomatis)
        doc.autoTable({
            startY: 52,
            head: [['No', 'No Jimpitan / KK', 'Status', 'Nominal (Rp)']],
            body: tableBody,
            theme: 'striped',
            headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold' },
            bodyStyles: { textColor: 50, fontSize: 10 },
            alternateRowStyles: { fillColor: [240, 244, 250] },
            margin: { left: 14, right: 14 },
            columnStyles: {
                0: { cellWidth: 15, halign: 'center' },
                1: { cellWidth: 'auto' },
                2: { cellWidth: 30, halign: 'center' },
                3: { cellWidth: 40, halign: 'right' }
            }
        });

        // Tambahkan total kas di bagian bawah
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(12);
        doc.setTextColor(30, 58, 138);
        doc.text(`Total Kas Terkumpul : Rp ${this.formatRupiah(totalKasAll)}`, 14, finalY);
        
        // Tanda tangan
        doc.setFontSize(10);
        doc.setTextColor(100, 116, 139);
        doc.text("Mengetahui, Petugas Penarik", 14, finalY + 20);
        doc.text(penarik, 14, finalY + 30);

        // Simpan PDF
        doc.save(`Laporan_Jimpitan_RT013_${new Date().toISOString().slice(0, 10)}.pdf`);
        alert('✅ PDF berhasil diunduh. Seluruh data tercantum lengkap dan tidak terpotong!');
    }

    // -------- Local storage helpers --------
    saveData() { localStorage.setItem('kasRT_data_v5', JSON.stringify(this.data)); }
    loadData() {
        try {
            let raw = localStorage.getItem('kasRT_data_v5');
            if (!raw) return [];
            let parsed = JSON.parse(raw);
            return parsed.map(item => ({
                noJimpitan: item.noJimpitan || 'Warga',
                status: item.status,
                nominal: item.nominal || 0
            }));
        } catch { return []; }
    }

    resetForm() {
        document.getElementById('jimpitanForm').reset();
        document.getElementById('status').value = '';
        document.getElementById('nominal').disabled = true;
    }

    // Pengaturan laporan
    loadSettings() {
        try {
            const s = localStorage.getItem('kasRT_settings');
            return s ? JSON.parse(s) : {};
        } catch { return {}; }
    }
    saveSettings() {
        this.settings = {
            namaPenarik: document.getElementById('globalNamaPenarik').value.trim(),
            tanggalLaporan: document.getElementById('globalTanggalLaporan').value
        };
        localStorage.setItem('kasRT_settings', JSON.stringify(this.settings));
    }
    loadSettingsToForm() {
        document.getElementById('globalNamaPenarik').value = this.settings.namaPenarik || '';
        if (this.settings.tanggalLaporan) document.getElementById('globalTanggalLaporan').value = this.settings.tanggalLaporan;
        else document.getElementById('globalTanggalLaporan').value = new Date().toISOString().split('T')[0];
    }
    resetSettings() {
        document.getElementById('globalNamaPenarik').value = '';
        document.getElementById('globalTanggalLaporan').value = new Date().toISOString().split('T')[0];
        this.saveSettings();
        alert('Pengaturan laporan direset.');
    }

    // Utility
    formatRupiah(angka) { return angka.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
    escapeHtml(str) { return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]); }
}

// Mulai aplikasi
window.kasRT = new KasRTPro();
