import { useState } from 'react';
import type { Sponsor } from '../types';

interface SponsorsPanelProps {
  sponsors: Sponsor[];
  onAdd: (name: string, file: File) => Promise<void>;
  onRemove: (sponsor: Sponsor) => void;
}

export function SponsorsPanel({ sponsors, onAdd, onRemove }: SponsorsPanelProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim() || !file) {
      setError('Escolha um nome e uma imagem.');
      return;
    }
    setIsUploading(true);
    setError(null);
    try {
      await onAdd(name.trim(), file);
      setName('');
      setFile(null);
      setFormOpen(false);
    } catch {
      setError('Não foi possível enviar o logo. Tente novamente.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section className="sponsors-panel">
      <div className="sponsors-panel-header">
        <h4>Patrocinadores</h4>
        <button
          type="button"
          className="btn btn--link"
          onClick={() => {
            setFormOpen((v) => !v);
            setError(null);
          }}
        >
          {formOpen ? 'Cancelar' : '+ Adicionar'}
        </button>
      </div>

      {sponsors.length > 0 && (
        <ul className="sponsors-list">
          {sponsors.map((s) => (
            <li key={s.id} className="sponsor-chip">
              <img src={s.logoUrl} alt={s.name} />
              <span>{s.name}</span>
              <button
                type="button"
                className="sponsor-chip-remove"
                onClick={() => onRemove(s)}
                aria-label={`Remover ${s.name}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {sponsors.length === 0 && !formOpen && <p className="sponsors-empty">Nenhum patrocinador ainda.</p>}

      {formOpen && (
        <div className="sponsor-form">
          <input type="text" placeholder="Nome do patrocinador" value={name} onChange={(e) => setName(e.target.value)} />
          <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button type="button" className="btn btn--primary btn--small" onClick={submit} disabled={isUploading}>
            {isUploading ? 'Enviando…' : 'Adicionar'}
          </button>
          {error && <p className="modal-error">{error}</p>}
        </div>
      )}
    </section>
  );
}
