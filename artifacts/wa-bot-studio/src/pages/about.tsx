import { useEffect, useState } from 'react';

type Mode = '1' | '2' | '3';

const modes: Array<{ id: Mode; label: string; tag: string; title: string; paragraphs: string[]; note: string }> = [
  {
    id: '1',
    label: 'MODE 1',
    tag: 'MODE 1',
    title: 'Ganti judul mode ini',
    paragraphs: [
      'Tulis di sini gambaran singkat tentang sisi diri kamu di mode ini. Bisa “diri profesional”, “diri santai”, “diri kreatif” — bebas, ini kanvas kamu.',
      'Tambahin detail lain: hal yang lagi dikerjain, minat, atau apa aja yang pengen ditunjukin di mode ini.',
    ],
    note: 'Edit bagian ini di kode: cari panel MODE 1',
  },
  {
    id: '2',
    label: 'MODE 2',
    tag: 'MODE 2',
    title: 'Ganti judul mode ini',
    paragraphs: [
      'Isi konten mode kedua di sini. Coba bikin kontras sama Mode 1 — misalnya kalau Mode 1 serius, Mode 2 bisa lebih santai atau personal.',
      'Bebas nambah paragraf, list, atau elemen lain sesuai kebutuhan.',
    ],
    note: 'Edit bagian ini di kode: cari panel MODE 2',
  },
  {
    id: '3',
    label: 'MODE 3',
    tag: 'MODE 3',
    title: 'Ganti judul mode ini',
    paragraphs: [
      'Isi konten mode ketiga di sini. Ini bisa jadi sisi paling unik — hobi random, mode “iseng”, atau apa pun yang belum masuk di dua mode sebelumnya.',
      'Setiap mode punya warna aksen sendiri (biru, oranye, hijau) biar terasa beda nuansanya.',
    ],
    note: 'Edit bagian ini di kode: cari panel MODE 3',
  },
];

export default function About() {
  const [mode, setMode] = useState<Mode>('1');
  const activeMode = modes.find((item) => item.id === mode) ?? modes[0];

  useEffect(() => {
    document.title = 'Tentang Aku — WA Bot Studio';
    return () => {
      document.title = 'WA Bot Studio';
    };
  }, []);

  return (
    <div className="about-page" data-mode={mode}>
      <div className="about-glow" aria-hidden="true" />
      <div className="about-wrap">
        <header className="about-header">
          <div className="about-eyebrow">Halaman pribadi</div>
          <h1>
            Tentang <span>Aku</span>
          </h1>
        </header>

        <div className="about-switch" data-active={mode} role="tablist" aria-label="Pilih mode halaman">
          <div className="about-switch-thumb" aria-hidden="true" />
          {modes.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={mode === item.id}
              className={mode === item.id ? 'active' : ''}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <section className="about-panel" key={activeMode.id} role="tabpanel" aria-label={activeMode.label}>
          <span className="about-tag">{activeMode.tag}</span>
          <h2>{activeMode.title}</h2>
          {activeMode.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <div className="about-placeholder-note">{activeMode.note}</div>
        </section>

        <footer className="about-footer">dibuat dengan mode — pilih salah satu di atas</footer>
      </div>
    </div>
  );
}